import state, { setStartEndHours } from './state.js';
import { SEDES, HOUR_WIDTH } from './config.js';
import { calculateTimeRange, minutesToPosition, timeToMinutes, getMovieUniqueId } from './utils.js';
import { applyFilters } from './filters.js';
import { isMovieVisited } from './visited.js';

export function renderSchedule(movieData) {
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

    let sedeCount = 0;
    for (const [sedeId, salas] of Object.entries(moviesBySede)) {
        if (sedeCount > 0) {
            html += '<div class="sede-separator"></div>';
        }
        const isLoading = state.loadingSedes.has(sedeId);
        html += renderSede(sedeId, salas, isLoading);
        sedeCount++;
    }

    html += '</div></div>';
    container.innerHTML = html;
    setupMovieBlockInteractions();

    if (state.movieFilter || state.timeFilterStart || state.timeFilterEnd) {
        applyFilters();
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
        if (a === 'FORO AL AIRE LIBRE') return 1;
        if (b === 'FORO AL AIRE LIBRE') return -1;
        return parseInt(a, 10) - parseInt(b, 10);
    });

    let html = `
        <h2 class="sede-header">${sede.nombre}</h2>
        <div class="sede-block">
            ${renderTimeAxis()}
            <div class="rooms-container">
    `;

    for (const sala of sortedSalas) {
        const loadingClass = isLoading ? 'sede-loading' : '';
        const roomLabel = sala === 'FORO AL AIRE LIBRE'
            ? '<div class="room-label">FORO AL AIRE LIBRE</div>'
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
    const startMinutes = timeToMinutes(horario);
    const position = minutesToPosition(startMinutes, state.startHour);
    const width = (movie.duracion / 60) * HOUR_WIDTH;

    const movieData = JSON.stringify(movie).replace(/"/g, '&quot;');
    const movieId = getMovieUniqueId(movie, horario);
    const isSelected = state.selectedMovies.some(m => m.uniqueId === movieId);
    const selectedClass = isSelected ? 'selected' : '';
    const visitedClass = isMovieVisited(movieId) ? 'visited' : '';

    return `
        <div class="movie-block ${sede.className} ${selectedClass} ${visitedClass}"
                style="left: ${position}px; width: ${width}px"
                data-movie="${movieData}"
                data-horario="${horario}">
            <div class="movie-title">
                ${movie.titulo} ${movie.tipoVersion} - ${horario}
            </div>
        </div>
    `;
}

function setupMovieBlockInteractions() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    movieBlocks.forEach(block => {
        block.addEventListener('mouseenter', () => {
            // Placeholder for potential hover interactions
        });
    });
}
