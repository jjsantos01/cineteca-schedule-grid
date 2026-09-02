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

    const startHour = Math.floor(minMinutes / 60);
    const endHour = Math.ceil(maxMinutes / 60);
    return { startHour, endHour };
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
function renderCompactMovieBlock(item, startHour) {
    const { movie, horario, startMinutes, sede, dateKey } = item;
    const position = minutesToPosition(startMinutes, startHour);
    const width = (movie.duracion / 60) * HOUR_WIDTH;

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
 * Renderiza la programación completa en modo 'Ver por películas' (Multi-día).
 */
export function renderMoviesSchedule(multiDayData) {
    const container = document.getElementById('scheduleContainer');
    if (!container) return;

    // Recolectar películas combinadas para el carrusel
    const combinedMoviesBySede = {};
    for (const sedesData of Object.values(multiDayData)) {
        if (!sedesData || typeof sedesData !== 'object') continue;
        for (const [sedeId, movies] of Object.entries(sedesData)) {
            if (!state.activeSedes.has(sedeId) || !Array.isArray(movies)) continue;
            if (!combinedMoviesBySede[sedeId]) {
                combinedMoviesBySede[sedeId] = [];
            }
            combinedMoviesBySede[sedeId].push(...movies);
        }
    }
    renderPosterCarousel(combinedMoviesBySede, { isLoading: state.loadingSedes.size > 0 });

    // Recolectar días con películas
    const availableDates = Object.keys(multiDayData).sort();
    const daysWithMovies = [];

    for (const dateKey of availableDates) {
        const sedesData = multiDayData[dateKey];
        if (!sedesData) continue;

        const dayShowtimes = [];
        let allDayMovies = [];

        for (const [sedeId, movies] of Object.entries(sedesData)) {
            if (!state.activeSedes.has(sedeId) || !Array.isArray(movies) || movies.length === 0) {
                continue;
            }

            allDayMovies = allDayMovies.concat(movies);
            const sede = SEDES[sedeId] || { nombre: sedeId, className: 'default', color: '#333' };

            for (const movie of movies) {
                if (!Array.isArray(movie.horarios)) continue;
                for (const horario of movie.horarios) {
                    const enriched = getEnrichedShowtime(movie, horario);
                    dayShowtimes.push({
                        movie,
                        horario,
                        startMinutes: enriched.startMinutes,
                        endMinutes: enriched.endMinutes,
                        uniqueId: enriched.uniqueId,
                        sede,
                        sedeId,
                        dateKey
                    });
                }
            }
        }

        if (dayShowtimes.length > 0) {
            daysWithMovies.push({
                dateKey,
                showtimes: dayShowtimes,
                allMovies: allDayMovies
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
        const lanes = packMoviesIntoLanes(day.showtimes);

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

        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            html += `
                <div class="movies-lane" data-lane-index="${i}">
                    <div class="lane-label">#${i + 1}</div>
                    <div class="lane-timeline">
            `;

            for (const item of lane.items) {
                html += renderCompactMovieBlock(item, timeRange.startHour);
            }

            html += `
                    </div>
                </div>
            `;
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
