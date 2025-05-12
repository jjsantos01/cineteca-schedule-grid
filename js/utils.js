// Date utilities
function formatDate(date) {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Time utilities
function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function minutesToPosition(minutes) {
    const startMinutes = START_HOUR * 60;
    const minutesFromStart = minutes - startMinutes;
    return (minutesFromStart / 60) * HOUR_WIDTH;
}

// Calculate time range from movie data
function calculateTimeRange(movieData) {
    let minTime = 24 * 60; // Start with max possible time
    let maxTime = 0;      // Start with min possible time
    
    // Find earliest and latest times across all movies
    for (const sedeMovies of Object.values(movieData)) {
        for (const movie of sedeMovies) {
            for (const horario of movie.horarios) {
                const startMinutes = timeToMinutes(horario);
                const endMinutes = startMinutes + movie.duracion;
                
                minTime = Math.min(minTime, startMinutes);
                maxTime = Math.max(maxTime, endMinutes);
            }
        }
    }
    
    // Convert to hours
    // Round down to the nearest hour for start (no padding before)
    const minHour = Math.floor(minTime / 60);
    
    // Round up to the nearest hour for end, with 1-hour padding
    const maxHour = Math.ceil(maxTime / 60) + 1;
    
    // Apply reasonable bounds
    const boundedMinHour = Math.max(0, minHour);
    const boundedMaxHour = Math.min(24, maxHour);
    
    return {
        startHour: boundedMinHour,
        endHour: boundedMaxHour
    };
}

// URL parameter utilities
function updateURLParams(params) {
    const url = new URL(window.location);
    
    // Always set all parameters
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            // For filter, remove if empty
            if (key === 'filter') {
                url.searchParams.delete(key);
            }
        } else {
            url.searchParams.set(key, value);
        }
    });
    
    // Update the URL without reloading the page
    window.history.replaceState({}, '', url);
}

function getURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        date: urlParams.get('date'),
        sedes: urlParams.get('sedes'),
        filter: urlParams.get('filter')
    };
}

// UI utilities
function showLoading() {
    document.getElementById('scheduleContainer').innerHTML = '<div class="loading">Cargando cartelera...</div>';
}

function showError(message) {
    document.getElementById('scheduleContainer').innerHTML = `<div class="error">${message}</div>`;
}