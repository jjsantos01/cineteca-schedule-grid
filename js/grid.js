// Grid rendering functions
function renderSchedule(movieData) {
    const container = document.getElementById('scheduleContainer');
    
    if (Object.keys(movieData).length === 0 || 
        Object.values(movieData).every(movies => movies.length === 0)) {
        container.innerHTML = '<div class="error">No hay películas disponibles para las sedes seleccionadas</div>';
        return;
    }

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
        
        html += renderSede(sedeId, salas);
        sedeCount++;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
    
    // Add event listeners for tooltips
    setupTooltips();
}

function renderTimeAxis() {
    let html = '<div class="time-axis">';
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
        const position = (hour - START_HOUR) * HOUR_WIDTH;
        html += `
            <div class="time-label" style="left: ${position}px">
                ${hour}:00
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

function renderSede(sedeId, salas) {
    const sede = SEDES[sedeId];
    const sortedSalas = Object.keys(salas).sort((a, b) => parseInt(a) - parseInt(b));
    
    let html = '';
    
    for (const sala of sortedSalas) {
        html += `
            <div class="room-row">
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
    
    return `
        <div class="movie-block ${sede.className}" 
             style="left: ${position}px; width: ${width}px"
             data-movie='${JSON.stringify(movie)}'
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
            const movie = JSON.parse(e.target.dataset.movie);
            const horario = e.target.dataset.horario;
            
            tooltip.innerHTML = `
                <strong>${movie.titulo} ${movie.tipoVersion}</strong><br>
                Hora: ${horario}<br>
                Duración: ${movie.duracion} min<br>
                Sala: ${movie.salaCompleta}
            `;
            
            tooltip.style.display = 'block';
            
            const rect = e.target.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
        });
        
        block.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    });
}