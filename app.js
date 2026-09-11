// ===== State Management =====
let books = [];
let currentRating = 0;
let editingId = null;
let favoritesOnly = false;
let currentView = 'grid';
let currentReviewBookId = null;
let currentReviewRating = 0;

const STORAGE_KEY = 'bookTrackerBooks';
const THEME_KEY = 'bookTrackerTheme';
const VIEW_KEY = 'bookTrackerView';
const REVIEWER_KEY = 'bookTrackerReviewer';
const DELETE_KEYS_KEY = 'bookTrackerDeleteKeys';
const FAVORITES_KEY = 'bookTrackerFavorites';
const BOOK_DELETE_KEYS_KEY = 'bookTrackerBookDeleteKeys';

// Shared review state
let supabaseClient = null;
let sharedMode = false;
let sharedReviews = null; // null = not loaded, {} = loaded, { [bookId]: [review,...] }
let deleteKeys = {};      // { [reviewId]: deleteKey }

// Shared book state
let sharedBooks = null;   // null = not loaded, [] = loaded (array of shared books)
let bookDeleteKeys = {};  // { [sharedBookId]: deleteKey }
let favorites = {};       // { [bookKey]: true } — favorites stay per-device

// ===== DOM Elements =====
const booksContainer = document.getElementById('books-container');
const emptyState = document.getElementById('empty-state');
const modalOverlay = document.getElementById('modal-overlay');
const bookForm = document.getElementById('book-form');
const modalTitle = document.getElementById('modal-title');
const addBookBtn = document.getElementById('add-book-btn');
const modalClose = document.getElementById('modal-close');
const formCancel = document.getElementById('form-cancel');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const genreFilter = document.getElementById('genre-filter');
const favoritesToggle = document.getElementById('favorites-toggle');
const themeToggle = document.getElementById('theme-toggle');
const stars = document.querySelectorAll('#star-rating .star');
const totalCount = document.getElementById('total-count');
const favoritesCount = document.getElementById('favorites-count');
const avgRating = document.getElementById('avg-rating');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const viewGrid = document.getElementById('view-grid');
const viewList = document.getElementById('view-list');

// Review DOM elements
const reviewDetailOverlay = document.getElementById('review-detail-overlay');
const reviewDetailTitle = document.getElementById('review-detail-title');
const reviewDetailClose = document.getElementById('review-detail-close');
const bookDetailInfo = document.getElementById('book-detail-info');
const reviewSyncNote = document.getElementById('review-sync-note');
const reviewList = document.getElementById('review-list');
const reviewDetailEmpty = document.getElementById('review-detail-empty');
const addReviewBtn = document.getElementById('add-review-btn');
const reviewFormOverlay = document.getElementById('review-form-overlay');
const reviewFormTitle = document.getElementById('review-form-title');
const reviewFormClose = document.getElementById('review-form-close');
const reviewForm = document.getElementById('review-form');
const reviewFormCancel = document.getElementById('review-form-cancel');
const reviewStars = document.querySelectorAll('#review-star-rating .star');
const reviewText = document.getElementById('review-text');
const reviewerInput = document.getElementById('review-reviewer');

// ===== Load & Save =====
function loadBooks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  books = saved ? JSON.parse(saved) : [];
  books.forEach(book => {
    if (!book.reviews) book.reviews = [];
  });
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function loadDeleteKeys() {
  const saved = localStorage.getItem(DELETE_KEYS_KEY);
  deleteKeys = saved ? JSON.parse(saved) : {};
}

function saveDeleteKeys() {
  localStorage.setItem(DELETE_KEYS_KEY, JSON.stringify(deleteKeys));
}

function loadFavorites() {
  const saved = localStorage.getItem(FAVORITES_KEY);
  favorites = saved ? JSON.parse(saved) : {};
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function loadBookDeleteKeys() {
  const saved = localStorage.getItem(BOOK_DELETE_KEYS_KEY);
  bookDeleteKeys = saved ? JSON.parse(saved) : {};
}

function saveBookDeleteKeys() {
  localStorage.setItem(BOOK_DELETE_KEYS_KEY, JSON.stringify(bookDeleteKeys));
}

function makeKey() {
  return crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ===== Supabase =====
function initSupabase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL;
  const key = window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY;
  if (url && key && window.supabase && window.supabase.createClient) {
    supabaseClient = window.supabase.createClient(url, key);
    sharedMode = true;
  }
}

async function fetchSharedReviews() {
  if (!sharedMode) return;
  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    sharedReviews = {};
    (data || []).forEach(review => {
      const bookId = review.book_id;
      if (!sharedReviews[bookId]) sharedReviews[bookId] = [];
      sharedReviews[bookId].push(review);
    });
  } catch (err) {
    sharedReviews = null;
    sharedMode = false;
  }
}

function getReviews(book) {
  if (sharedMode && sharedReviews) {
    return sharedReviews[stableBookId(book)] || [];
  }
  return book.reviews || [];
}

function stableBookId(book) {
  const s = (book.title + '|' + book.author).toLowerCase();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchSharedBooks() {
  if (!sharedMode) return;
  try {
    const { data, error } = await supabaseClient
      .from('books')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    sharedBooks = data || [];
  } catch (err) {
    sharedBooks = null;
  }
}

async function publishBookToShared(book) {
  const deleteKey = makeKey();
  const { data, error } = await supabaseClient.rpc('add_book', {
    p_book_key: stableBookId(book),
    p_title: book.title,
    p_author: book.author,
    p_genre: book.genre || '',
    p_rating: book.rating || 0,
    p_date_read: book.dateRead || '',
    p_cover: book.cover || '',
    p_notes: book.notes || '',
    p_delete_key: deleteKey,
  });
  if (error) throw error;
  book.sharedId = data;
  bookDeleteKeys[data] = deleteKey;
  saveBookDeleteKeys();
  return true;
}

async function updateBookShared(book) {
  const { error } = await supabaseClient.from('books').update({
    book_key: stableBookId(book),
    title: book.title,
    author: book.author,
    genre: book.genre || '',
    rating: book.rating || 0,
    date_read: book.dateRead || '',
    cover: book.cover || '',
    notes: book.notes || '',
  }).eq('id', book.sharedId);
  if (error) throw error;
}

function migrateLegacyFavorites() {
  let changed = false;
  books.forEach(book => {
    if (book.favorite) {
      favorites[stableBookId(book)] = true;
      delete book.favorite;
      changed = true;
    }
  });
  if (changed) {
    saveBooks();
    saveFavorites();
  }
}

async function replaceDemoBooksWithBundled() {
  if (!books.length || !books.every(b => /^demo\d+$/.test(b.id))) return;
  try {
    const res = await fetch(DATA_FILE);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data.every(b => b.title && b.author)) {
        data.forEach(book => {
          if (!book.id) book.id = makeKey();
          if (!Array.isArray(book.reviews)) book.reviews = [];
        });
        books = data;
        saveBooks();
      }
    }
  } catch (err) {
    // Keep current books if the bundled file can't be loaded.
  }
}

async function reconcileBooks() {
  if (!sharedMode || !sharedBooks) return;

  const sharedByKey = new Map(sharedBooks.map(b => [b.book_key, b]));
  const merged = [];

  for (const book of books) {
    const key = stableBookId(book);
    const shared = sharedByKey.get(key);
    if (shared) {
      book.sharedId = shared.id;
      book.title = shared.title;
      book.author = shared.author;
      book.genre = shared.genre || '';
      book.rating = shared.rating || 0;
      book.dateRead = shared.date_read || '';
      book.cover = shared.cover || '';
      book.notes = shared.notes || '';
      merged.push(book);
      sharedByKey.delete(key);
    } else {
      if (book.sharedId) {
        // This was adopted from the shared table but its row is gone
        // (deleted by the owning browser) — remove the local copy rather
        // than re-publishing it.
        continue;
      }
      try {
        await publishBookToShared(book);
      } catch (err) {
        // Not published (offline / function missing). Keep it local; retried next load.
      }
      merged.push(book);
    }
  }

  // Books that exist only in the shared table: add them locally so everyone sees them.
  for (const s of sharedByKey.values()) {
    merged.push({
      id: s.id,
      sharedId: s.id,
      title: s.title,
      author: s.author,
      genre: s.genre || '',
      rating: s.rating || 0,
      dateRead: s.date_read || '',
      cover: s.cover || '',
      notes: s.notes || '',
      reviews: [],
    });
  }

  books = merged;
  saveBooks();
}

function getReviewCount(book) {
  return getReviews(book).length;
}

function canDeleteReview(review) {
  if (sharedMode && sharedReviews) {
    return Boolean(deleteKeys[review.id]);
  }
  return true;
}

function reviewDate(review) {
  return review.created_at || review.date;
}

// ===== Theme Management =====
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const icon = themeToggle.querySelector('.theme-icon');
  if (saved === 'dark') {
    icon.textContent = '☀️';
  } else if (saved === 'colorful') {
    icon.textContent = '🎨';
  } else {
    icon.textContent = '🌙';
  }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const themes = ['light', 'dark', 'colorful'];
  const next = themes[(themes.indexOf(current) + 1) % themes.length];
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  const icon = themeToggle.querySelector('.theme-icon');
  icon.className = 'theme-icon';
  if (next === 'dark') {
    icon.textContent = '☀️';
  } else if (next === 'colorful') {
    icon.textContent = '🎨';
  } else {
    icon.textContent = '🌙';
  }
});

// ===== View Management =====
function loadView() {
  const saved = localStorage.getItem(VIEW_KEY) || 'grid';
  currentView = saved;
  updateViewButtons();
}

function updateViewButtons() {
  viewGrid.classList.toggle('active', currentView === 'grid');
  viewList.classList.toggle('active', currentView === 'list');
  booksContainer.className = currentView === 'grid' ? 'books-grid' : 'books-list';
}

function toggleView(view) {
  currentView = view;
  localStorage.setItem(VIEW_KEY, view);
  updateViewButtons();
  renderBooks();
}

viewGrid.addEventListener('click', () => toggleView('grid'));
viewList.addEventListener('click', () => toggleView('list'));

// ===== Export / Import =====
async function exportData() {
  const data = JSON.stringify(books, null, 2);
  const suggestedName = 'book-tracker-data.json';

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'JSON',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData() {
  importFile.click();
}

importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!Array.isArray(data)) {
        alert('Invalid file format. Expected a JSON array of books.');
        return;
      }
      const isValid = data.every(book =>
        book.title && book.author && typeof book.title === 'string' && typeof book.author === 'string'
      );
      if (!isValid) {
        alert('Invalid data. Each book must have a title and author.');
        return;
      }
      books = data;
      books.forEach(book => {
        if (!book.id) {
          book.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        }
        if (!book.reviews) book.reviews = [];
      });
      saveBooks();
      populateGenreFilter();
      renderBooks();
    } catch (err) {
      alert('Error reading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  importFile.value = '';
});

exportBtn.addEventListener('click', exportData);
importBtn.addEventListener('click', importData);

// ===== Render Books =====
function renderBooks() {
  let filtered = [...books];

  const searchTerm = searchInput.value.toLowerCase().trim();
  if (searchTerm) {
    filtered = filtered.filter(book =>
      book.title.toLowerCase().includes(searchTerm) ||
      book.author.toLowerCase().includes(searchTerm)
    );
  }

  const genre = genreFilter.value;
  if (genre !== 'all') {
    filtered = filtered.filter(book => book.genre === genre);
  }

  if (favoritesOnly) {
    filtered = filtered.filter(book => book.favorite);
  }

  const sortType = sortSelect.value;
  switch (sortType) {
    case 'date-asc':
      filtered.sort((a, b) => (a.dateRead || '').localeCompare(b.dateRead || ''));
      break;
    case 'title-asc':
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'title-desc':
      filtered.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'rating-desc':
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'rating-asc':
      filtered.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      break;
    default:
      filtered.sort((a, b) => (b.dateRead || '').localeCompare(a.dateRead || ''));
  }

  booksContainer.innerHTML = '';
  filtered.forEach((book, index) => {
    book.favorite = !!favorites[stableBookId(book)];
    const el = currentView === 'grid'
      ? createBookCard(book, index)
      : createBookRow(book, index);
    booksContainer.appendChild(el);
  });

  updateStats();
  emptyState.classList.toggle('hidden', filtered.length > 0);

  if (filtered.length === 0 && books.length > 0) {
    emptyState.querySelector('h2').textContent = 'No matches found';
    emptyState.querySelector('p').textContent = 'Try adjusting your search or filters.';
  } else if (filtered.length === 0) {
    emptyState.querySelector('h2').textContent = 'No books yet';
    emptyState.querySelector('p').textContent = 'Click "Add Book" to start tracking your reading journey!';
  }
}

// ===== Create Book Card (Grid View) =====
function createBookCard(book, index) {
  const card = document.createElement('div');
  card.className = 'book-card';
  card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;

  const gradientNum = (index % 6) + 1;
  const hasCover = book.cover && book.cover.trim();
  const ratingStars = (book.rating || 0) > 0 ? renderStars(book.rating) : '';
  const reviewCount = getReviewCount(book);
  const canDelete = !(book.sharedId && !bookDeleteKeys[book.sharedId]);

  card.innerHTML = `
    <div class="card-cover" data-gradient="${hasCover ? '' : gradientNum}">
      ${hasCover
        ? `<img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} cover" onerror="handleImageError(this)">`
        : '<span class="no-cover">📖</span>'
      }
      <div class="card-actions-top">
        <button class="btn-fav ${book.favorite ? 'active' : ''}" data-action="fav" title="Toggle favorite">♥</button>
        <button class="btn-edit" data-action="edit" title="Edit book">✏️</button>
        ${canDelete ? '<button class="btn-delete" data-action="delete" title="Delete book">🗑️</button>' : ''}
      </div>
    </div>
    <div class="card-body">
      <div class="card-genre genre-${getGenreClass(book.genre)}">${escapeHtml(book.genre || 'General')}</div>
      <h3 class="card-title">${escapeHtml(book.title)}</h3>
      <p class="card-author">by ${escapeHtml(book.author)}</p>
      ${book.rating > 0 ? `<div class="card-rating">${ratingStars}</div>` : ''}
      ${book.dateRead ? `<div class="card-date">📅 ${escapeHtml(formatDate(book.dateRead))}</div>` : ''}
      ${book.notes ? `<p class="card-notes">💭 ${escapeHtml(book.notes)}</p>` : ''}
      <button class="review-badge" data-action="reviews" title="View details & reviews">
        💬 ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}
      </button>
    </div>
  `;

  card.querySelector('[data-action="fav"]').addEventListener('click', () => toggleFavorite(book.id));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(book.id));
  const cardDelBtn = card.querySelector('[data-action="delete"]');
  if (cardDelBtn) cardDelBtn.addEventListener('click', () => deleteBook(book.id, card));
  card.querySelector('[data-action="reviews"]').addEventListener('click', () => openBookDetail(book.id));
  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    openBookDetail(book.id);
  });

  return card;
}

// ===== Create Book Row (List View) =====
function createBookRow(book, index) {
  const row = document.createElement('div');
  row.className = 'book-row';
  row.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;

  const gradientNum = (index % 6) + 1;
  const hasCover = book.cover && book.cover.trim();
  const ratingStars = (book.rating || 0) > 0 ? renderStarsCompact(book.rating) : '';
  const reviewCount = getReviewCount(book);
  const canDelete = !(book.sharedId && !bookDeleteKeys[book.sharedId]);

  row.innerHTML = `
    <div class="book-row-cover" data-gradient="${hasCover ? '' : gradientNum}">
      ${hasCover
        ? `<img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} cover" onerror="handleRowImageError(this)">`
        : '<span class="no-cover">📖</span>'
      }
    </div>
    <div class="book-row-info">
      <div class="row-title">${escapeHtml(book.title)}</div>
      <div class="row-author">by ${escapeHtml(book.author)}</div>
    </div>
    <div class="book-row-genre">
      <div class="card-genre genre-${getGenreClass(book.genre)}">${escapeHtml(book.genre || 'General')}</div>
    </div>
    <div class="book-row-rating">
      ${ratingStars || '<span style="color: var(--text-light); font-size: 12px;">No rating</span>'}
    </div>
    <div class="book-row-date">
      ${book.dateRead ? escapeHtml(formatDate(book.dateRead)) : ''}
    </div>
    <div class="book-row-reviews">
      <button class="review-badge" data-action="reviews" title="View details & reviews">
        💬 ${reviewCount}
      </button>
    </div>
    <div class="book-row-actions">
      <button class="btn-fav ${book.favorite ? 'active' : ''}" data-action="fav" title="Toggle favorite">♥</button>
      <button data-action="edit" title="Edit book">✏️</button>
      ${canDelete ? '<button data-action="delete" title="Delete book">🗑️</button>' : ''}
    </div>
  `;

  row.querySelector('[data-action="fav"]').addEventListener('click', () => toggleFavorite(book.id));
  row.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(book.id));
  const rowDelBtn = row.querySelector('[data-action="delete"]');
  if (rowDelBtn) rowDelBtn.addEventListener('click', () => deleteBook(book.id, row));
  row.querySelector('[data-action="reviews"]').addEventListener('click', () => openBookDetail(book.id));
  row.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    openBookDetail(book.id);
  });

  return row;
}

function handleRowImageError(img) {
  const cover = img.parentElement;
  cover.dataset.gradient = cover.dataset.gradient || '1';
  const fallback = document.createElement('span');
  fallback.className = 'no-cover';
  fallback.textContent = '📖';
  img.replaceWith(fallback);
}

function handleImageError(img) {
  const cover = img.parentElement;
  cover.dataset.gradient = cover.dataset.gradient || '1';
  const fallback = document.createElement('span');
  fallback.className = 'no-cover';
  fallback.textContent = '📖';
  img.replaceWith(fallback);
}

function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="star ${i <= rating ? '' : 'empty'}">★</span>`;
  }
  return stars;
}

function renderStarsCompact(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="star ${i <= rating ? '' : 'empty'}">★</span>`;
  }
  return stars;
}

function getGenreClass(genre) {
  const g = (genre || '').toLowerCase().replace(/[^a-z]/g, '');
  const genreMap = {
    'fiction': 'fiction',
    'scifi': 'scifi',
    'scififantasy': 'scifi',
    'fantasy': 'fantasy',
    'mystery': 'mystery',
    'romance': 'romance',
    'nonfiction': 'nonfiction',
  };
  return genreMap[g] || 'default';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function updateStats() {
  totalCount.textContent = books.length;
  favoritesCount.textContent = books.filter(b => b.favorite).length;
  const ratedBooks = books.filter(b => b.rating > 0);
  if (ratedBooks.length === 0) {
    avgRating.textContent = '—';
  } else {
    const avg = ratedBooks.reduce((sum, b) => sum + b.rating, 0) / ratedBooks.length;
    avgRating.textContent = avg.toFixed(1);
  }
}

// ===== Populate Genre Filter =====
function populateGenreFilter() {
  const genres = new Set(books.map(b => b.genre).filter(Boolean));
  genreFilter.innerHTML = '<option value="all">All Genres</option>';
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    genreFilter.appendChild(option);
  });
  const currentGenre = genreFilter.dataset.selected;
  if (currentGenre && [...genreFilter.options].some(o => o.value === currentGenre)) {
    genreFilter.value = currentGenre;
  } else {
    genreFilter.value = 'all';
  }
}

// ===== CRUD Operations =====
function toggleFavorite(id) {
  const book = books.find(b => b.id === id);
  if (book) {
    const key = stableBookId(book);
    favorites[key] = !favorites[key];
    book.favorite = favorites[key];
    saveFavorites();
    renderBooks();
  }
}

async function deleteBook(id, card) {
  const book = books.find(b => b.id === id);
  card.classList.add('removing');
  setTimeout(async () => {
    if (book && book.sharedId && bookDeleteKeys[book.sharedId] && supabaseClient) {
      try {
        await supabaseClient.rpc('delete_book', {
          p_book_id: book.sharedId,
          p_delete_key: bookDeleteKeys[book.sharedId],
        });
      } catch (err) {
        // Best effort: still remove locally.
      }
      delete bookDeleteKeys[book.sharedId];
      saveBookDeleteKeys();
      if (sharedBooks) {
        const key = stableBookId(book);
        sharedBooks = sharedBooks.filter(b => b.book_key !== key);
      }
    }
    books = books.filter(b => b.id !== id);
    saveBooks();
    populateGenreFilter();
    renderBooks();
  }, 300);
}

function openEditModal(id) {
  const book = books.find(b => b.id === id);
  if (!book) return;

  editingId = id;
  modalTitle.textContent = 'Edit Book';
  document.getElementById('book-id').value = id;
  document.getElementById('book-title').value = book.title || '';
  document.getElementById('book-author').value = book.author || '';
  document.getElementById('book-genre').value = book.genre || '';
  document.getElementById('book-date').value = book.dateRead || '';
  document.getElementById('book-cover').value = book.cover || '';
  document.getElementById('book-notes').value = book.notes || '';
  currentRating = book.rating || 0;
  updateStarDisplay();

  openModal();
}

function openAddModal() {
  editingId = null;
  modalTitle.textContent = 'Add New Book';
  bookForm.reset();
  document.getElementById('book-id').value = '';
  currentRating = 0;
  updateStarDisplay();
  openModal();
}

function openModal() {
  modalOverlay.classList.add('active');
  setTimeout(() => document.getElementById('book-title').focus(), 350);
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

// ===== Book Detail + Reviews =====
function openBookDetail(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  currentReviewBookId = bookId;
  reviewDetailTitle.textContent = book.title;
  renderBookDetail(book);
  renderReviewList(book);
  reviewDetailOverlay.classList.add('active');
}

function renderBookDetail(book) {
  const hasCover = book.cover && book.cover.trim();
  const ratingStars = (book.rating || 0) > 0 ? renderStars(book.rating) : '';

  bookDetailInfo.innerHTML = `
    <div class="book-detail-cover">
      ${hasCover
        ? `<img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} cover" onerror="handleImageError(this)">`
        : '<span class="no-cover">📖</span>'
      }
    </div>
    <div class="book-detail-fields">
      <div class="card-genre genre-${getGenreClass(book.genre)}">${escapeHtml(book.genre || 'General')}</div>
      <h3 class="book-detail-title">${escapeHtml(book.title)}</h3>
      <p class="book-detail-author">by ${escapeHtml(book.author)}</p>
      ${(book.rating || 0) > 0 ? `<div class="book-detail-rating">${ratingStars}</div>` : ''}
      ${book.dateRead ? `<p class="book-detail-date">📅 ${escapeHtml(formatDate(book.dateRead))}</p>` : ''}
      ${book.notes ? `<p class="book-detail-notes">💭 ${escapeHtml(book.notes)}</p>` : ''}
    </div>
  `;
}

function closeReviewDetail() {
  reviewDetailOverlay.classList.remove('active');
  currentReviewBookId = null;
}

function renderReviewList(book) {
  const reviews = getReviews(book);
  reviewDetailEmpty.classList.toggle('hidden', reviews.length > 0);

  reviewSyncNote.textContent = sharedMode && sharedReviews
    ? '🌐 Reviews are shared with all visitors'
    : 'Reviews are stored locally on this browser';
  reviewSyncNote.classList.toggle('shared', sharedMode && sharedReviews);

  reviewList.innerHTML = '';
  reviews.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-card';
    const reviewer = (review.reviewer || 'Anonymous').trim();
    const initial = reviewer.charAt(0).toUpperCase();
    const dateStr = formatDate(reviewDate(review));
    const showDelete = canDeleteReview(review);

    card.innerHTML = `
      <div class="review-card-header">
        <div class="review-author">
          <span class="review-avatar">${escapeHtml(initial)}</span>
          <div class="review-author-meta">
            <span class="review-name">${escapeHtml(reviewer)}</span>
            <span class="review-card-date">${escapeHtml(dateStr)}</span>
          </div>
        </div>
        <div class="review-card-rating">${renderStars(review.rating || 0)}</div>
      </div>
      ${review.text ? `<div class="review-card-text">${escapeHtml(review.text)}</div>` : ''}
      ${showDelete ? `
        <div class="review-card-actions">
          <button class="review-delete-btn" data-review-id="${review.id}">Delete</button>
        </div>
      ` : ''}
    `;

    const delBtn = card.querySelector('.review-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        deleteReview(book.id, review.id);
      });
    }
    reviewList.appendChild(card);
  });
}

// ===== Review Form =====
function openReviewForm(bookId) {
  const book = books.find(b => b.id === bookId);
  if (book) reviewFormTitle.textContent = `Add Review — ${book.title}`;
  reviewForm.reset();
  reviewerInput.value = localStorage.getItem(REVIEWER_KEY) || '';
  currentReviewRating = 0;
  updateReviewStarDisplay();
  reviewFormOverlay.classList.add('active');
  setTimeout(() => reviewerInput.focus(), 350);
}

function closeReviewForm() {
  reviewFormOverlay.classList.remove('active');
}

async function addReview(bookId, reviewData) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  if (sharedMode) {
    const deleteKey = makeKey();
    try {
      const { data, error } = await supabaseClient.rpc('add_review', {
        p_book_id: stableBookId(book),
        p_reviewer: reviewData.reviewer,
        p_rating: reviewData.rating,
        p_text: reviewData.text,
        p_delete_key: deleteKey,
      });
      if (error) throw error;
      deleteKeys[data] = deleteKey;
      saveDeleteKeys();
      await fetchSharedReviews();
      renderReviewList(book);
      renderBooks();
      return true;
    } catch (err) {
      alert('Could not save review online. Saving locally instead.');
      sharedMode = false;
    }
  }

  if (!book.reviews) book.reviews = [];
  book.reviews.push({
    id: makeKey(),
    reviewer: reviewData.reviewer,
    text: reviewData.text,
    rating: reviewData.rating,
    date: new Date().toISOString().split('T')[0],
  });
  saveBooks();
  renderReviewList(book);
  renderBooks();
  return true;
}

async function deleteReview(bookId, reviewId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  if (sharedMode) {
    const deleteKey = deleteKeys[reviewId];
    if (!deleteKey) return;
    try {
      const { error } = await supabaseClient.rpc('delete_review', {
        p_review_id: reviewId,
        p_delete_key: deleteKey,
      });
      if (error) throw error;
      delete deleteKeys[reviewId];
      saveDeleteKeys();
      await fetchSharedReviews();
      renderReviewList(book);
      renderBooks();
      return;
    } catch (err) {
      alert('Could not delete the review online. Please try again.');
      return;
    }
  }

  if (book.reviews) {
    book.reviews = book.reviews.filter(r => r.id !== reviewId);
    saveBooks();
    renderReviewList(book);
    renderBooks();
  }
}

// Review form submit
reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentReviewBookId) return;

  const reviewer = reviewerInput.value.trim();
  if (!reviewer) {
    alert('Please enter your name.');
    return;
  }
  localStorage.setItem(REVIEWER_KEY, reviewer);

  await addReview(currentReviewBookId, {
    reviewer,
    text: reviewText.value.trim(),
    rating: currentReviewRating,
  });

  closeReviewForm();
});

addReviewBtn.addEventListener('click', () => {
  if (currentReviewBookId) openReviewForm(currentReviewBookId);
});
reviewDetailClose.addEventListener('click', closeReviewDetail);
reviewFormClose.addEventListener('click', closeReviewForm);
reviewFormCancel.addEventListener('click', closeReviewForm);

reviewDetailOverlay.addEventListener('click', (e) => {
  if (e.target === reviewDetailOverlay) closeReviewDetail();
});

reviewFormOverlay.addEventListener('click', (e) => {
  if (e.target === reviewFormOverlay) closeReviewForm();
});

// Review star rating
reviewStars.forEach(star => {
  star.addEventListener('click', () => {
    currentReviewRating = parseInt(star.dataset.value);
    updateReviewStarDisplay();
  });
  star.addEventListener('mouseenter', () => {
    const value = parseInt(star.dataset.value);
    reviewStars.forEach(s => {
      const v = parseInt(s.dataset.value);
      s.classList.toggle('active', v <= value || v <= currentReviewRating);
    });
  });
  star.addEventListener('mouseleave', () => {
    updateReviewStarDisplay();
  });
});

function updateReviewStarDisplay() {
  reviewStars.forEach(star => {
    const value = parseInt(star.dataset.value);
    star.classList.toggle('active', value <= currentReviewRating);
  });
}

// ===== Form Handling =====
bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();

  if (!title || !author) {
    alert('Please fill in the title and author fields.');
    return;
  }

  const bookData = {
    title,
    author,
    genre: document.getElementById('book-genre').value.trim(),
    rating: currentRating,
    dateRead: document.getElementById('book-date').value,
    cover: document.getElementById('book-cover').value.trim(),
    notes: document.getElementById('book-notes').value.trim(),
    reviews: [],
  };

  if (editingId) {
    const index = books.findIndex(b => b.id === editingId);
    if (index !== -1) {
      bookData.id = editingId;
      bookData.sharedId = books[index].sharedId;
      bookData.reviews = books[index].reviews || [];
      books[index] = bookData;
    }
  } else {
    bookData.id = makeKey();
    books.unshift(bookData);
  }

  if (sharedMode && supabaseClient) {
    try {
      const target = books.find(b => b.id === bookData.id);
      if (target && target.sharedId) {
        await updateBookShared(target);
      } else if (target) {
        await publishBookToShared(target);
      }
    } catch (err) {
      alert('Could not sync this book online. It was saved locally and will sync on next visit.');
    }
  }

  saveBooks();
  populateGenreFilter();
  closeModal();
  renderBooks();
});

// ===== Star Rating Handling =====
stars.forEach(star => {
  star.addEventListener('click', () => {
    currentRating = parseInt(star.dataset.value);
    updateStarDisplay();
  });

  star.addEventListener('mouseenter', () => {
    const value = parseInt(star.dataset.value);
    setStarsHover(value);
  });

  star.addEventListener('mouseleave', () => {
    updateStarDisplay();
  });
});

function updateStarDisplay() {
  stars.forEach(star => {
    const value = parseInt(star.dataset.value);
    star.classList.toggle('active', value <= currentRating);
  });
}

function setStarsHover(value) {
  stars.forEach(star => {
    const starValue = parseInt(star.dataset.value);
    star.classList.toggle('active', starValue <= value || starValue <= currentRating);
  });
}

// ===== Event Listeners =====
addBookBtn.addEventListener('click', openAddModal);
modalClose.addEventListener('click', closeModal);
formCancel.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeReviewDetail();
    closeReviewForm();
  }
});

searchInput.addEventListener('input', renderBooks);
sortSelect.addEventListener('change', renderBooks);

genreFilter.addEventListener('change', () => {
  genreFilter.dataset.selected = genreFilter.value;
  renderBooks();
});

favoritesToggle.addEventListener('click', () => {
  favoritesOnly = !favoritesOnly;
  favoritesToggle.classList.toggle('active', favoritesOnly);
  renderBooks();
});

// ===== Init =====
const DATA_FILE = './book-tracker-data.json';

const DEMO_BOOKS = [
  {
    id: 'demo1',
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    genre: 'Fiction',
    rating: 5,
    dateRead: '2026-01-15',
    cover: '',
    notes: 'A beautiful journey about following your dreams.',
    favorite: true,
    reviews: [],
  },
  {
    id: 'demo2',
    title: 'Dune',
    author: 'Frank Herbert',
    genre: 'Sci-Fi',
    rating: 4,
    dateRead: '2026-02-20',
    cover: '',
    notes: 'Complex world-building and epic scale.',
    favorite: false,
    reviews: [],
  },
  {
    id: 'demo3',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    genre: 'Romance',
    rating: 4,
    dateRead: '2026-03-10',
    cover: '',
    notes: 'Timeless classic with witty dialogue.',
    favorite: true,
    reviews: [],
  },
];

function normalizeBooks(data) {
  const isValid = Array.isArray(data) && data.every(book =>
    book.title && book.author && typeof book.title === 'string' && typeof book.author === 'string'
  );
  if (!isValid) return false;
  data.forEach(book => {
    if (!book.id) book.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    if (!Array.isArray(book.reviews)) book.reviews = [];
  });
  books = data;
  return true;
}

async function seedIfEmpty() {
  if (books.length > 0) return;

  try {
    const res = await fetch(DATA_FILE);
    if (res.ok) {
      const data = await res.json();
      if (normalizeBooks(data)) {
        saveBooks();
        return;
      }
    }
  } catch (err) {
    // Fetch failed (e.g. opened via file:// or no file bundled) — fall back to demo data.
  }

  books = DEMO_BOOKS.map(book => ({ ...book }));
  saveBooks();
}

async function init() {
  loadTheme();
  loadView();
  loadBooks();
  loadDeleteKeys();
  loadFavorites();
  loadBookDeleteKeys();
  await seedIfEmpty();
  await replaceDemoBooksWithBundled();
  migrateLegacyFavorites();
  initSupabase();
  await fetchSharedReviews();
  await fetchSharedBooks();
  await reconcileBooks();
  populateGenreFilter();
  renderBooks();
}

init();