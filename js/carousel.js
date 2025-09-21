import state from './state.js';
import { extractFilmId, timeToMinutes } from './utils.js';
import { FILTER_LOCKS, setFilterLock, updateFilterLockUI } from './filterLock.js';

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

    for (const movies of Object.values(movieData)) {
        if (!Array.isArray(movies)) {
            continue;
        }

        for (const movie of movies) {
            const filmId = extractFilmId(movie.href);
            if (!filmId) {
                continue;
            }

            const displayTitle = movie.tipoVersion
                ? `${movie.titulo} (${movie.tipoVersion})`
                : movie.titulo;
            const titleLower = displayTitle.toLowerCase();

            if (!moviesByFilmId.has(filmId)) {
                moviesByFilmId.set(filmId, {
                    title: displayTitle,
                    titleLower,
                    filmId,
                    movies: [movie]
                });
            } else {
                moviesByFilmId.get(filmId).movies.push(movie);
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

    return card;
}

function setupPosterCardInteractions(track) {
    const cards = track.querySelectorAll('.poster-card');
    cards.forEach(card => {
        card.addEventListener('click', handlePosterCardClick);
    });
}

function handlePosterCardClick(event) {
    const card = event.currentTarget;
    const filmId = card.dataset.filmId;
    if (!filmId) {
        return;
    }

    if (state.filterLock === FILTER_LOCKS.INPUTS) {
        return;
    }

    const isCurrentSelection = state.carouselFilterFilmId === filmId;

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
