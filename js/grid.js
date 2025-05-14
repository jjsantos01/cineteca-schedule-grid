// Grid rendering functions
function renderSchedule(movieData) {
    const container = document.getElementById('scheduleContainer');
    
    // Check if we have any actual movies
    const hasMovies = Object.values(movieData).some(movies => movies && movies.length > 0);
    
    if (!hasMovies) {
        if (window.loadingSedes?.size === 0) {
            container.innerHTML = '<div class="error">Todavía no hay películas disponibles para las sedes seleccionadas</div>';
        }
        return;
    }

    // Calculate dynamic time range
    const timeRange = calculateTimeRange(movieData);
    START_HOUR = timeRange.startHour;
    END_HOUR = timeRange.endHour;

    let html = '<div class="schedule-wrapper"><div class="schedule-grid">';
    
    // Group movies by sede and sala
    const moviesBySede = groupMoviesBySede(movieData);
    
    // Render each sede
    let sedeCount = 0;
    for (const [sedeId, salas] of Object.entries(moviesBySede)) {
        if (sedeCount > 0) {
            html += '<div class="sede-separator"></div>';
        }
        
        const isLoading = window.loadingSedes?.has(sedeId);
        html += renderSede(sedeId, salas, isLoading);
        sedeCount++;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
    
    // Add event listeners for tooltips
    setupMovieBlockInteractions();;

    if (pendingSelections.length > 0) {
        reconstructSelectionsFromURL();
    }
    
    // Apply current filters
    if (window.movieFilter || window.timeFilterStart || window.timeFilterEnd) {
        applyFilters();
    }
}

function renderTimeAxis() {
    const totalHours = END_HOUR - START_HOUR;
    const containerWidth = totalHours * HOUR_WIDTH;
    
    let html = `
        <div class="time-axis" style="width: ${containerWidth}px;">
            <!-- Time labels -->
    `;
    
    // Show labels every hour for short ranges, every 2 hours for longer ranges
    const labelInterval = totalHours > 12 ? 2 : 1;
    
    for (let hour = START_HOUR; hour <= END_HOUR; hour += labelInterval) {
        const position = (hour - START_HOUR) * HOUR_WIDTH;
        html += `
            <div class="time-label" style="left: ${position}px">
                ${hour}:00
            </div>
        `;
    }
    
    html += '</div>';
    
    // Render grid lines in a separate container
    html += `<div class="time-grid-lines" style="width: ${containerWidth}px;">`;
    
    // Add vertical grid lines every 30 minutes
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 0.5) {
        const position = (hour - START_HOUR) * HOUR_WIDTH;
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
    const sortedSalas = Object.keys(salas).sort((a, b) => parseInt(a) - parseInt(b));
    
    let html = `
        <div class="sede-block">
            <!-- Time axis for this sede -->
            ${renderTimeAxis()}
            <!-- Rooms for this sede -->
            <div class="rooms-container">
    `;
    
    for (const sala of sortedSalas) {
        const loadingClass = isLoading ? 'sede-loading' : '';
        html += `
            <div class="room-row ${loadingClass}">
                <div class="room-label">SALA ${sala} ${sede.codigo}</div>
                <div class="room-timeline">
        `;
        
        // Render movies in this sala
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
    const position = minutesToPosition(startMinutes);
    const width = (movie.duracion / 60) * HOUR_WIDTH;
    
    const movieData = JSON.stringify(movie).replace(/"/g, '&quot;');
    const movieId = getMovieUniqueId(movie, horario);
    const isSelected = window.selectedMovies?.some(m => m.uniqueId === movieId);
    const selectedClass = isSelected ? 'selected' : '';
    
    return `
        <div class="movie-block ${sede.className} ${selectedClass}" 
             style="left: ${position}px; width: ${width}px"
             data-movie="${movieData}"
             data-horario="${horario}">
            <div class="movie-title">
                ${movie.titulo} ${movie.tipoVersion} - ${horario}
            </div>
        </div>
    `;
}

// Función auxiliar para verificar si dos películas se traslapan
function checkMovieOverlap(movie1Start, movie1Duration, movie2Start, movie2Duration) {
    const movie1End = movie1Start + movie1Duration;
    const movie2End = movie2Start + movie2Duration;
    return (movie1Start < movie2End) && (movie2Start < movie1End);
}

// Tooltips
function setupMovieBlockInteractions() {
    // Ya no hay tooltips tradicionales
    // Los clicks se manejan en el event listener global
    // Solo necesitamos esto si queremos mantener hover overlaps
    
    const movieBlocks = document.querySelectorAll('.movie-block');
    
    movieBlocks.forEach(block => {
        // Opcional: mantener efecto hover para overlaps
        block.addEventListener('mouseenter', (e) => {
            if (!window.selectedMovies || window.selectedMovies.length === 0) {
                // Lógica de hover overlay si se desea mantener
            }
        });
    });
}