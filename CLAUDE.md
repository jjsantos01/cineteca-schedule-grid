# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web application that visualizes the Cineteca Nacional de México movie schedule in an alternative grid format. The app is a static site built with vanilla JavaScript ES modules, no build tools or frameworks.

## Development Commands

**Running locally:**
- VS Code: Right-click `index.html` → "Open with Live Server"
- Python: `python3 -m http.server 5500` then visit `http://localhost:5500/`

**No build, test, or package manager commands** - this is a static site served directly from files.

## Architecture Overview

### Data Flow
1. **Entry Point**: `app.js` initializes the application on DOMContentLoaded
2. **State Management**: Centralized in `state.js` - all application state lives here (current date, selected venues, filters, loading states, etc.)
3. **Data Loading**: `dataLoader.js` orchestrates fetching movie data via `api.js`, using `cache.js` for performance
4. **Rendering**: `grid.js` renders the schedule grid, `carousel.js` renders movie posters
5. **URL Sync**: `urlState.js` keeps browser URL in sync with application state for shareable links

### Key Modules

**Core State & Data:**
- `state.js` - Single source of truth for all application state
- `config.js` - Constants (API endpoint, venue definitions, dimensions)
- `dataLoader.js` - Loads movie data for selected venues/dates
- `api.js` - Fetches data from Cloudflare worker proxy
- `cache.js` - LocalStorage caching with 7-day expiration
- `parser.js` - Parses movie data from API responses

**UI Rendering:**
- `grid.js` - Main schedule grid with time axis and movie blocks
- `carousel.js` - Horizontal poster carousel at top
- `modal.js` - Full movie info modal with navigation
- `tooltip.js` - Hover tooltips on movie blocks
- `inlineInfo.js` - Inline expandable movie info panel below carousel

**User Interactions:**
- `filters.js` - Movie name and time range filtering
- `filterLock.js` - Manages mutual exclusion between carousel and text input filters
- `selection.js` - Multi-select movies to see schedule conflicts
- `visited.js` - Tracks which movies user has clicked (visual indicator)
- `showtimes.js` - Parses and displays all showtimes for a movie
- `calendar.js` - Calendar file (.ics) generation for movie reminders

**State Synchronization:**
- `urlState.js` - Bidirectional sync between app state and URL query params

### Filter Lock System

A unique feature that prevents conflicting filter inputs:
- **CAROUSEL lock**: When user clicks a poster, text/time filters are disabled
- **INPUTS lock**: When user types in filters, carousel clicking is visually restricted
- **NONE**: No locks active
- Implementation in `filterLock.js`, coordinated by `app.js`

### API Integration

The app fetches from a Cloudflare Worker proxy (configured in `config.js` as `API_BASE_URL`):
```
https://cinetk.jjsantosochoa.workers.dev/?cinemaId={cinemaId}&dia={fecha}
```
- `cinemaId`: 001 (Chapultepec), 002 (CENART), 003 (XOCO)
- `fecha`: YYYY-MM-DD format

Data is cached in LocalStorage per venue/date combination, cleaned up after 7 days.

## Code Style

- **Language**: Spanish for UI text, English acceptable for code/comments
- **Indentation**: 4 spaces
- **Naming**: camelCase for variables/functions, singular filenames
- **Modules**: ES6 modules, imports at top
- **State**: Always import and modify through `state.js`, never create local state copies

## Common Patterns

**Adding a new filter:**
1. Add state property in `state.js`
2. Create filter logic in `filters.js`
3. Update `urlState.js` to sync with URL
4. Apply filter in `grid.js` or `carousel.js`
5. Wire up UI event in `app.js`

**Adding a new venue:**
1. Add venue config to `SEDES` object in `config.js`
2. Add checkbox in `index.html` header
3. Wire event listener in `app.js`
4. Update CSS for venue color indicators

**Modifying movie info display:**
- Modal content: `modal.js` (function `buildMovieInfoContent`)
- Inline panel: `inlineInfo.js` (uses shared builder from `modal.js`)
- Tooltip: `tooltip.js`

## Important Notes

- **No dependencies**: Keep the project dependency-free, vanilla JS only
- **Browser compatibility**: Target modern browsers, test in Chrome/Firefox
- **LocalStorage keys**: Prefixed with `cinetk` (see `config.js`)
- **Time calculations**: Use `timeToMinutes`/`minutesToTime` from `utils.js` for consistency
- **Movie identity**: Use `extractFilmId()` from `utils.js` to get unique film ID from URL/title
- **Visited tracking**: Movies are marked as visited when clicked, persisted in LocalStorage
- **Responsive design**: Mobile-friendly, check viewport behavior for UI changes
