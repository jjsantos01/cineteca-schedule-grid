import state from './state.js';
import { timeToMinutes } from './utils.js';
import { FILTER_LOCKS, setFilterLock, updateFilterLockUI } from './filterLock.js';
import { SEDES } from './config.js';

const POSTER_BASE_URL = 'https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic';

const posterFilmMap = new Map();
let listenersRegistered = false;

export function renderPosterCarousel(movieData, { isLoading = false } = {}) {
    const container = document.getElementById('posterCarousel');
    if (!container) {
        return;
    }

    ensureGlobalListeners();

    const uniqueMovies = collectUniqueMoviesWithPoster(movieData);
    container.innerHTML = '';

    if (uniqueMovies.length === 0) {
        const hasMovies = Object.values(movieData).some(movies => Array.isArray(movies) && movies.length > 0);
        const message = isLoading
            ? 'Cargando posters disponibles...'
            : hasMovies
                ? 'No se encontraron posters para las películas actuales.'
                : 'Selecciona una fecha y sede con funciones disponibles para ver los posters.';

        const emptyState = document.createElement('div');
        emptyState.className = 'poster-carousel-empty';
        emptyState.textContent = message;
        container.appendChild(emptyState);
        updatePosterCarouselHighlights();
        updateFilterLockUI();
        return;
    }

    const track = document.createElement('div');
    track.className = 'poster-carousel-track';
    track.setAttribute('role', 'list');

    for (const movie of uniqueMovies) {
        const card = createPosterCard(movie);
        track.appendChild(card);
    }

    container.appendChild(track);
    setupPosterCardInteractions(track);
    updatePosterCarouselHighlights();
    updateFilterLockUI();
}

export function selectFilmInCarousel(filmId, fallbackTitle = '') {
    const container = document.getElementById('posterCarousel');
    const card = container ? container.querySelector(`.poster-card[data-film-id="${filmId}"]`) : null;
    
    // Si no hay tarjeta (ej. sin poster), usamos el fallbackTitle
    const title = card ? card.dataset.filterTitle : fallbackTitle;
    if (!filmId) return;

    state.carouselFilterFilmId = filmId;
    setFilterLock(FILTER_LOCKS.CAROUSEL);
    document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', { detail: { filmId, title } }));
    updatePosterCarouselHighlights();
    updateFilterLockUI();
}

export function clearCarouselSelection() {
    const previous = state.carouselFilterFilmId;
    state.carouselFilterFilmId = null;
    setFilterLock(FILTER_LOCKS.NONE);
    document.dispatchEvent(new CustomEvent('posterCarousel:clearFilter', { detail: { filmId: previous } }));
    updatePosterCarouselHighlights();
    updateFilterLockUI();
}

function ensureGlobalListeners() {
    if (listenersRegistered) {
        return;
    }

    document.addEventListener('filters:updated', () => {
        updatePosterCarouselHighlights();
    });

    document.addEventListener('filterLock:changed', () => {
        updatePosterCarouselHighlights();
    });

    listenersRegistered = true;
}

function collectUniqueMoviesWithPoster(movieData) {
    posterFilmMap.clear();
    const moviesByFilmId = new Map();

    for (const [sedeId, movies] of Object.entries(movieData)) {
        if (!Array.isArray(movies)) {
            continue;
        }

        for (const movie of movies) {
            const filmId = movie.filmId;
            if (!filmId) {
                continue;
            }

            const currentSedeId = sedeId || movie.sedeId;
            const displayTitle = movie.displayTitle;
            const titleLower = displayTitle.toLowerCase();

            if (!moviesByFilmId.has(filmId)) {
                moviesByFilmId.set(filmId, {
                    title: displayTitle,
                    titleLower,
                    filmId,
                    movies: [movie],
                    sedeIds: new Set(currentSedeId ? [currentSedeId] : [])
                });
            } else {
                const entry = moviesByFilmId.get(filmId);
                entry.movies.push(movie);
                if (currentSedeId) {
                    entry.sedeIds.add(currentSedeId);
                }
            }
        }
    }

    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    const uniqueMovies = Array.from(moviesByFilmId.values()).sort((a, b) => collator.compare(a.title, b.title));

    for (const movie of uniqueMovies) {
        posterFilmMap.set(movie.filmId, movie);
    }

    return uniqueMovies;
}

function createPosterCard(movie) {
    const card = document.createElement('article');
    card.className = 'poster-card';
    card.setAttribute('role', 'listitem');
    card.dataset.filmId = movie.filmId;
    card.dataset.filterTitle = movie.title;
    card.dataset.titleLower = movie.titleLower;

    const title = document.createElement('h3');
    title.className = 'poster-card-title';
    title.textContent = movie.title;

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'poster-card-image-wrapper';

    const image = document.createElement('img');
    image.className = 'poster-card-image';
    image.src = `${POSTER_BASE_URL}/${movie.filmId}`;
    image.alt = `Poster de ${movie.title}`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => handlePosterError(imageWrapper, image));

    imageWrapper.appendChild(image);
    card.appendChild(title);
    card.appendChild(imageWrapper);

    if (movie.sedeIds && movie.sedeIds.size > 0) {
        const sedesContainer = document.createElement('div');
        sedesContainer.className = 'poster-card-sedes';

        // Orden consistente: CNA ('002'), XOCO ('003'), CHAPULTEPEC ('001')
        const sedeOrder = { '002': 1, '003': 2, '001': 3 };
        const sortedSedeIds = Array.from(movie.sedeIds)
            .filter(id => SEDES[id])
            .sort((a, b) => (sedeOrder[a] || 99) - (sedeOrder[b] || 99));

        for (const sedeId of sortedSedeIds) {
            const sede = SEDES[sedeId];
            const tag = document.createElement('span');
            tag.className = `poster-card-sede-tag ${sede.className}`;
            tag.textContent = sede.codigo;
            tag.title = sede.nombre;
            sedesContainer.appendChild(tag);
        }

        card.appendChild(sedesContainer);
    }

    return card;
}

function setupPosterCardInteractions(track) {
    const cards = track.querySelectorAll('.poster-card');
    cards.forEach(card => {
        card.addEventListener('click', handlePosterCardClick);
    });
}

let lastClickTime = 0;
let lastClickedFilmId = null;

function handlePosterCardClick(event) {
    const card = event.currentTarget;
    const filmId = card.dataset.filmId;
    if (!filmId) {
        return;
    }

    if (state.filterLock === FILTER_LOCKS.INPUTS) {
        return;
    }

    const currentTime = new Date().getTime();
    const isDoubleClick = (currentTime - lastClickTime) < 400 && lastClickedFilmId === filmId;
    lastClickTime = currentTime;
    lastClickedFilmId = filmId;

    const isCurrentSelection = state.carouselFilterFilmId === filmId;

    if (isDoubleClick) {
        state.carouselFilterFilmId = filmId;
        setFilterLock(FILTER_LOCKS.CAROUSEL);
        document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', {
            detail: {
                filmId,
                title: card.dataset.filterTitle || '',
                forceOpenInfo: true
            }
        }));
        updatePosterCarouselHighlights();
        return;
    }

    if (isCurrentSelection) {
        state.carouselFilterFilmId = null;
        setFilterLock(FILTER_LOCKS.NONE);
        document.dispatchEvent(new CustomEvent('posterCarousel:clearFilter', {
            detail: { filmId }
        }));
        updatePosterCarouselHighlights();
        return;
    }

    state.carouselFilterFilmId = filmId;
    setFilterLock(FILTER_LOCKS.CAROUSEL);
    document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', {
        detail: {
            filmId,
            title: card.dataset.filterTitle || ''
        }
    }));
    updatePosterCarouselHighlights();
}

function updatePosterCarouselHighlights() {
    const container = document.getElementById('posterCarousel');
    if (!container) {
        return;
    }

    const cards = container.querySelectorAll('.poster-card');
    if (cards.length === 0) {
        return;
    }

    let selectedFilmId = state.carouselFilterFilmId;
    if (selectedFilmId && !posterFilmMap.has(selectedFilmId)) {
        state.carouselFilterFilmId = null;
        selectedFilmId = null;
        if (state.filterLock === FILTER_LOCKS.CAROUSEL) {
            setFilterLock(FILTER_LOCKS.NONE);
        }
    }

    const hasSelectedFilm = Boolean(selectedFilmId);
    const hasTextFilter = state.movieFilter !== '';
    const hasTimeFilter = Boolean(state.timeFilterStart || state.timeFilterEnd);
    const hasActiveFilters = hasTextFilter || hasTimeFilter;

    cards.forEach(card => {
        const filmId = card.dataset.filmId;
        const filmData = posterFilmMap.get(filmId);
        const matchesFilters = filmMatchesActiveFilters(filmData);
        const isSelected = hasSelectedFilm && selectedFilmId === filmId;

        card.classList.toggle('poster-card--selected', isSelected || (!hasSelectedFilm && hasActiveFilters && matchesFilters));
        card.classList.toggle('poster-card--dimmed',
            hasSelectedFilm ? selectedFilmId !== filmId : (hasActiveFilters ? !matchesFilters : false)
        );
    });
}

function filmMatchesActiveFilters(filmData) {
    if (!filmData) {
        return false;
    }

    if (state.movieFilter && !filmData.titleLower.includes(state.movieFilter)) {
        return false;
    }

    if (!state.timeFilterStart && !state.timeFilterEnd) {
        return true;
    }

    const startMinutes = state.timeFilterStart ? timeToMinutes(state.timeFilterStart) : 0;
    const endMinutes = state.timeFilterEnd ? timeToMinutes(state.timeFilterEnd) : 24 * 60;

    return filmData.movies.some(movie =>
        Array.isArray(movie.horarios) && movie.horarios.some(horario => {
            const minutes = timeToMinutes(horario);
            return minutes >= startMinutes && minutes <= endMinutes;
        })
    );
}

function handlePosterError(wrapper, image) {
    image.remove();
    wrapper.classList.add('poster-card-image-wrapper--error');
    const fallback = document.createElement('div');
    fallback.className = 'poster-card-image-fallback';
    fallback.textContent = 'Poster no disponible';
    wrapper.appendChild(fallback);
}
