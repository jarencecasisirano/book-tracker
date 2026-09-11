// ===== State Management =====
let books = [];
let currentRating = 0;
let editingId = null;
let favoritesOnly = false;
let currentView = 'grid';
let currentReviewBookId = null;
let currentReviewRating = 0;
let editingReviewId = null;

const STORAGE_KEY = 'bookTrackerBooks';
const THEME_KEY = 'bookTrackerTheme';
const VIEW_KEY = 'bookTrackerView';

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
  const reviewCount = (book.reviews || []).length;

  card.innerHTML = `
    <div class="card-cover" data-gradient="${hasCover ? '' : gradientNum}">
      ${hasCover
        ? `<img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} cover" onerror="handleImageError(this)">`
        : '<span class="no-cover">📖</span>'
      }
      <div class="card-actions-top">
        <button class="btn-fav ${book.favorite ? 'active' : ''}" data-action="fav" title="Toggle favorite">♥</button>
        <button class="btn-edit" data-action="edit" title="Edit book">✏️</button>
        <button class="btn-delete" data-action="delete" title="Delete book">🗑️</button>
      </div>
    </div>
    <div class="card-body">
      <div class="card-genre genre-${getGenreClass(book.genre)}">${escapeHtml(book.genre || 'General')}</div>
      <h3 class="card-title">${escapeHtml(book.title)}</h3>
      <p class="card-author">by ${escapeHtml(book.author)}</p>
      ${book.rating > 0 ? `<div class="card-rating">${ratingStars}</div>` : ''}
      ${book.dateRead ? `<div class="card-date">📅 ${escapeHtml(formatDate(book.dateRead))}</div>` : ''}
      ${book.notes ? `<p class="card-notes">💭 ${escapeHtml(book.notes)}</p>` : ''}
      <button class="review-badge" data-action="reviews" title="View reviews">
        💬 ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}
      </button>
    </div>
  `;

  card.querySelector('[data-action="fav"]').addEventListener('click', () => toggleFavorite(book.id));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(book.id));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteBook(book.id, card));
  card.querySelector('[data-action="reviews"]').addEventListener('click', () => openReviewDetail(book.id));

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
  const reviewCount = (book.reviews || []).length;

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
      <button class="review-badge" data-action="reviews" title="View reviews">
        💬 ${reviewCount}
      </button>
    </div>
    <div class="book-row-actions">
      <button class="btn-fav ${book.favorite ? 'active' : ''}" data-action="fav" title="Toggle favorite">♥</button>
      <button data-action="edit" title="Edit book">✏️</button>
      <button data-action="delete" title="Delete book">🗑️</button>
    </div>
  `;

  row.querySelector('[data-action="fav"]').addEventListener('click', () => toggleFavorite(book.id));
  row.querySelector('[data-action="edit"]').addEventListener('click', () => openEditModal(book.id));
  row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteBook(book.id, row));
  row.querySelector('[data-action="reviews"]').addEventListener('click', () => openReviewDetail(book.id));

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
  div.textContent = str;
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
    book.favorite = !book.favorite;
    saveBooks();
    renderBooks();
  }
}

function deleteBook(id, card) {
  card.classList.add('removing');
  setTimeout(() => {
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

// ===== Review CRUD =====
function openReviewDetail(bookId) {
  currentReviewBookId = bookId;
  editingReviewId = null;
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  reviewDetailTitle.textContent = `Reviews — ${book.title}`;
  renderReviewList(book);
  reviewDetailOverlay.classList.add('active');
}

function closeReviewDetail() {
  reviewDetailOverlay.classList.remove('active');
  currentReviewBookId = null;
}

function renderReviewList(book) {
  const reviews = book.reviews || [];
  reviewDetailEmpty.classList.toggle('hidden', reviews.length > 0);

  reviewList.innerHTML = '';
  reviews.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="review-card-header">
        <div class="review-card-rating">${renderStars(review.rating || 0)}</div>
        <span class="review-card-date">${escapeHtml(formatDate(review.date))}</span>
      </div>
      ${review.text ? `<div class="review-card-text">${escapeHtml(review.text)}</div>` : ''}
      <div class="review-card-actions">
        <button class="review-delete-btn" data-review-id="${review.id}">Delete</button>
      </div>
    `;
    card.querySelector('.review-delete-btn').addEventListener('click', () => {
      deleteReview(book.id, review.id);
    });
    reviewList.appendChild(card);
  });
}

function openReviewForm(bookId) {
  currentReviewBookId = bookId;
  editingReviewId = null;
  reviewFormTitle.textContent = 'Add Review';
  reviewForm.reset();
  currentReviewRating = 0;
  updateReviewStarDisplay();
  reviewFormOverlay.classList.add('active');
}

function closeReviewForm() {
  reviewFormOverlay.classList.remove('active');
}

function addReview(bookId, reviewData) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;
  if (!book.reviews) book.reviews = [];

  const review = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    text: reviewData.text,
    rating: reviewData.rating,
    date: new Date().toISOString().split('T')[0],
  };

  book.reviews.push(review);
  saveBooks();
  renderReviewList(book);
}

function deleteReview(bookId, reviewId) {
  const book = books.find(b => b.id === bookId);
  if (!book || !book.reviews) return;

  book.reviews = book.reviews.filter(r => r.id !== reviewId);
  saveBooks();
  renderReviewList(book);
  renderBooks();
}

// Review form submit
reviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentReviewBookId) return;

  addReview(currentReviewBookId, {
    text: reviewText.value.trim(),
    rating: currentReviewRating,
  });

  closeReviewForm();
  renderBooks();
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
bookForm.addEventListener('submit', (e) => {
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
    favorite: false,
    reviews: [],
  };

  if (editingId) {
    const index = books.findIndex(b => b.id === editingId);
    if (index !== -1) {
      bookData.id = editingId;
      bookData.favorite = books[index].favorite;
      bookData.reviews = books[index].reviews || [];
      books[index] = bookData;
    }
  } else {
    bookData.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    books.unshift(bookData);
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
loadTheme();
loadView();
loadBooks();
populateGenreFilter();

// Seed with demo data if empty
if (books.length === 0) {
  books = [
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
  saveBooks();
}

renderBooks();
