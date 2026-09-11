# Book Tracker

A beautiful, responsive web app for tracking the books you've read, writing reviews, and organizing your reading journey.

## Features

- **Add, edit, and delete books** with title, author, genre, rating, date read, cover image, and notes
- **Star ratings** (1-5) for both books and reviews
- **Reviews** — write and manage multiple reviews per book, with the reviewer's name and avatar
- **Shared books & reviews (optional)** — sync books and reviews across all visitors via Supabase (zero-config fallback to local); favorites stay per-device
- **Grid & List views** — toggle between card grid and compact row layout
- **Search** — real-time filtering by title or author
- **Sort** — by date, title, or rating (ascending/descending)
- **Genre filter** — dynamically populated from your book data
- **Favorites** — heart-toggle and filter to show only favorites
- **Stats dashboard** — total books, favorites count, average rating
- **3 themes** — Light, Dark, and Colorful (cycles via theme button)
- **Export/Import** — download your data as JSON, import it on another browser or device
- **Persistent preferences** — theme and view mode remembered across sessions
- **Responsive design** — works on desktop, tablet, and mobile

## Getting Started

No build tools or dependencies required. Just open the app in your browser:

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (optional)
npx serve .
# or
python -m http.server 8000
```

## Testing Locally & on GitHub Pages

> **Important:** For shared reviews (and full Supabase sync) to work, serve the app over `http://`/`https://` — **not** by double-clicking `index.html` (`file://`). A few things require http(s): the Supabase client and Google Fonts load over the network, and `fetch()` of the bundled data JSON is blocked on `file://`.

**Local test steps:**

1. From the project folder, start a server:
   ```bash
   npx serve .
   # or
   python -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser.
3. **Verify basic book features:** books load from `book-tracker-data.json`, Add/Edit/Delete work, and clicking a book opens its details + reviews.
4. **Verify shared reviews:** click a book → "Add Review" → enter your name, rate it, and save. The panel shows "🌐 Reviews are shared with all visitors." Repeat in another browser (or checkout/incognito window) and the review appears there too. Only the browser that created a review shows its **Delete** button.
5. Verify the review badge count updates on the card.
6. **Verify shared books:** in one browser add a book (form → Add Book). Open a second/incognito window; the new book appears there too (after reload). Edit the book in one browser and reload the other — the change is reflected. Deleting a book you added removes it for everyone; books added on other devices don't show a **Delete** button for you (only the creating browser owns the delete key). Favorites (♥) stay per-device — a favorite set in one browser does not appear in another.

**Verify it on GitHub Pages:**

1. Commit and push the repo to GitHub, then enable Pages (**Settings > Pages** → source: `main` branch). The site is live at `https://<username>.github.io/book-tracker/`.
2. Open the live URL (not `localhost`) and repeat step 4 with two different devices/browsers. Because Pages is served over `https://`, everything — including `crypto.randomUUID()` delete-key generation — works everywhere.

> Reminder: an empty browser (or a cleared cache) loads the bundled `book-tracker-data.json` as seed data, then uses `localStorage` from then on.

## Data Storage

Books, settings, and their local reviews are stored in your browser's **localStorage**. This means:

- Data persists across page reloads and browser restarts
- Data is tied to the specific browser on this machine
- Clearing browser data will delete your books

### Export / Import

Use the **Export** button to save all your data as a `book-tracker-data.json` file. Use the **Import** button to load it back — on the same browser or a different one.

**Two export modes:**

- **Direct save into a folder of your choice** — works when the app is served over `http://`/`https://` (local server or GitHub Pages) in **Chrome/Edge**. The browser opens a save dialog — navigate to your project folder and the file is written directly there (even overwriting an existing file).
- **Standard download** — the fallback when the app is opened as `file://` directly or used in Firefox/Safari. The file downloads to your Downloads folder; move it into the project folder afterward.

This is the recommended way to:
- Back up your data
- Transfer data between browsers or machines
- Move data if you clear your browser
- **Commit your data to git** — export `book-tracker-data.json` into the project folder, then `git add` + `git commit` it alongside your code.

### Bundled data auto-load

When you commit `book-tracker-data.json` to the repo, it acts as a **seed for new browsers/devices**. On first run (empty localStorage) the app fetches that bundled file and loads it automatically — so a visitor to your GitHub Pages site sees your book data, not the demo books. After the first run, localStorage takes over as the live store and the bundled file is ignored. (With shared books enabled, leftover demo seed books are swapped for the bundled data so the demo entries don't get published to the shared table.)

### Shared reviews & books (Supabase)

Books and reviews can optionally sync across all visitors via a free **Supabase** project — so friends visiting your GitHub Pages site can add books and reviews that everyone sees, while each browser keeps its own **favorites** locally.

**How it works:**

- Each visitor adds reviews with their **name**; the app stores the name for next time.
- Reviews live in a shared Supabase table, grouped by the book's stable `id`.
- Deleting a review requires a **delete key** that is randomly generated and stored in the reviewer's own browser. Only the browser that created a review can delete it (nobody else can, including the site owner via the UI).
- Books are synced the same way: a shared `books` table stores the canonical title/author/genre/rating/date/cover/notes per stable book key. When you add or edit a book, it updates the shared table; any browser that loads the app merges the shared books in. A book added on another device appears on yours.
- Deleting a book works like reviews — only the browser that added the book (or re-synced it) holds its delete key and sees the Delete button.
- **Favorites are per-device** and never uploaded. One browser's favorites don't affect another's.
- On first upgrade, any existing local books are automatically published to the shared table (so they appear everywhere); the old demo seed books are replaced with the bundled data instead of being published.
- If Supabase is not configured or unreachable (e.g. a free project paused after 7 days of inactivity), the app silently falls back to local books and reviews.

**One-time setup (5 min):**

1. Create a free project at https://supabase.com
2. In the Supabase dashboard, go to **SQL Editor**:
   - **New project:** run the entire contents of [`supabase-setup.sql`](supabase-setup.sql) — it creates the `reviews`/`review_delete_keys` and `books`/`book_delete_keys` tables, row-level security policies, and the `add_review`/`delete_review`/`add_book`/`delete_book` functions.
   - **Existing project (already ran `supabase-setup.sql`):** run [`supabase-upgrade-books.sql`](supabase-upgrade-books.sql) to add the books tables and functions.
3. In **Project Settings > API**, copy the **Project URL** and the **anon** **public** key.
4. Open [`config.js`](config.js) and paste them in:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
     SUPABASE_ANON_KEY: 'your-anon-public-key-here',
   };
   ```
5. Reload the app. The review panel now shows **"Reviews are shared with all visitors."**

The anon key is a **public** key (safe to commit) — row-level security and the SECURITY DEFINER functions enforce that visitors can only add books/reviews or delete a record when they present the matching delete key.

## Project Structure

```
book-tracker/
├── index.html              # Main HTML page
├── styles.css              # All styles (themes, grid, list, modals)
├── app.js                  # All application logic
├── config.js               # Supabase URL + anon key (fill in your values)
├── supabase-setup.sql      # SQL to run once in Supabase SQL Editor (new project)
├── supabase-upgrade-books.sql  # SQL to run once on projects that already ran supabase-setup.sql
├── book-tracker-data.json  # Exported data (generated on export)
└── README.md
```

## Tech Stack

- **HTML5** — semantic markup
- **CSS3** — CSS Grid, Flexbox, custom properties, animations
- **JavaScript (ES6+)** — vanilla, no frameworks
- **localStorage** — client-side data persistence
- **Supabase (optional)** — shared books & reviews with row-level security (no auth, no build step)
- **Google Fonts** — Inter (300-800)

Zero dependencies. No build step. No bundler.

## Hosting on GitHub Pages

This app is fully static and works perfectly with GitHub Pages:

1. Push this repo to GitHub
2. Go to **Settings > Pages**
3. Set source to your main branch
4. Your app will be live at `https://<username>.github.io/book-tracker/`

For a custom domain, add a `CNAME` file with your domain name and configure your DNS to point to GitHub Pages.

## License

Free to use and modify.
