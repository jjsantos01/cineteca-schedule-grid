import state, { setStartEndHours } from './state.js';
import { renderPosterCarousel, selectFilmInCarousel } from './carousel.js';
import { closeTooltip } from './tooltip.js';
import { SEDES, HOUR_WIDTH } from './config.js';
import { calculateTimeRange, minutesToPosition, getMovieUniqueId, formatDateForAPI } from './utils.js';
import { applyFilters, hasActiveFilters, updateSedeResultCounts } from './filters.js';
import { isMovieVisited } from './visited.js';
import { getEnrichedShowtime } from './movieUtils.js';

export function renderSchedule(movieData) {
    renderPosterCarousel(movieData, { isLoading: state.loadingSedes.size > 0 });
    const container = document.getElementById('scheduleContainer');
    const hasMovies = Object.values(movieData).some(movies => movies && movies.length > 0);

    if (!hasMovies) {
        if (state.loadingSedes.size === 0) {
            container.innerHTML = '<div class="error">Todavía no hay películas disponibles para las sedes seleccionadas</div>';
        }
        return;
    }

    const timeRange = calculateTimeRange(movieData);
    setStartEndHours(timeRange.startHour, timeRange.endHour);

    let html = '<div class="schedule-wrapper"><div class="schedule-grid">';
    const moviesBySede = groupMoviesBySede(movieData);

    for (const [sedeId, salas] of Object.entries(moviesBySede)) {
        const sede = SEDES[sedeId];
        const className = sede ? sede.className : '';
        html += `<div class="sede-container ${className}" data-sede-id="${sedeId}">`;
        const isLoading = state.loadingSedes.has(sedeId);
        html += renderSede(sedeId, salas, isLoading);
        html += `</div>`;
    }

    html += '</div></div>';
    container.innerHTML = html;
    setupMovieBlockInteractions();

    if (hasActiveFilters()) {
        applyFilters();
    } else {
        updateSedeResultCounts();
    }
}

function renderTimeAxis() {
    const totalHours = state.endHour - state.startHour;
    const containerWidth = totalHours * HOUR_WIDTH;

    let html = `<div class="time-axis" style="width: ${containerWidth}px;">`;
    const labelInterval = totalHours > 12 ? 2 : 1;

    for (let hour = state.startHour; hour <= state.endHour; hour += labelInterval) {
        const position = (hour - state.startHour) * HOUR_WIDTH;
        html += `
            <div class="time-label" style="left: ${position}px">
                ${hour}:00
            </div>
        `;
    }

    html += '</div>';
    html += `<div class="time-grid-lines" style="width: ${containerWidth}px;">`;

    for (let hour = state.startHour; hour <= state.endHour; hour += 0.5) {
        const position = (hour - state.startHour) * HOUR_WIDTH;
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

function groupMoviesBySede(movieData) {
    const moviesBySede = {};
    for (const [sedeId, movies] of Object.entries(movieData)) {
        if (!moviesBySede[sedeId]) {
            moviesBySede[sedeId] = {};
        }

        for (const movie of movies) {
            if (!moviesBySede[sedeId][movie.sala]) {
                moviesBySede[sedeId][movie.sala] = [];
            }
            moviesBySede[sedeId][movie.sala].push(movie);
        }
    }
    return moviesBySede;
}

function renderSede(sedeId, salas, isLoading = false) {
    const sede = SEDES[sedeId];
    const sortedSalas = Object.keys(salas).sort((a, b) => {
        const isOutdoorA = a.includes('FORO') || a.includes('CONFIRMAR');
        const isOutdoorB = b.includes('FORO') || b.includes('CONFIRMAR');
        if (isOutdoorA && !isOutdoorB) return 1;
        if (!isOutdoorA && isOutdoorB) return -1;
        const numA = parseInt(a.replace(/\D/g, ''), 10);
        const numB = parseInt(b.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    let html = `
        <h2 class="sede-header">${sede.nombre}</h2>
        <div class="sede-block">
            ${renderTimeAxis()}
            <div class="rooms-container">
    `;

    for (const sala of sortedSalas) {
        const loadingClass = isLoading ? 'sede-loading' : '';
        const roomLabel = (sala.startsWith('FORO') || sala.startsWith('POR CONFIRMAR'))
            ? `<div class="room-label">${sala}</div>`
            : sala.startsWith('SALA')
                ? `<div class="room-label">${sala}</div>`
                : `<div class="room-label">SALA ${sala} ${sede.codigo}</div>`;

        html += `
            <div class="room-row ${loadingClass}">
                ${roomLabel}
                <div class="room-timeline">
        `;

        for (const movie of salas[sala]) {
            for (const horario of movie.horarios) {
                html += renderMovieBlock(movie, horario, sede);
            }
        }

        html += `
                </div>
            </div>
        `;
    }

    html += '</div></div>';
    return html;
}

function renderMovieBlock(movie, horario, sede) {
    const enriched = getEnrichedShowtime(movie, horario);
    const position = minutesToPosition(enriched.startMinutes, state.startHour);
    const width = (movie.duracion / 60) * HOUR_WIDTH;

    const dateKey = formatDateForAPI(state.currentDate);
    const movieWithDate = { ...movie, date: dateKey };
    const movieData = JSON.stringify(movieWithDate).replace(/"/g, '&quot;');
    const isSelected = state.selectedMovies.some(m => m.uniqueId === enriched.uniqueId);
    const selectedClass = isSelected ? 'selected' : '';
    const visitedClass = isMovieVisited(enriched.uniqueId) ? 'visited' : '';

    return `
        <div class="movie-block ${sede.className} ${selectedClass} ${visitedClass}"
                style="left: ${position}px; width: ${width}px"
                data-movie="${movieData}"
                data-horario="${horario}"
                data-date="${dateKey}">
            <div class="movie-title">
                <span class="movie-name">${movie.displayTitle}</span>
                <span class="movie-time">${horario}</span>
            </div>
        </div>
    `;
}

function setupMovieBlockInteractions() {
    const movieBlocks = document.querySelectorAll('.movie-block');
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
