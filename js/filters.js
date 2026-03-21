import state from './state.js';
import { timeToMinutes } from './utils.js';
import { getEnrichedShowtime } from './movieUtils.js';
import { FILTER_LOCKS } from './filterLock.js';

export function applyFilters() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    let textMatchCount = 0;
    let timeMatchCount = 0;

    movieBlocks.forEach(block => {
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const movieTitle = (movie.displayTitle || movie.titulo).toLowerCase();
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
    updateSedeResultCounts();
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

/**
 * Actualiza los encabezados de sede con el número de resultados visibles.
 * Si el filtro es de carrusel, también muestra los horarios encontrados.
 */
function updateSedeResultCounts() {
    const sedeHeaders = document.querySelectorAll('h2.sede-header');

    sedeHeaders.forEach(header => {
        // Eliminar subtítulo previo si existe
        const existing = header.querySelector('.sede-filter-count');
        if (existing) existing.remove();
    });

    if (!hasActiveFilters()) {
        return;
    }

    const isCarouselFilter = state.filterLock === FILTER_LOCKS.CAROUSEL;

    // Acumular resultados por sede-block
    const sedeBlockResults = new Map(); // sedeBlock -> { count, horarios: Set }

    document.querySelectorAll('.movie-block:not(.filtered-out)').forEach(block => {
        const sedeBlock = block.closest('.sede-block');
        if (!sedeBlock) return;

        if (!sedeBlockResults.has(sedeBlock)) {
            sedeBlockResults.set(sedeBlock, { count: 0, horarios: [] });
        }

        const entry = sedeBlockResults.get(sedeBlock);
        entry.count++;

        if (isCarouselFilter) {
            const horario = block.dataset.horario;
            if (horario && !entry.horarios.includes(horario)) {
                entry.horarios.push(horario);
            }
        }
    });

    // Asociar cada sede-block con su h2.sede-header (es el hermano anterior)
    sedeHeaders.forEach(header => {
        // El siguiente elemento hermano del h2 es el .sede-block
        let sedeBlock = header.nextElementSibling;
        // Puede haber separadores u otros elementos intercalados
        while (sedeBlock && !sedeBlock.classList.contains('sede-block')) {
            sedeBlock = sedeBlock.nextElementSibling;
        }
        if (!sedeBlock) return;

        const result = sedeBlockResults.get(sedeBlock);
        const count = result ? result.count : 0;

        const small = document.createElement('small');
        small.className = 'sede-filter-count';

        if (count === 0) {
            small.textContent = 'Sin resultados';
            small.classList.add('sede-filter-count--empty');
        } else {
            const label = count === 1 ? '1 resultado' : `${count} resultados`;

            if (isCarouselFilter && result.horarios.length > 0) {
                const horariosSorted = [...result.horarios].sort();
                const showtimesText = formatHorariosList(horariosSorted);
                small.textContent = `${label} a las ${showtimesText}`;
            } else {
                small.textContent = label;
            }
        }

        header.appendChild(small);
    });
}

/**
 * Formatea una lista de horarios en texto legible.
 * Ejemplo: ['15:00', '17:00', '21:00'] -> '15:00, 17:00 y 21:00'
 */
function formatHorariosList(horarios) {
    if (horarios.length === 1) return horarios[0];
    if (horarios.length === 2) return `${horarios[0]} y ${horarios[1]}`;
    const last = horarios[horarios.length - 1];
    const rest = horarios.slice(0, -1).join(', ');
    return `${rest} y ${last}`;
}
