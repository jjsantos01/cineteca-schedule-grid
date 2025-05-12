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

    let html = '<div class="schedule-grid">';
    
    // Time axis
    html += renderTimeAxis();
    
    // Rooms
    html += '<div class="rooms-container">';
    
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
    setupTooltips();
    
    // Apply current filter
    if (window.movieFilter) {
        applyMovieFilter();
    }
}

function renderTimeAxis() {
    const totalHours = END_HOUR - START_HOUR;
    const containerWidth = totalHours * HOUR_WIDTH;
    
    let html = `<div class="time-axis" style="width: ${containerWidth}px;">`;
    
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
    
    // Add vertical grid lines every 30 minutes
    for (let hour = START_HOUR; hour <= END_HOUR; hour += 0.5) {
        const position = (hour - START_HOUR) * HOUR_WIDTH;
        const isHour = hour % 1 === 0;
        html += `
            <div class="time-grid-line ${isHour ? 'hour' : 'half-hour'}" 
                 style="left: ${position}px"></div>
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
    
    let html = '';
    
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
    
    return html;
}

function renderMovieBlock(movie, horario, sede) {
    const startMinutes = timeToMinutes(horario);
    const position = minutesToPosition(startMinutes);
    const width = (movie.duracion / 60) * HOUR_WIDTH;
    
    // Escape the JSON data properly for HTML attribute
    const movieData = JSON.stringify(movie).replace(/"/g, '&quot;');
    
    return `
        <div class="movie-block ${sede.className}" 
             style="left: ${position}px; width: ${width}px"
             data-movie="${movieData}"
             data-horario="${horario}">
            <div class="movie-title">
                ${movie.titulo} ${movie.tipoVersion} - ${horario}
            </div>
        </div>
    `;
}

// Tooltips
function setupTooltips() {
    const tooltip = document.getElementById('tooltip');
    const movieBlocks = document.querySelectorAll('.movie-block');
    
    movieBlocks.forEach(block => {
        block.addEventListener('mouseenter', (e) => {
            const target = e.currentTarget;
            // Decode the HTML entities before parsing JSON
            const movieDataStr = target.dataset.movie.replace(/&quot;/g, '"');
            const movie = JSON.parse(movieDataStr);
            const horario = target.dataset.horario;
            
            // Calculate end time
            const startMinutes = timeToMinutes(horario);
            const endMinutes = startMinutes + movie.duracion;
            const endTime = minutesToTime(endMinutes);
            
            tooltip.innerHTML = `
                <strong>${movie.titulo} ${movie.tipoVersion}</strong><br>
                Hora: ${horario} - ${endTime}<br>
                Duración: ${movie.duracion} min<br>
                Sala: ${movie.salaCompleta}
            `;
            
            tooltip.style.display = 'block';
            
            // Get position relative to viewport
            const rect = target.getBoundingClientRect();
            const tooltipHeight = tooltip.offsetHeight;
            
            // Position tooltip above the movie block
            const topPosition = rect.top - tooltipHeight - 5;
            const leftPosition = rect.left;
            
            // Check if tooltip would go off-screen at the top
            if (topPosition < 0) {
                // Show below the movie block instead
                tooltip.style.top = (rect.bottom + 5) + 'px';
            } else {
                tooltip.style.top = topPosition + 'px';
            }
            
            // Ensure tooltip doesn't go off-screen horizontally
            const rightEdge = leftPosition + tooltip.offsetWidth;
            if (rightEdge > window.innerWidth) {
                tooltip.style.left = (window.innerWidth - tooltip.offsetWidth - 10) + 'px';
            } else {
                tooltip.style.left = leftPosition + 'px';
            }
        });
        
        block.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
        
        // Also hide tooltip when scrolling
        block.addEventListener('scroll', () => {
            tooltip.style.display = 'none';
        });
    });
    
    // Hide tooltip when scrolling the page
    window.addEventListener('scroll', () => {
        tooltip.style.display = 'none';
    });
    
    // Hide tooltip when scrolling the schedule container
    document.getElementById('scheduleContainer').addEventListener('scroll', () => {
        tooltip.style.display = 'none';
    });
}