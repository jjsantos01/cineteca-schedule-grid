import state, { setStartEndHours } from './state.js';
import { SEDES, HOUR_WIDTH } from './config.js';
import { minutesToPosition } from './utils.js';
import { applyFilters, hasActiveFilters, countSedeMoviesAndShowtimes, formatMovieAndShowtimeCounts } from './filters.js';
import { isMovieVisited } from './visited.js';
import { getEnrichedShowtime } from './movieUtils.js';
import { renderPosterCarousel, selectFilmInCarousel } from './carousel.js';
import { closeTooltip } from './tooltip.js';

const SPANISH_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SPANISH_MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Formatea una clave de fecha 'YYYY-MM-DD' en texto en español.
 * Ejemplo: '2026-09-01' -> 'Martes, 1 de septiembre de 2026'
 */
export function formatDayHeaderDate(dateKey) {
    if (!dateKey) return '';
    const [yearStr, monthStr, dayStr] = dateKey.split('-');
    const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
    const dayName = SPANISH_DAYS[dateObj.getDay()] || '';
    const monthName = SPANISH_MONTHS[dateObj.getMonth()] || '';
    const dayNum = parseInt(dayStr, 10);
    return `${dayName}, ${dayNum} de ${monthName} de ${yearStr}`;
}

/**
 * Calcula el rango horario global (startHour, endHour) cubriendo todas las fechas y sedes.
 */
export function calculateGlobalTimeRange(multiDayData) {
    let minMinutes = 24 * 60;
    let maxMinutes = 0;
    let hasShowtimes = false;

    for (const sedesData of Object.values(multiDayData)) {
        if (!sedesData || typeof sedesData !== 'object') continue;
        for (const movies of Object.values(sedesData)) {
            if (!Array.isArray(movies)) continue;
            for (const movie of movies) {
                if (!Array.isArray(movie.horarios)) continue;
                for (const horario of movie.horarios) {
                    const enriched = getEnrichedShowtime(movie, horario);
                    minMinutes = Math.min(minMinutes, enriched.startMinutes);
                    maxMinutes = Math.max(maxMinutes, enriched.endMinutes);
                    hasShowtimes = true;
                }
            }
        }
    }

    if (!hasShowtimes) {
        return { startHour: 12, endHour: 23 };
    }

    const startHour = Math.max(0, Math.floor(minMinutes / 60));
    const endHour = Math.min(24, Math.ceil(maxMinutes / 60));
    return {
        startHour: Math.min(startHour, endHour),
        endHour
    };
}

/**
 * Empaqueta una lista de funciones de un día en el número mínimo óptimo de carriles sin traslapes.
 */
export function packMoviesIntoLanes(showtimesList) {
    // Ordenar cronológicamente por startMinutes y luego por endMinutes
    const sorted = [...showtimesList].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) {
            return a.startMinutes - b.startMinutes;
        }
        return a.endMinutes - b.endMinutes;
    });

    const lanes = [];

    for (const item of sorted) {
        let placed = false;
        for (const lane of lanes) {
            // Permitir colocar si el carril se desocupó antes o al inicio de la función
            if (lane.lastEndMinutes <= item.startMinutes) {
                lane.items.push(item);
                lane.lastEndMinutes = item.endMinutes;
                placed = true;
                break;
            }
        }

        if (!placed) {
            lanes.push({
                lastEndMinutes: item.endMinutes,
                items: [item]
            });
        }
    }

    return lanes;
}

/**
 * Renderiza el eje temporal sincronizado con etiquetas y líneas de cuadrícula.
 */
function renderTimeAxis(startHour, endHour) {
    const totalHours = endHour - startHour;
    const containerWidth = totalHours * HOUR_WIDTH;

    let html = `<div class="time-axis" style="width: ${containerWidth}px;">`;
    const labelInterval = totalHours > 12 ? 2 : 1;

    for (let hour = startHour; hour <= endHour; hour += labelInterval) {
        const position = (hour - startHour) * HOUR_WIDTH;
        html += `
            <div class="time-label" style="left: ${position}px">
                ${hour}:00
            </div>
        `;
    }

    html += '</div>';
    html += `<div class="time-grid-lines" style="width: ${containerWidth}px;">`;

    for (let hour = startHour; hour <= endHour; hour += 0.5) {
        const position = (hour - startHour) * HOUR_WIDTH;
        const isHour = hour % 1 === 0;
        html += `
            <div class="time-grid-line ${isHour ? 'hour' : 'half-hour'}"
                 style="left: ${position}px">
            </div>
        `;
    }

    html += '</div>';
    return html;
}

/**
 * Renderiza un bloque de película compacto (40% de altura) para la vista multi-día.
 */
function renderCompactMovieBlock(item, startHour, endHour = state.endHour) {
    const { movie, horario, startMinutes, sede, dateKey } = item;
    const position = minutesToPosition(startMinutes, startHour);
    const maxEndMinutes = Math.min((endHour || 24) * 60, 24 * 60);
    const endMinutes = item.endMinutes || (startMinutes + (movie.duracion || 90));
    const visibleEndMinutes = Math.min(endMinutes, maxEndMinutes);
    const visibleDuration = Math.max(0, visibleEndMinutes - startMinutes);
    const width = (visibleDuration / 60) * HOUR_WIDTH;

    // Asegurar que el objeto movie inyectado contenga la fecha exacta del bloque
    const movieWithDate = {
        ...movie,
        date: dateKey
    };
    const movieData = JSON.stringify(movieWithDate).replace(/"/g, '&quot;');
    const isSelected = state.selectedMovies.some(m => m.uniqueId === item.uniqueId);
    const selectedClass = isSelected ? 'selected' : '';
    const visitedClass = isMovieVisited(item.uniqueId) ? 'visited' : '';

    return `
        <div class="movie-block movie-block--compact ${sede.className} ${selectedClass} ${visitedClass}"
             style="left: ${position}px; width: ${width}px"
             data-movie="${movieData}"
             data-horario="${horario}"
             data-date="${dateKey}"
             title="${movie.displayTitle || movie.titulo} (${horario} - ${sede.nombre})">
            <div class="movie-title">
                <span class="movie-name">${movie.displayTitle || movie.titulo}</span>
                <span class="movie-time">${horario}</span>
            </div>
        </div>
    `;
}

/**
 * Ordena las salas de una sede: salas numéricas primero, foros/especiales al final.
 */
export function sortSalas(salaKeys) {
    return [...salaKeys].sort((a, b) => {
        const isOutdoorA = a.includes('FORO') || a.includes('CONFIRMAR');
        const isOutdoorB = b.includes('FORO') || b.includes('CONFIRMAR');
        if (isOutdoorA && !isOutdoorB) return 1;
        if (!isOutdoorA && isOutdoorB) return -1;
        const numA = parseInt(a.replace(/\D/g, ''), 10);
        const numB = parseInt(b.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });
}

/**
 * Formatea la etiqueta de sala para el carril en la vista multi-día.
 * Ejemplo: '1', SEDES['003'] -> 'SALA 1 XOCO'
 * Ejemplo: 'FORO AL AIRE LIBRE', SEDES['003'] -> 'FORO AL AIRE LIBRE'
 */
export function formatLaneLabel(sala, sede) {
    if (!sala) return '';
    const trimmedSala = String(sala).trim();
    if (trimmedSala.startsWith('FORO') || trimmedSala.startsWith('POR CONFIRMAR')) {
        return trimmedSala;
    }
    const cleanSala = trimmedSala.startsWith('SALA') ? trimmedSala : `SALA ${trimmedSala}`;
    const codigo = sede ? (sede.codigo || sede.nombre || '') : '';
    if (codigo && !cleanSala.includes(codigo)) {
        return `${cleanSala} ${codigo}`;
    }
    return cleanSala;
}

/**
 * Renderiza la programación completa en modo 'Ver por películas' (Multi-día).
 */
export function renderMoviesSchedule(multiDayData) {
    const container = document.getElementById('scheduleContainer');
    if (!container) return;

    // Recolectar películas combinadas para el carrusel
    const combinedMoviesBySede = {};
    for (const [dateKey, sedesData] of Object.entries(multiDayData)) {
        if (!sedesData || typeof sedesData !== 'object') continue;
        for (const [sedeId, movies] of Object.entries(sedesData)) {
            if (!state.activeSedes.has(sedeId) || !Array.isArray(movies)) continue;
            if (!combinedMoviesBySede[sedeId]) {
                combinedMoviesBySede[sedeId] = [];
            }
            for (const movie of movies) {
                combinedMoviesBySede[sedeId].push({
                    ...movie,
                    date: movie.date || dateKey,
                    dateKey: movie.dateKey || dateKey
                });
            }
        }
    }
    renderPosterCarousel(combinedMoviesBySede, { isLoading: state.loadingSedes.size > 0 });

    // Recolectar días con películas ordenados por fecha
    const availableDates = Object.keys(multiDayData).sort();
    const daysWithMovies = [];

    for (const dateKey of availableDates) {
        const sedesData = multiDayData[dateKey];
        if (!sedesData) continue;

        let allDayMovies = [];
        const sedesForDay = [];

        // Iterar en el orden natural de sedes activas en state.activeSedes
        for (const sedeId of state.activeSedes) {
            const movies = sedesData[sedeId];
            if (!Array.isArray(movies) || movies.length === 0) {
                continue;
            }

            allDayMovies = allDayMovies.concat(movies);
            const sede = SEDES[sedeId] || { nombre: sedeId, codigo: sedeId, className: 'default', color: '#333' };

            // Agrupar películas por sala dentro de la sede
            const salasMap = {};
            for (const movie of movies) {
                if (!Array.isArray(movie.horarios) || movie.horarios.length === 0) continue;
                const salaKey = String(movie.sala || '1');
                if (!salasMap[salaKey]) {
                    salasMap[salaKey] = [];
                }
                salasMap[salaKey].push(movie);
            }

            const sortedSalas = sortSalas(Object.keys(salasMap));

            if (sortedSalas.length > 0) {
                sedesForDay.push({
                    sedeId,
                    sede,
                    salasMap,
                    sortedSalas
                });
            }
        }

        if (sedesForDay.length > 0) {
            daysWithMovies.push({
                dateKey,
                allMovies: allDayMovies,
                sedes: sedesForDay
            });
        }
    }

    if (daysWithMovies.length === 0) {
        if (state.loadingSedes.size === 0 && !state.isLoading) {
            container.innerHTML = '<div class="error">Todavía no hay películas disponibles para las sedes seleccionadas en los próximos días.</div>';
        }
        return;
    }

    // Calcular escala temporal unificada
    const timeRange = calculateGlobalTimeRange(multiDayData);
    setStartEndHours(timeRange.startHour, timeRange.endHour);

    let html = '<div class="schedule-wrapper"><div class="schedule-grid movies-view-grid">';

    for (const day of daysWithMovies) {
        const dayHeaderTitle = formatDayHeaderDate(day.dateKey);
        const { movieCount, showtimeCount } = countSedeMoviesAndShowtimes(day.allMovies);
        const countSummary = formatMovieAndShowtimeCounts(movieCount, showtimeCount);

        html += `
            <div class="day-container" data-date="${day.dateKey}">
                <div class="day-header-wrapper">
                    <h2 class="day-header">${dayHeaderTitle}</h2>
                    <span class="day-count-badge">${countSummary}</span>
                </div>
                <div class="day-block">
                    ${renderTimeAxis(timeRange.startHour, timeRange.endHour)}
                    <div class="lanes-container">
        `;

        let laneGlobalIndex = 0;
        for (let sIdx = 0; sIdx < day.sedes.length; sIdx++) {
            const { sedeId, sede, salasMap, sortedSalas } = day.sedes[sIdx];

            // Línea horizontal divisoria sutil entre sedes distintas del día
            if (sIdx > 0) {
                html += `<div class="sede-divider" data-sede-id="${sedeId}"></div>`;
            }

            for (const salaKey of sortedSalas) {
                const labelText = formatLaneLabel(salaKey, sede);
                const moviesInSala = salasMap[salaKey];

                // Extraer todas las funciones de esta sala y ordenarlas cronológicamente
                const showtimesInSala = [];
                for (const movie of moviesInSala) {
                    if (!Array.isArray(movie.horarios)) continue;
                    for (const horario of movie.horarios) {
                        const enriched = getEnrichedShowtime(movie, horario);
                        showtimesInSala.push({
                            movie,
                            horario,
                            startMinutes: enriched.startMinutes,
                            endMinutes: enriched.endMinutes,
                            uniqueId: enriched.uniqueId,
                            sede,
                            sedeId,
                            dateKey: day.dateKey
                        });
                    }
                }
                showtimesInSala.sort((a, b) => a.startMinutes - b.startMinutes);

                html += `
                    <div class="movies-lane ${sede.className}" data-lane-index="${laneGlobalIndex++}" data-sede-id="${sedeId}" data-sala="${salaKey}">
                        <div class="lane-label" title="${labelText}">${labelText}</div>
                        <div class="lane-timeline">
                `;

                for (const item of showtimesInSala) {
                    html += renderCompactMovieBlock(item, timeRange.startHour, timeRange.endHour);
                }

                html += `
                        </div>
                    </div>
                `;
            }
        }

        html += `
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div></div>';
    container.innerHTML = html;
    setupCompactBlockInteractions();

    if (hasActiveFilters()) {
        applyFilters();
    }
}

function setupCompactBlockInteractions() {
    const movieBlocks = document.querySelectorAll('.movie-block--compact');
    movieBlocks.forEach(block => {
        block.addEventListener('dblclick', (event) => {
            event.preventDefault();
            event.stopPropagation();
            closeTooltip();
            const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
            const movie = JSON.parse(movieDataStr);
            selectFilmInCarousel(movie.filmId, movie.displayTitle || movie.titulo);
        });
    });
}
