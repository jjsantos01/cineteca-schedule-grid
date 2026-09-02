import state from './state.js';
import { timeToMinutes } from './utils.js';
import { getEnrichedShowtime } from './movieUtils.js';
import { FILTER_LOCKS } from './filterLock.js';

/**
 * Cuenta películas únicas y funciones para una lista de películas de una sede.
 */
export function countSedeMoviesAndShowtimes(movies) {
    if (!Array.isArray(movies) || movies.length === 0) {
        return { movieCount: 0, showtimeCount: 0 };
    }
    const uniqueFilmIds = new Set();
    let showtimeCount = 0;

    for (const movie of movies) {
        const filmId = movie.filmId || (movie.displayTitle || movie.titulo || '').toLowerCase();
        if (filmId) {
            uniqueFilmIds.add(filmId);
        }
        if (Array.isArray(movie.horarios)) {
            showtimeCount += movie.horarios.length;
        }
    }

    return {
        movieCount: uniqueFilmIds.size,
        showtimeCount
    };
}

/**
 * Formatea el texto de películas y funciones en español con singular/plural.
 */
export function formatMovieAndShowtimeCounts(movieCount, showtimeCount) {
    const movieLabel = movieCount === 1 ? '1 película' : `${movieCount} películas`;
    const showtimeLabel = showtimeCount === 1 ? '1 función' : `${showtimeCount} funciones`;
    return `${movieLabel}, ${showtimeLabel}`;
}

export function applyFilters() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    let textMatchCount = 0;
    let timeMatchCount = 0;

    const isCarouselActive = Boolean(state.carouselFilterFilmId);
    const hasTextFilter = state.movieFilter !== '';

    movieBlocks.forEach(block => {
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const movieTitle = (movie.displayTitle || movie.titulo).toLowerCase();
        const horario = block.dataset.horario;

        let passesMovieFilter = true;
        if (isCarouselActive) {
            passesMovieFilter = movie.filmId === state.carouselFilterFilmId;
        } else if (hasTextFilter) {
            passesMovieFilter = movieTitle.includes(state.movieFilter);
        }

        let passesTimeFilter = true;
        if (state.timeFilterStart || state.timeFilterEnd) {
            const enriched = getEnrichedShowtime(movie, horario);
            const filterStartMinutes = state.timeFilterStart ? timeToMinutes(state.timeFilterStart) : 0;
            const filterEndMinutes = state.timeFilterEnd ? timeToMinutes(state.timeFilterEnd) : 24 * 60;
            passesTimeFilter = enriched.startMinutes >= filterStartMinutes && enriched.startMinutes <= filterEndMinutes;
        }

        if (passesMovieFilter && passesTimeFilter) {
            block.classList.remove('filtered-out');
            if (hasTextFilter) textMatchCount++;
            if (state.timeFilterStart || state.timeFilterEnd) timeMatchCount++;
        } else {
            block.classList.add('filtered-out');
        }
    });

    const filterResults = document.getElementById('filterResults');
    if (filterResults) {
        filterResults.textContent = hasTextFilter
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
    return Boolean(state.carouselFilterFilmId || state.movieFilter || state.timeFilterStart || state.timeFilterEnd);
}

/**
 * Resalta las filas del grid que contienen películas visibles (no filtradas)
 * Solo se ejecuta cuando hay filtros activos
 */
function highlightRoomsWithVisibleMovies() {
    // Limpiar todas las filas y carriles
    document.querySelectorAll('.room-row.has-visible-movies, .movies-lane.has-visible-movies')
        .forEach(row => row.classList.remove('has-visible-movies'));

    // Si no hay filtros activos, no resaltar nada
    if (!hasActiveFilters()) {
        return;
    }

    // Crear Set de filas/carriles que tienen películas visibles
    const rowsWithVisibleMovies = new Set();

    document.querySelectorAll('.movie-block:not(.filtered-out)')
        .forEach(block => {
            const row = block.closest('.room-row') || block.closest('.movies-lane');
            if (row) {
                rowsWithVisibleMovies.add(row);
            }
        });

    // Aplicar clase a las filas encontradas
    rowsWithVisibleMovies.forEach(row => {
        row.classList.add('has-visible-movies');
    });
}

/**
 * Actualiza los encabezados de sede o día con el número de resultados visibles.
 */
export function updateSedeResultCounts() {
    if (state.viewMode === 'movies') {
        updateDayResultCounts();
        return;
    }

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
    } else {
        containers.forEach(container => {
            const sedeId = container.dataset.sedeId;
            const movies = state.movieData[sedeId] || [];
            const header = container.querySelector('h2.sede-header');
            if (!header) return;

            const { movieCount, showtimeCount } = countSedeMoviesAndShowtimes(movies);
            if (showtimeCount > 0) {
                const small = document.createElement('small');
                small.className = 'sede-filter-count';
                small.textContent = formatMovieAndShowtimeCounts(movieCount, showtimeCount);
                header.appendChild(small);
            }
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

function updateDayResultCounts() {
    const dayContainers = Array.from(document.querySelectorAll('.day-container'));
    const filterActive = hasActiveFilters();

    dayContainers.forEach(container => {
        const badge = container.querySelector('.day-count-badge');
        if (!badge) return;

        if (filterActive) {
            const visibleBlocks = container.querySelectorAll('.movie-block:not(.filtered-out)');
            const count = visibleBlocks.length;
            if (count === 0) {
                badge.textContent = 'Sin resultados';
                badge.classList.add('sede-filter-count--empty');
            } else {
                badge.textContent = count === 1 ? '1 función coincidente' : `${count} funciones coincidentes`;
                badge.classList.remove('sede-filter-count--empty');
            }
        } else {
            badge.classList.remove('sede-filter-count--empty');
            const dateKey = container.dataset.date;
            const sedesData = state.multiDayData[dateKey];
            if (sedesData) {
                let allMovies = [];
                for (const [sedeId, movies] of Object.entries(sedesData)) {
                    if (state.activeSedes.has(sedeId) && Array.isArray(movies)) {
                        allMovies = allMovies.concat(movies);
                    }
                }
                const { movieCount, showtimeCount } = countSedeMoviesAndShowtimes(allMovies);
                badge.textContent = formatMovieAndShowtimeCounts(movieCount, showtimeCount);
            }
        }
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
