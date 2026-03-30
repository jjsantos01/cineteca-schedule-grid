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
    const containers = Array.from(document.querySelectorAll('.sede-container'));

    containers.forEach(container => {
        const header = container.querySelector('h2.sede-header');
        if (header) {
            const existing = header.querySelector('.sede-filter-count');
            if (existing) existing.remove();
        }
    });

    const isCarouselFilter = state.filterLock === FILTER_LOCKS.CAROUSEL;
    const filterActive = hasActiveFilters();

    const containerStats = new Map();

    containers.forEach(container => {
        containerStats.set(container, { count: 0, horarios: [] });
    });

    if (filterActive) {
        document.querySelectorAll('.movie-block:not(.filtered-out)').forEach(block => {
            const container = block.closest('.sede-container');
            if (!container) return;

            const entry = containerStats.get(container);
            entry.count++;

            if (isCarouselFilter) {
                const horario = block.dataset.horario;
                if (horario && !entry.horarios.includes(horario)) {
                    entry.horarios.push(horario);
                }
            }
        });

        containers.forEach(container => {
            const result = containerStats.get(container);
            const header = container.querySelector('h2.sede-header');
            if (!header) return;

            const count = result.count;
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

    const defaultSedeOrder = Array.from(document.querySelectorAll('.sede-checkbox input')).map(input => input.value);

    containers.sort((a, b) => {
        const sedeIdA = a.dataset.sedeId;
        const sedeIdB = b.dataset.sedeId;

        if (filterActive) {
            const countA = containerStats.get(a).count;
            const countB = containerStats.get(b).count;

            if (countA !== countB) {
                return countB - countA;
            }
        }

        const indexA = defaultSedeOrder.indexOf(sedeIdA);
        const indexB = defaultSedeOrder.indexOf(sedeIdB);
        return indexA - indexB;
    });

    const grid = document.querySelector('.schedule-grid');
    if (grid) {
        containers.forEach(container => {
            grid.appendChild(container);
        });
    }
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
