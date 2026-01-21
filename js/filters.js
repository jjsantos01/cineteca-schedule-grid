import state from './state.js';
import { timeToMinutes } from './utils.js';
import { getEnrichedShowtime } from './movieUtils.js';

export function applyFilters() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    let textMatchCount = 0;
    let timeMatchCount = 0;

    movieBlocks.forEach(block => {
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const movieTitle = movie.titulo.toLowerCase();
        const horario = block.dataset.horario;

        const passesTextFilter = state.movieFilter === '' || movieTitle.includes(state.movieFilter);

        let passesTimeFilter = true;
        if (state.timeFilterStart || state.timeFilterEnd) {
            const enriched = getEnrichedShowtime(movie, horario);
            const filterStartMinutes = state.timeFilterStart ? timeToMinutes(state.timeFilterStart) : 0;
            const filterEndMinutes = state.timeFilterEnd ? timeToMinutes(state.timeFilterEnd) : 24 * 60;
            passesTimeFilter = enriched.startMinutes >= filterStartMinutes && enriched.startMinutes <= filterEndMinutes;
        }

        if (passesTextFilter && passesTimeFilter) {
            block.classList.remove('filtered-out');
            if (state.movieFilter !== '') textMatchCount++;
            if (state.timeFilterStart || state.timeFilterEnd) timeMatchCount++;
        } else {
            block.classList.add('filtered-out');
        }
    });

    const filterResults = document.getElementById('filterResults');
    if (filterResults) {
        filterResults.textContent = state.movieFilter !== ''
            ? `${textMatchCount} coincidencias encontradas`
            : '';
    }

    const timeFilterResults = document.getElementById('timeFilterResults');
    if (timeFilterResults) {
        timeFilterResults.textContent = (state.timeFilterStart || state.timeFilterEnd)
            ? `${timeMatchCount} películas en rango`
            : '';
    }

    highlightRoomsWithVisibleMovies();
    document.dispatchEvent(new CustomEvent('filters:updated'));
}

export function setMovieFilter(filterText) {
    state.movieFilter = filterText.toLowerCase();
    applyFilters();
    return state.movieFilter;
}

export function setTimeFilter(start, end) {
    state.timeFilterStart = start;
    state.timeFilterEnd = end;
    applyFilters();
    return {
        start: state.timeFilterStart,
        end: state.timeFilterEnd
    };
}

export function clearTimeFilter() {
    state.timeFilterStart = '';
    state.timeFilterEnd = '';
    applyFilters();
}

export function hasActiveFilters() {
    return Boolean(state.movieFilter || state.timeFilterStart || state.timeFilterEnd);
}

/**
 * Resalta las filas del grid que contienen películas visibles (no filtradas)
 * Solo se ejecuta cuando hay filtros activos
 */
function highlightRoomsWithVisibleMovies() {
    // Limpiar todas las filas
    document.querySelectorAll('.room-row.has-visible-movies')
        .forEach(row => row.classList.remove('has-visible-movies'));

    // Si no hay filtros activos, no resaltar nada
    if (!hasActiveFilters()) {
        return;
    }

    // Crear Set de filas que tienen películas visibles
    const roomsWithVisibleMovies = new Set();

    document.querySelectorAll('.movie-block:not(.filtered-out)')
        .forEach(block => {
            const roomRow = block.closest('.room-row');
            if (roomRow) {
                roomsWithVisibleMovies.add(roomRow);
            }
        });

    // Aplicar clase a las filas encontradas
    roomsWithVisibleMovies.forEach(row => {
        row.classList.add('has-visible-movies');
    });
}
