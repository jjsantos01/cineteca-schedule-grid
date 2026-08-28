# Repository Guidelines

## Project Structure & Module Organization
- Entry point: `index.html` loads ES modules from `js/` and styles from `css/styles.css`.
- Scripts live in `js/` as focused modules (e.g., `app.js`, `grid.js`, `modal.js`, `filters.js`, `dataLoader.js`, `state.js`, `urlState.js`, `utils.js`, `config.js`, `cache.js`, `tooltip.js`, `carousel.js`, `helpModal.js`, `tour.js`).
- Styles in `css/` are modularized by component and orchestrated via `css/styles.css` (`variables.css`, `base.css`, `filters.css`, `grid.css`, `tooltip.css`, `modal.css`, `carousel.css`, `help.css`, `tour.css`); images and screenshots in `img/`.
- Complete modular documentation for agents is located in [`docs/README.md`](docs/README.md).
- The `src/` folder is currently unused.

## Agent Documentation & Architecture Map
- Full technical documentation is available in [`docs/`](docs/README.md).
- Before implementing features or planning changes, consult [`docs/README.md`](docs/README.md) for the quick routing guide, module contracts, and state models.

## Build, Test, and Development Commands
- No build step or package manager; this is a static site.
- Run locally via a simple web server:
  - VS Code Live Server: open `index.html` → “Open with Live Server”.
  - Or Python: `python3 -m http.server 5500` then visit `http://localhost:5500/`.
- Data comes from the proxy in `js/config.js` (`API_BASE_URL`).

## Coding Style & Naming Conventions
- Language: vanilla ES modules; keep browser compatibility in mind.
- Indentation: 4 spaces; use semicolons; prefer `const`/`let`.
- Filenames and variables: `camelCase`; modules are singular and feature-scoped (e.g., `filterLock.js`).
- Keep UI text in Spanish to match the app; code/comments may be English.
- No bundlers or frameworks; avoid introducing deps unless discussed.

## Testing Guidelines
- No formal test framework. Validate flows manually:
  - Load day data, toggle sedes, apply text/time filters, select movies, open modal, navigate prev/next, copy share URL.
  - Verify URL sync and cache behavior (see `cache.js`, `urlState.js`).
- Cross-browser sanity: latest Chrome/Firefox; mobile viewport checks.

## Commit & Pull Request Guidelines
- Use Conventional Commit prefixes when possible: `feat:`, `fix:`, `refactor:`, `chore:`.
- Keep commits scoped and descriptive. Example: `feat: add poster carousel filtering and locking rules`.
- PRs must include:
  - Summary, motivation, and screenshots/GIFs for UI changes.
  - Repro steps and manual test notes.
  - Any config changes (e.g., `API_BASE_URL`) highlighted.

## Security & Configuration Tips
- Do not commit secrets; the app only uses the public proxy in `js/config.js`.
- Handle network failures gracefully in data loaders; avoid inline third‑party scripts.
