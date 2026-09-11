# Book Tracker

A beautiful, responsive web app for tracking the books you've read, writing reviews, and organizing your reading journey.

## Features

- **Add, edit, and delete books** with title, author, genre, rating, date read, cover image, and notes
- **Star ratings** (1-5) for both books and reviews
- **Reviews** — write and manage multiple reviews per book
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

## Data Storage

All data is stored in your browser's **localStorage**. This means:

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

When you commit `book-tracker-data.json` to the repo, it acts as a **seed for new browsers/devices**. On first run (empty localStorage) the app fetches that bundled file and loads it automatically — so a visitor to your GitHub Pages site sees your book data, not the demo books. After the first run, localStorage takes over as the live store and the bundled file is ignored.

## Project Structure

```
book-tracker/
├── index.html              # Main HTML page
├── styles.css              # All styles (themes, grid, list, modals)
├── app.js                  # All application logic
├── book-tracker-data.json  # Exported data (generated on export)
└── README.md
```

## Tech Stack

- **HTML5** — semantic markup
- **CSS3** — CSS Grid, Flexbox, custom properties, animations
- **JavaScript (ES6+)** — vanilla, no frameworks
- **localStorage** — client-side data persistence
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
