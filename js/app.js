// Update URL with current state
function updateStateInURL() {
    if (isInitializing) return; // Don't update URL during initialization
    
    const params = {
        date: formatDateForAPI(currentDate),
        sedes: Array.from(activeSedes).join(','),
        filter: movieFilter || null,
        timeStart: timeFilterStart || null,
        timeEnd: timeFilterEnd || null,
    };
    
    updateURLParams(params);
}

// Load state from URL
function loadStateFromURL() {
    const params = getURLParams();
    const previousDate = currentDate ? new Date(currentDate) : null;
    // Load date
    if (params.date) {
        const parsedDate = new Date(params.date + 'T00:00:00');
        if (!isNaN(parsedDate.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 7);
            
            if (parsedDate >= today && parsedDate <= maxDate) {
                currentDate = parsedDate;
                if (previousDate && previousDate.getTime() !== parsedDate.getTime()) {
                    clearSelection();
                }
            }
        }
    }
    
    // Load sedes
    if (params.sedes) {
        const sedeIds = params.sedes.split(',').filter(id => ['002', '003'].includes(id));
        if (sedeIds.length > 0) {
            activeSedes = new Set(sedeIds);
        }
    }
    
    // Load filter
    if (params.filter) {
        movieFilter = params.filter;
        document.getElementById('movieFilter').value = movieFilter;
    }
    
    // Load time filters
    if (params.timeStart) {
        timeFilterStart = params.timeStart;
        document.getElementById('startTimeFilter').value = timeFilterStart;
    }
    
    if (params.timeEnd) {
        timeFilterEnd = params.timeEnd;
        document.getElementById('endTimeFilter').value = timeFilterEnd;
    }
    
    updateUIFromState();
}

// Update UI elements to match current state
function updateUIFromState() {
    // Update date display
    updateDateDisplay();
    
    // Update sede checkboxes
    document.getElementById('cenart').checked = activeSedes.has('002');
    document.getElementById('xoco').checked = activeSedes.has('003');
    
    // Filter is already set in loadStateFromURL
}

// Handle movie filter
function handleMovieFilter(filterText) {
    const previousFilter = movieFilter;
    movieFilter = filterText.toLowerCase();
    if (!previousFilter && movieFilter) {
        clearSelection();
    }
    applyMovieFilter();
    updateStateInURL();
}

// Apply filter to movie blocks
function applyMovieFilter() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    let matchCount = 0;
    
    movieBlocks.forEach(block => {
        // Decode the HTML entities before parsing JSON
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const movieTitle = movie.titulo.toLowerCase();
        
        if (movieFilter === '' || movieTitle.includes(movieFilter)) {
            block.classList.remove('filtered-out');
            matchCount++;
        } else {
            block.classList.add('filtered-out');
        }
    });
    
    // Update results count
    const filterResults = document.getElementById('filterResults');
    if (movieFilter !== '') {
        filterResults.textContent = `${matchCount} coincidencias encontradas`;
    } else {
        filterResults.textContent = '';
    }
}// Main application logic
let currentDate = new Date();
let activeSedes = new Set(['003']); // XOCO by default
let movieData = {};
let cachedData = {}; // Structure: { "YYYY-MM-DD": { "sedeId": { data: [...], date: Date } } }
let isLoading = false;
let loadingSedes = new Set(); // Track which sedes are currently loading
let movieFilter = ''; // Current filter text
let timeFilterStart = ''; // Time filter start
let timeFilterEnd = ''; // Time filter end
let isInitializing = true; // Flag to prevent URL updates during initialization
window.selectedMovies = [];
let currentTooltipMovie = null;
let currentTooltipHorario = null;
let tooltipOverlay = null;

// Handle time filter
function handleTimeFilter() {
    const previousStart = timeFilterStart;
    const previousEnd = timeFilterEnd;
    timeFilterStart = document.getElementById('startTimeFilter').value;
    timeFilterEnd = document.getElementById('endTimeFilter').value;
    
    if ((!previousStart && timeFilterStart) || (!previousEnd && timeFilterEnd)) {
        clearSelection();
    }

    applyFilters();
    updateStateInURL();
}

// Clear time filter
function clearTimeFilter() {
    timeFilterStart = '';
    timeFilterEnd = '';
    document.getElementById('startTimeFilter').value = '';
    document.getElementById('endTimeFilter').value = '';
    applyFilters();
    updateStateInURL();
}

// Apply all filters (text and time)
function applyFilters() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    let textMatchCount = 0;
    let timeMatchCount = 0;
    
    movieBlocks.forEach(block => {
        // Decode the HTML entities before parsing JSON
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const movieTitle = movie.titulo.toLowerCase();
        const horario = block.dataset.horario;
        
        // Text filter
        const passesTextFilter = movieFilter === '' || movieTitle.includes(movieFilter);
        
        // Time filter
        let passesTimeFilter = true;
        if (timeFilterStart || timeFilterEnd) {
            const movieStartMinutes = timeToMinutes(horario);
            const filterStartMinutes = timeFilterStart ? timeToMinutes(timeFilterStart) : 0;
            const filterEndMinutes = timeFilterEnd ? timeToMinutes(timeFilterEnd) : 24 * 60;
            
            passesTimeFilter = movieStartMinutes >= filterStartMinutes && movieStartMinutes <= filterEndMinutes;
        }
        
        // Apply combined filter
        if (passesTextFilter && passesTimeFilter) {
            block.classList.remove('filtered-out');
            if (movieFilter !== '') textMatchCount++;
            if (timeFilterStart || timeFilterEnd) timeMatchCount++;
        } else {
            block.classList.add('filtered-out');
        }
    });
    
    // Update results count for text filter
    const filterResults = document.getElementById('filterResults');
    if (movieFilter !== '') {
        filterResults.textContent = `${textMatchCount} coincidencias encontradas`;
    } else {
        filterResults.textContent = '';
    }
    
    // Update results count for time filter
    const timeFilterResults = document.getElementById('timeFilterResults');
    if (timeFilterStart || timeFilterEnd) {
        timeFilterResults.textContent = `${timeMatchCount} películas en rango`;
    } else {
        timeFilterResults.textContent = '';
    }
}

// Update the movie filter handler to use the new combined filter
function handleMovieFilter(filterText) {
    movieFilter = filterText.toLowerCase();
    applyFilters();
    updateStateInURL();
}

// Update date display
function updateDateDisplay() {
    document.getElementById('currentDate').textContent = formatDate(currentDate);
    
    // Update date picker value
    const datePicker = document.getElementById('datePicker');
    datePicker.value = formatDateForAPI(currentDate);
    
    // Set min and max dates for the picker
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    
    datePicker.min = formatDateForAPI(today);
    datePicker.max = formatDateForAPI(maxDate);
    
    // Update button states
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');
    
    const current = new Date(currentDate);
    current.setHours(0, 0, 0, 0);
    
    prevBtn.disabled = current <= today;
    nextBtn.disabled = current >= maxDate;
}

// Handle date picker change
function handleDatePickerChange(newDate) {
    const parsedDate = new Date(newDate + 'T00:00:00');
    if (!isNaN(parsedDate.getTime())) {
        // Validate date is within allowed range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 7);
        
        if (parsedDate >= today && parsedDate <= maxDate) {
            const dateChanged = !isSameDate(currentDate, parsedDate);            
            currentDate = parsedDate;
            
            if (dateChanged) {
                clearSelection();
            }
            
            updateDateDisplay();
            loadAndRenderMovies();
            updateStateInURL();
        }
    }
}

// Change date
function changeDate(days) {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    
    if (newDate >= today && newDate <= maxDate) {
        currentDate = newDate;
        clearSelection();
        updateDateDisplay();
        loadAndRenderMovies();
        updateStateInURL();
    }
}

// Toggle sede
async function toggleSede(sedeId, isChecked) {
    const dateKey = formatDateForAPI(currentDate);
    
    if (isChecked) {
        activeSedes.add(sedeId);
        if (!movieData[sedeId] || !hasCachedData(dateKey, sedeId)) {
            // Need to load data for this sede
            await loadSedeData(sedeId);
        } else {
            // Data already available, just re-render
            renderSchedule(getCurrentMovieData());
        }
    } else {
        activeSedes.delete(sedeId);
        // Just re-render without this sede's data
        renderSchedule(getCurrentMovieData());
    }
    
    updateStateInURL();
}

// Check if we have cached data for a specific date and sede
function hasCachedData(dateKey, sedeId) {
    return cachedData[dateKey] && cachedData[dateKey][sedeId];
}

// Get cached data for a specific date and sede
function getCachedData(dateKey, sedeId) {
    if (hasCachedData(dateKey, sedeId)) {
        return cachedData[dateKey][sedeId].data;
    }
    return null;
}

// Set cached data for a specific date and sede
function setCachedData(dateKey, sedeId, data) {
    if (!cachedData[dateKey]) {
        cachedData[dateKey] = {};
    }
    cachedData[dateKey][sedeId] = {
        data: data,
        date: new Date()
    };
}

// Get current movie data based on active sedes
function getCurrentMovieData() {
    const currentData = {};
    for (const sedeId of activeSedes) {
        if (movieData[sedeId]) {
            currentData[sedeId] = movieData[sedeId];
        }
    }
    return currentData;
}

// Clean old cache entries (optional - to prevent memory issues)
function cleanOldCache() {
    const dateKeys = Object.keys(cachedData);
    const maxCacheDays = 7; // Keep cache for 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxCacheDays);
    
    for (const dateKey of dateKeys) {
        const keyDate = new Date(dateKey);
        if (keyDate < cutoffDate) {
            delete cachedData[dateKey];
        }
    }
}

// Check if two dates are the same day
function isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
}

// Load data for a specific sede
async function loadSedeData(sedeId) {
    if (loadingSedes.has(sedeId)) return; // Already loading this sede
    
    const dateKey = formatDateForAPI(currentDate);
    
    // Check cache first
    const cachedSedeData = getCachedData(dateKey, sedeId);
    if (cachedSedeData) {
        movieData[sedeId] = cachedSedeData;
        renderSchedule(getCurrentMovieData());
        return;
    }
    
    loadingSedes.add(sedeId);
    
    try {
        // Show loading indicator for this sede
        updateLoadingState();
        
        const movies = await fetchMoviesForSede(sedeId, currentDate);
        movieData[sedeId] = movies;
        setCachedData(dateKey, sedeId, movies);
        
        // Update the display with new data
        renderSchedule(getCurrentMovieData());
    } catch (error) {
        console.error(`Error loading sede ${sedeId}:`, error);
        showError(`Error al cargar datos de ${SEDES[sedeId].nombre}`);
    } finally {
        loadingSedes.delete(sedeId);
        updateLoadingState();
    }
}

// Update loading state display
function updateLoadingState() {
    const container = document.getElementById('scheduleContainer');
    
    if (loadingSedes.size === 0) {
        // No sedes loading, hide indicator
        hideLoadingIndicator();
        
        const currentData = getCurrentMovieData();
        if (Object.keys(currentData).length === 0 || 
            Object.values(currentData).every(movies => !movies || movies.length === 0)) {
            container.innerHTML = '<div class="error">Todavía no hay películas disponibles para las sedes seleccionadas</div>';
        }
        return;
    }
    
    if (loadingSedes.size > 0) {
        // Show which sedes are loading
        const loadingSedeNames = Array.from(loadingSedes).map(id => SEDES[id].nombre).join(', ');
        const currentData = getCurrentMovieData();
        
        if (Object.keys(currentData).length > 0 && 
            Object.values(currentData).some(movies => movies && movies.length > 0)) {
            // We have some data to show
            renderSchedule(currentData);
            showLoadingIndicator(`Cargando datos de: ${loadingSedeNames}`);
        } else {
            // No data yet, show full loading screen
            container.innerHTML = `<div class="loading">Cargando cartelera de ${loadingSedeNames}...</div>`;
        }
    }
}

// Show loading indicator overlay
function showLoadingIndicator(message) {
    let indicator = document.getElementById('loadingIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.className = 'loading-indicator';
        document.body.appendChild(indicator);
    }
    indicator.textContent = message;
    indicator.style.display = 'block';
}

// Hide loading indicator
function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Load and render movies
async function loadAndRenderMovies() {
    if (isLoading) return;
    
    isLoading = true;
    const dateKey = formatDateForAPI(currentDate);
    
    // Clear movieData when date changes, but keep cache
    movieData = {};
    
    // First, load any cached data
    let hasDataToRender = false;
    for (const sedeId of activeSedes) {
        const cachedSedeData = getCachedData(dateKey, sedeId);
        if (cachedSedeData) {
            movieData[sedeId] = cachedSedeData;
            hasDataToRender = true;
        }
    }
    
    // Render cached data immediately if available
    if (hasDataToRender) {
        renderSchedule(getCurrentMovieData());
    } else {
        showLoading();
    }
    
    try {
        // Load data for sedes that don't have cached data
        const promises = [];
        for (const sedeId of activeSedes) {
            if (!hasCachedData(dateKey, sedeId)) {
                promises.push(loadSedeData(sedeId));
            }
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    } catch (error) {
        showError('Error al cargar la cartelera');
    } finally {
        isLoading = false;
    }
}

// Check if filters are active
window.hasActiveFilters = function() {
    const movieFilter = document.getElementById('movieFilter').value.trim();
    const timeStart = document.getElementById('startTimeFilter').value;
    const timeEnd = document.getElementById('endTimeFilter').value;
    return movieFilter !== '' || timeStart !== '' || timeEnd !== '';
}

// Generate unique ID for a movie
window.getMovieUniqueId = function(movie, horario) {
    return `${movie.sedeId}-${movie.sala}-${horario}-${movie.titulo}`;
}

// Check if two movies overlap
function doMoviesOverlap(movie1, movie2) {
    return (movie1.startMinutes < movie2.endMinutes) && 
           (movie2.startMinutes < movie1.endMinutes);
}

// Toggle movie selection
window.toggleMovieSelection = function(movieData, horario) {
    if (hasActiveFilters()) return;
    
    const movieId = getMovieUniqueId(movieData, horario);
    const startMinutes = timeToMinutes(horario);
    const endMinutes = startMinutes + movieData.duracion;
    
    const movieInfo = {
        titulo: movieData.titulo,
        tipoVersion: movieData.tipoVersion || '',
        horario: horario,
        duracion: movieData.duracion,
        sala: movieData.sala,
        sede: movieData.sede,
        sedeId: movieData.sedeId,
        startMinutes: startMinutes,
        endMinutes: endMinutes,
        uniqueId: movieId
    };
    
    const existingIndex = selectedMovies.findIndex(m => m.uniqueId === movieId);
    
    if (existingIndex !== -1) {
        selectedMovies.splice(existingIndex, 1);
    } else {
        // Only add if no overlap
        const hasOverlap = selectedMovies.some(selected => 
            doMoviesOverlap(selected, movieInfo)
        );
        
        if (!hasOverlap) {
            selectedMovies.push(movieInfo);
        }
    }
    
    // Force immediate visual update
    requestAnimationFrame(() => {
        updateSelectionDisplay();
        updateMovieBlocksVisuals();
        updateStateInURL();
    });
}

// Update visual state of all movie blocks
function updateMovieBlocksVisuals() {
    const movieBlocks = document.querySelectorAll('.movie-block');
    
    movieBlocks.forEach(block => {
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const horario = block.dataset.horario;
        const movieId = getMovieUniqueId(movie, horario);
        
        // Check if selected
        const isSelected = selectedMovies.some(m => m.uniqueId === movieId);
        block.classList.toggle('selected', isSelected);
        
        // Check for overlaps ONLY if there are selections and no filters
        if (!isSelected && selectedMovies.length > 0 && !hasActiveFilters()) {
            const startMinutes = timeToMinutes(horario);
            const endMinutes = startMinutes + movie.duracion;
            
            const overlapsWithSelected = selectedMovies.some(selected => {
                // Make sure we're comparing numbers
                const movieStart = startMinutes;
                const movieEnd = endMinutes;
                const selectedStart = selected.startMinutes;
                const selectedEnd = selected.endMinutes;
                
                return (movieStart < selectedEnd) && (selectedStart < movieEnd);
            });
            
            block.classList.toggle('filtered-out', overlapsWithSelected);
        } else {
            // Remove filtered-out if no selections or filters are active
            block.classList.remove('filtered-out');
        }
    });
}

// Update selection display
function updateSelectionDisplay() {
    const container = document.getElementById('scheduleContainer');
    let selectionInfo = document.getElementById('selectionInfo');
    
    if (selectedMovies.length === 0) {
        if (selectionInfo) selectionInfo.remove();
        return;
    }
    
    if (!selectionInfo) {
        selectionInfo = document.createElement('div');
        selectionInfo.id = 'selectionInfo';
        selectionInfo.className = 'selection-info';
        container.insertBefore(selectionInfo, container.firstChild);
    }
    
    const movieTitles = selectedMovies.map(m => 
        `${m.titulo} (${m.horario})`
    ).join(', ');
    
    selectionInfo.innerHTML = `
        <div class="selected-movies-list">
            <strong>Películas seleccionadas:</strong> ${movieTitles}
        </div>
        <button class="clear-selection-btn" onclick="clearSelection()">
            Borrar selección
        </button>
    `;
}

// Clear selection
window.clearSelection = function() {
    selectedMovies = [];
    updateSelectionDisplay();
    updateMovieBlocksVisuals();
    updateStateInURL();
    console.log('Selection cleared');
}

// Initialize application
function init() {
    // Check if URL has any parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    if (!urlParams.has('date') && !urlParams.has('sedes') && !urlParams.has('filter')) {
        // No parameters in URL, set defaults
        currentDate = new Date();
        activeSedes = new Set(['003']); // XOCO by default
        movieFilter = '';
        timeFilterStart = '';
        timeFilterEnd = '';
        
        // Update URL with default state
        updateStateInURL();
    } else {
        // Load state from URL
        loadStateFromURL();
    }
    
    // Date controls
    document.getElementById('prevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDay').addEventListener('click', () => changeDate(1));
    
    // Date picker
    const currentDateElement = document.getElementById('currentDate');
    const datePicker = document.getElementById('datePicker');
    
    currentDateElement.addEventListener('click', () => {
        datePicker.showPicker();
    });
    
    datePicker.addEventListener('change', (e) => {
        handleDatePickerChange(e.target.value);
    });
    
    // Sede checkboxes
    document.getElementById('cenart').addEventListener('change', (e) => {
        toggleSede('002', e.target.checked);
    });
    
    document.getElementById('xoco').addEventListener('change', (e) => {
        toggleSede('003', e.target.checked);
    });
    
    // Movie filter with debounce for better performance
    const movieFilterInput = document.getElementById('movieFilter');
    let filterTimeout;
    movieFilterInput.addEventListener('input', (e) => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            handleMovieFilter(e.target.value);
        }, 300);
    });
    
    // Time filters
    document.getElementById('startTimeFilter').addEventListener('change', handleTimeFilter);
    document.getElementById('endTimeFilter').addEventListener('change', handleTimeFilter);
    document.getElementById('clearTimeFilter').addEventListener('click', clearTimeFilter);
    
    // Share button functionality
    const shareButton = document.getElementById('shareButton');
    const shareMessage = document.getElementById('shareMessage');
    
    shareButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            shareMessage.textContent = '¡Link copiado! Puedes compartirlo';
            shareMessage.classList.add('visible');
            
            // Hide message after 3 seconds
            setTimeout(() => {
                shareMessage.classList.remove('visible');
            }, 3000);
        } catch (err) {
            console.error('Error al copiar el enlace:', err);
        }
    });
    
    // Initial load
    isInitializing = false; // Allow URL updates after initialization
    updateDateDisplay();
    loadAndRenderMovies();
    
    // Browser back/forward button support
    window.addEventListener('popstate', () => {
        isInitializing = true;
        loadStateFromURL();
        isInitializing = false;
        loadAndRenderMovies();
    });
    
    // Update time every minute
    setInterval(() => {
        updateDateDisplay();
    }, 60000);
    
    // Clean old cache periodically (every hour)
    setInterval(() => {
        cleanOldCache();
    }, 3600000);
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        const movieBlock = e.target.closest('.clickable-movie');
        if (!movieBlock || movieBlock.dataset.clickable !== 'true') return;
        
        // Prevent clicks on filtered-out movies
        if (movieBlock.classList.contains('filtered-out')) {
            console.log('Cannot select - movie overlaps with existing selection');
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        movieBlock.dataset.clickable = 'false';
        
        const movieDataStr = movieBlock.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const horario = movieBlock.dataset.horario;
        
        window.toggleMovieSelection(movie, horario);
        
        setTimeout(() => {
            movieBlock.dataset.clickable = 'true';
        }, 300);
    });
});

// Inicializar overlay
document.addEventListener('DOMContentLoaded', () => {
    // Crear overlay
    tooltipOverlay = document.createElement('div');
    tooltipOverlay.className = 'tooltip-overlay';
    tooltipOverlay.addEventListener('click', closeTooltip);
    document.body.appendChild(tooltipOverlay);
    
    // REMOVER el event listener anterior que manejaba selección directa
    // y reemplazarlo con uno que SOLO muestre el tooltip
    document.body.addEventListener('click', (e) => {
        const movieBlock = e.target.closest('.movie-block');
        if (!movieBlock) return;
        
        // No verificar clickable, ni filtered-out, siempre mostrar tooltip
        e.preventDefault();
        e.stopPropagation();
        
        const movieDataStr = movieBlock.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const horario = movieBlock.dataset.horario;
        
        // SIEMPRE mostrar el tooltip, sin importar el estado
        showInteractiveTooltip(movieBlock, movie, horario);
    });
});

// Mostrar tooltip interactivo
function showInteractiveTooltip(element, movie, horario) {
    markMovieAsVisited(movie, horario);
    element.classList.add('visited');    

    const tooltip = document.getElementById('tooltip');
    const endMinutes = timeToMinutes(horario) + movie.duracion;
    const endTime = minutesToTime(endMinutes);
    
    currentTooltipMovie = movie;
    currentTooltipHorario = horario;
    
    // Configurar header
    const titleElement = tooltip.querySelector('.tooltip-title');
    titleElement.textContent = `${movie.titulo} ${movie.tipoVersion || ''}`;
    
    // Get all showtimes for this movie (excluding current showtime)
    const allShowtimes = findAllShowtimesForMovie(movie.titulo, movie.sedeId, movie.sala, horario);

    // Create the showtimes table HTML
    let showtimesHTML = '';
    if (allShowtimes.length > 0) {
        showtimesHTML = `
            <div class="tooltip-info-row showtimes-header">
                <span class="tooltip-info-label">Otros horarios hoy:</span>
            </div>
            <div class="tooltip-showtimes">
                <table class="showtimes-table">
                    <thead>
                        <tr>
                            <th>Sede</th>
                            <th>Sala</th>
                            <th>Hora</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        for (const showtime of allShowtimes) {
            showtimesHTML += `
                <tr>
                    <td>${showtime.sede}</td>
                    <td>${showtime.sala}</td>
                    <td>${showtime.horario}</td>
                </tr>
            `;
        }
        
        showtimesHTML += `
                    </tbody>
                </table>
            </div>
        `;
    } else {
        showtimesHTML = `
            <div class="tooltip-info-row showtimes-header">
                <span class="tooltip-info-label">Otros horarios hoy:</span>
                <span class="tooltip-info-value">No hay otras funciones disponibles para esta película. Intente seleccionar otras sedes.</span>
            </div>
        `;
    }   
    
    // Configurar información
    const infoElement = tooltip.querySelector('.tooltip-info');
    infoElement.innerHTML = `
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Horario:</span>
            <span class="tooltip-info-value">${horario} - ${endTime}</span>
        </div>
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Duración:</span>
            <span class="tooltip-info-value">${formatDuration(movie.duracion)}</span>
        </div>
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Sala:</span>
            <span class="tooltip-info-value">${movie.salaCompleta}</span>
        </div>
        ${showtimesHTML}
    `;
    
    // Verificar si hay filtros activos
    const hasFilters = hasActiveFilters();
    
    // Si hay filtros activos, agregar mensaje
    if (hasFilters) {
        infoElement.innerHTML += `
            <div class="tooltip-info-row" style="color: #3498db; margin-top: 10px;">
                <span class="tooltip-info-label">ℹ️ Nota:</span>
                <span class="tooltip-info-value">Selección deshabilitada con filtros activos</span>
            </div>
        `;
    }
    
    // Verificar si hay traslape con películas seleccionadas
    const startMinutes = timeToMinutes(horario);
    const movieInfo = {
        startMinutes: startMinutes,
        endMinutes: endMinutes
    };
    
    const hasOverlap = selectedMovies.some(selected => 
        doMoviesOverlap(selected, movieInfo)
    );
    
    // Configurar acciones
    const movieId = getMovieUniqueId(movie, horario);
    const isSelected = selectedMovies.some(m => m.uniqueId === movieId);
    
    const actionsElement = tooltip.querySelector('.tooltip-actions');
    
    // Solo mostrar botón de selección si:
    // 1. No hay filtros activos
    // 2. No hay traslape (o está seleccionada)
    let selectButton = '';
    if (!hasFilters) {
        if (isSelected) {
            selectButton = `
                <button class="tooltip-btn btn-select selected" 
                        onclick="toggleFromTooltip()">
                    Deseleccionar
                </button>
            `;
        } else if (!hasOverlap) {
            selectButton = `
                <button class="tooltip-btn btn-select" 
                        onclick="toggleFromTooltip()">
                    Seleccionar
                </button>
            `;
        } else {
            // Agregar indicador visual de por qué no se puede seleccionar
            const overlappingMovie = selectedMovies.find(selected => 
                doMoviesOverlap(selected, movieInfo)
            );
            
            infoElement.innerHTML += `
                <div class="tooltip-info-row" style="color: #e74c3c; margin-top: 10px;">
                    <span class="tooltip-info-label">⚠️ Traslape:</span>
                    <span class="tooltip-info-value">${overlappingMovie.titulo} (${overlappingMovie.horario})</span>
                </div>
            `;
        }
    }

    const calendarButton = `
    <button class="tooltip-btn btn-calendar" 
            onclick="window.open(generateCalendarLink(${JSON.stringify(movie).replace(/"/g, '&quot;')}, '${horario}'), '_blank')">
        Agregar al calendario
    </button>
    `;

    const infoButton = movie.href ? `
        <button class="tooltip-btn btn-info" 
                onclick="showMovieInfoModal(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
            Información
        </button>
    ` : '';

    const irComprarButton = movie.href ? `
        <button class="tooltip-btn btn-link"
                onclick="window.open('https://www.cinetecanacional.net/${movie.href}', '_blank')">
            Ir a comprar
        </button>
    ` : '';
    
    actionsElement.innerHTML = `
        <div class="primary-actions">
            ${selectButton}
            ${infoButton}
            </div>
            <div class="secondary-actions">
            ${calendarButton}
            ${irComprarButton}
        </div>
    `;
    
    // Si no hay acciones disponibles, mostrar mensaje apropiado
    if (!selectButton && !movie.href) {
        let message = '';
        if (hasFilters) {
            message = 'Desactiva los filtros para seleccionar películas';
        } else if (hasOverlap) {
            message = 'Esta película se traslapa con tu selección actual';
        }
        
        actionsElement.innerHTML = `
            <div style="text-align: center; color: #7f8c8d; font-style: italic; padding: 10px 0;">
                ${message}
            </div>
        `;
    }
    
    // Mostrar tooltip
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    
    requestAnimationFrame(() => {
        positionTooltip(tooltip, element);
        tooltip.style.visibility = 'visible';
        tooltipOverlay.classList.add('active');
    });
}

// Posicionar tooltip
function positionTooltip(tooltip, element) {
    const rect = element.getBoundingClientRect();
    const scrollContainer = document.getElementById('scheduleContainer');
    const containerRect = scrollContainer.getBoundingClientRect();
    
    // Cambiar el tooltip a position: absolute relativo al viewport
    tooltip.style.position = 'fixed';
    
    // Calcular posición relativa al viewport
    let top = rect.top;
    let left = rect.left;
    
    // Obtener dimensiones reales del tooltip
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height;
    const tooltipWidth = tooltipRect.width;
    
    // Intentar posicionar arriba del elemento
    if (top - tooltipHeight - 10 > 10) {
        top = rect.top - tooltipHeight - 10;
    } else {
        // Si no hay espacio arriba, posicionar abajo
        top = rect.bottom + 10;
    }
    
    // Ajustar horizontalmente para centrar con el movie-block
    left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    
    // Asegurar que no se salga de los límites de la pantalla
    const margin = 10;
    
    // Límite derecho
    if (left + tooltipWidth > window.innerWidth - margin) {
        left = window.innerWidth - tooltipWidth - margin;
    }
    
    // Límite izquierdo
    if (left < margin) {
        left = margin;
    }
    
    // Límite superior
    if (top < margin) {
        top = rect.bottom + 10; // Forzar abajo si no hay espacio arriba
    }
    
    // Límite inferior
    if (top + tooltipHeight > window.innerHeight - margin) {
        top = rect.top - tooltipHeight - 10; // Forzar arriba si no hay espacio abajo
    }
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

// Cerrar tooltip
window.closeTooltip = function() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'none';
    tooltipOverlay.classList.remove('active');
    currentTooltipMovie = null;
    currentTooltipHorario = null;
}

// Toggle selección desde tooltip
window.toggleFromTooltip = function() {
    if (currentTooltipMovie && currentTooltipHorario) {
        toggleMovieSelection(currentTooltipMovie, currentTooltipHorario);
        
        // Actualizar botón en el tooltip
        const movieId = getMovieUniqueId(currentTooltipMovie, currentTooltipHorario);
        const isSelected = selectedMovies.some(m => m.uniqueId === movieId);
        
        const selectBtn = document.querySelector('.tooltip-btn.btn-select');
        if (selectBtn) {
            selectBtn.textContent = isSelected ? 'Deseleccionar' : 'Seleccionar';
            selectBtn.classList.toggle('selected', isSelected);
        }
    }
}

// Cerrar tooltip al hacer scroll
window.addEventListener('scroll', closeTooltip);
document.getElementById('scheduleContainer').addEventListener('scroll', closeTooltip);

// Prevenir cierre al clickear dentro del tooltip
document.getElementById('tooltip').addEventListener('click', (e) => {
    e.stopPropagation();
});

let resizeTimer;
window.addEventListener('resize', () => {
    if (currentTooltipMovie) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Encontrar el elemento actual
            const currentElement = document.querySelector(
                `[data-horario="${currentTooltipHorario}"][data-movie*="${currentTooltipMovie.titulo}"]`
            );
            if (currentElement) {
                const tooltip = document.getElementById('tooltip');
                positionTooltip(tooltip, currentElement);
            }
        }, 100);
    }
});

// Generate Google Calendar link for a movie
window.generateCalendarLink = function(movie, horario) {
    const dateString = document.getElementById('datePicker').value;
    const [hours, minutes] = horario.split(':').map(Number);
    
    const startDate = new Date(dateString + 'T00:00:00');
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + movie.duracion);
    
    // Format dates for Google Calendar in UTC
    const formatDateForCalendar = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };
    
    const startFormatted = formatDateForCalendar(startDate);
    const endFormatted = formatDateForCalendar(endDate);
    
    // Create event details
    const eventTitle = `Cineteca: ${movie.titulo} ${movie.tipoVersion || ''}`;
    const eventDescription = `Película en Cineteca Nacional\nSala: ${movie.salaCompleta}\nDuración: ${movie.duracion} minutos`;
    const eventLocation = `Cineteca Nacional - ${movie.sede}`;
    
    // Generate URL with required parameters
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(eventDescription)}&location=${encodeURIComponent(eventLocation)}&ctz=America/Mexico_City`;
}

function extractFilmId(href) {
    if (!href) return null;
    
    const match = href.match(/FilmId=([^&]+)/);
    return match ? match[1] : null;
}

// Get movie details from API
async function fetchMovieDetails(filmId) {
    if (!filmId) return null;
    
    try {
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2FdetallePelicula.php%3FFilmId%3D${filmId}%26cinemaId%3D000&selector=p%5Bclass*%3D%22lh-1%22%5D%2C+div%5Bclass%3D%22col-12+col-md-3+float-left+small%22%5D&scrape=text&pretty=true`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        const result = {
            info: [],
            showtimes: null
        };
        
        if (data && data.result) {
            // Get movie info
            if (data.result['p[class*="lh-1"]'] && 
                data.result['p[class*="lh-1"]'].length > 0) {
                result.info = data.result['p[class*="lh-1"]'];
            }
            
            // Get all showtimes
            if (data.result['div[class="col-12 col-md-3 float-left small"]'] && 
                data.result['div[class="col-12 col-md-3 float-left small"]'].length > 0) {
                result.showtimes = data.result['div[class="col-12 col-md-3 float-left small"]'][0];
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

// Show movie info modal
window.showMovieInfoModal = async function(movie) {
    const modal = document.getElementById('movieInfoModal');
    const modalTitle = modal.querySelector('.movie-modal-title');
    const modalInfo = modal.querySelector('.movie-modal-info');
    const modalLoading = modal.querySelector('.movie-modal-loading');
    
    // Set title
    modalTitle.textContent = movie.titulo + (movie.tipoVersion ? ` ${movie.tipoVersion}` : '');
    
    // Show modal with loading state
    modalInfo.style.display = 'none';
    modalLoading.style.display = 'block';
    modal.style.display = 'flex';
    
    // Extract FilmId and fetch details
    const filmId = extractFilmId(movie.href);
    
    if (filmId) {
        const [movieDetails, imageUrl] = await Promise.all([
            fetchMovieDetails(filmId),
            fetchMovieImage(filmId)
        ]);
        const paragraphs = movieDetails.info;
        const allShowtimesText = movieDetails.showtimes;
        
        if (paragraphs && paragraphs.length > 0) {
            // Process each paragraph and decode HTML entities
            const decodedParagraphs = paragraphs.map(text => {
                return text
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&oacute;/g, 'ó')
                    .replace(/&eacute;/g, 'é')
                    .replace(/&iacute;/g, 'í')
                    .replace(/&aacute;/g, 'á')
                    .replace(/&uacute;/g, 'ú')
                    .replace(/&ntilde;/g, 'ñ')
                    .replace(/&Aacute;/g, 'Á')
                    .replace(/&Eacute;/g, 'É')
                    .replace(/&Iacute;/g, 'Í')
                    .replace(/&Oacute;/g, 'Ó')
                    .replace(/&Uacute;/g, 'Ú')
                    .replace(/&Ntilde;/g, 'Ñ');
            });
            
            // Extract year from first paragraph using regex
            let year = '';
            let originalTitle = '';
            if (decodedParagraphs[0]) {
                // Look for text inside the first parenthesis
                const parenthesisMatch = decodedParagraphs[0].match(/\(([^)]+)\)/);
                
                if (parenthesisMatch && parenthesisMatch[1]) {
                    const content = parenthesisMatch[1];
                    
                    // Count commas in movie.titulo to know how many commas are part of the title
                    const titleCommaCount = (movie.titulo.match(/,/g) || []).length;
                    
                    // Split content by commas
                    const parts = content.split(',');
                    
                    if (parts.length > titleCommaCount) {
                        // If we have title with commas, join the correct number of parts
                        originalTitle = parts.slice(0, titleCommaCount + 1).join(',').trim();
                    } else {
                        // If not enough parts, use the first part
                        originalTitle = parts[0].trim();
                    }
                    
                    // Extract year
                    const yearMatch = content.match(/\b(19\d{2}|20\d{2})\b/);
                    if (yearMatch) {
                        year = yearMatch[0];
                    }
                } else {
                    // Fallback - extract year from the whole paragraph
                    const yearMatch = decodedParagraphs[0].match(/\b(19\d{2}|20\d{2})\b/);
                    if (yearMatch) {
                        year = yearMatch[0];
                    }
                }
            }
            
            // Format paragraphs with better styling
            let formattedInfo = '';

            if (imageUrl) {
                formattedInfo += `
                    <div class="movie-image-container">
                        <img src="${imageUrl}" alt="${movie.titulo}" class="movie-poster">
                    </div>
                `;
            }
            
            // Primer párrafo (Información general) - destacado
            if (decodedParagraphs[0]) {
                formattedInfo += `<p class="movie-info-general">${decodedParagraphs[0]}</p>`;
            }
            
            // Segundo párrafo (Créditos) - formato estructurado
            if (decodedParagraphs[1]) {
                formattedInfo += `<p class="movie-info-credits">${decodedParagraphs[1]}</p>`;
            }
            
            // Tercer párrafo (Sinopsis) - destacado
            if (decodedParagraphs[2]) {
                formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[2]}</p>`;
            }
            
            if (allShowtimesText) {
                const allShowtimes = parseAllShowtimes(allShowtimesText);
                
                if (allShowtimes.length > 0) {
                    // Añadir botón para mostrar/ocultar todas las funciones
                    formattedInfo += `
                        <div class="all-showtimes-container">
                            <button id="toggleAllShowtimes" class="toggle-showtimes-btn" data-count="${allShowtimes.length}">
                                Ver todas las funciones (${allShowtimes.length})
                            </button>
                            <div id="allShowtimesTable" class="all-showtimes-table" style="display: none;">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Día</th>
                                            <th>Sede</th>
                                            <th>Sala</th>
                                            <th>Horario</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${allShowtimes.map(st => `
                                            <tr>
                                                <td>${st.date}</td>
                                                <td>${st.sede}</td>
                                                <td>SALA ${st.sala}</td>
                                                <td>${st.horario}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
            }
            
            // Add search buttons
            const searchTitle = originalTitle || movie.titulo.trim();
            const imdbUrl = year 
                ? `https://www.imdb.com/es/search/title/?title=${encodeURIComponent(searchTitle)}&title_type=feature,short&release_date=${year}-01-01,${year}-12-31` 
                : `https://www.imdb.com/es/search/title/?title=${encodeURIComponent(searchTitle)}&title_type=feature,short`;
            const letterboxdUrl = `https://letterboxd.com/search/films/${searchTitle.replace(/\s+/g, '+')}${year ? '+' + year : ''}/`;
            const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTitle + (year ? ' ' + year : '') + ' trailer')}`;

            
            formattedInfo += `
                <div class="movie-search-links">
                    <p class="search-links-title">Buscar con:</p>
                    <div class="search-buttons">
                        <a href="${imdbUrl}" target="_blank" rel="noopener noreferrer" class="search-button imdb-button">IMDB</a>
                        <a href="${letterboxdUrl}" target="_blank" rel="noopener noreferrer" class="search-button letterboxd-button">Letterboxd</a>
                        <a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" class="search-button youtube-button">YouTube</a>
                    </div>
                </div>
            `;
            
            modalInfo.innerHTML = formattedInfo;
            modalInfo.style.display = 'block';

            // Add event listener for toggle button
            const toggleBtn = document.getElementById('toggleAllShowtimes');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    const tableElement = document.getElementById('allShowtimesTable');
                    if (tableElement.style.display === 'none') {
                        tableElement.style.display = 'block';
                        toggleBtn.textContent = 'Ocultar funciones';
                    } else {
                        tableElement.style.display = 'none';
                        // Use the data attribute instead of trying to access allShowtimes variable
                        const count = toggleBtn.getAttribute('data-count');
                        toggleBtn.textContent = `Ver todas las funciones (${count})`;
                    }
                });
            }


        } else {
            modalInfo.innerHTML = 'No se pudo obtener información adicional para esta película.';
            modalInfo.style.display = 'block';
        }
    } else {
        modalInfo.innerHTML = 'No hay información detallada disponible para esta película.';
        modalInfo.style.display = 'block';
    }
    
    modalLoading.style.display = 'none';
}

// Close movie info modal
window.closeMovieInfoModal = function() {
    const modal = document.getElementById('movieInfoModal');
    modal.style.display = 'none';
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('movieInfoModal');
    if (event.target === modal) {
        closeMovieInfoModal();
    }
});

const VISITED_MOVIES_KEY = 'cinetkVisitedMovies';

function markMovieAsVisited(movie, horario) {
    const movieId = getMovieUniqueId(movie, horario);
    
    let visitedMovies = JSON.parse(localStorage.getItem(VISITED_MOVIES_KEY) || '[]');
    
    if (!visitedMovies.includes(movieId)) {
        visitedMovies.push(movieId);
        localStorage.setItem(VISITED_MOVIES_KEY, JSON.stringify(visitedMovies));
    }
}

function isMovieVisited(movieId) {
    const visitedMovies = JSON.parse(localStorage.getItem(VISITED_MOVIES_KEY) || '[]');
    return visitedMovies.includes(movieId);
}

function formatDuration(durationInMinutes) {
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    
    if (hours === 0) {
        return `${minutes} minutos`;
    } else if (minutes === 0) {
        return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
        return `${hours} ${hours === 1 ? 'hora' : 'horas'} y ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    }
}

function findAllShowtimesForMovie(movieTitle, currentSedeId, currentSala, currentHorario) {
    const showtimes = [];
    
    // Iterate through all active sedes
    for (const sedeId of activeSedes) {
        if (!movieData[sedeId]) continue;
        
        // Find all movies with matching title in this sede
        const matchingMovies = movieData[sedeId].filter(movie => 
            movie.titulo.toLowerCase() === movieTitle.toLowerCase()
        );
        
        // Collect all showtimes for matching movies
        for (const movie of matchingMovies) {
            for (const horario of movie.horarios) {
                // Skip the current showtime
                if (sedeId === currentSedeId && movie.sala === currentSala && horario === currentHorario) {
                    continue;
                }
                
                showtimes.push({
                    sede: movie.sede,
                    sala: movie.sala,
                    horario: horario,
                    sedeId: sedeId,
                    salaCompleta: movie.salaCompleta
                });
            }
        }
    }
    
    // Sort by time
    showtimes.sort((a, b) => {
        const timeA = timeToMinutes(a.horario);
        const timeB = timeToMinutes(b.horario);
        return timeA - timeB;
    });
    
    return showtimes;
}

// Parse all showtimes from text for modal
function parseAllShowtimes(showtimesText) {
    if (!showtimesText) return [];
    
    // Split by days (each day starts with a day of week)
    const dayPattern = /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s+(\d+)\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi;
    
    // Split text by day headers
    const parts = showtimesText.split(dayPattern);
    
    const showtimes = [];
    
    // First element is empty, then we have groups of [dayName, day, month, year, content]
    for (let i = 1; i < parts.length; i += 5) {
        if (i + 4 >= parts.length) break;
        
        const dayName = parts[i];
        const day = parts[i + 1];
        const month = parts[i + 2];
        const year = parts[i + 3];
        const content = parts[i + 4];
        
        const dateStr = `${dayName} ${day} de ${month} de ${year}`;
        
        // Find all sala blocks
        const salaMatches = content.matchAll(/SALA\s+(\d+)\s+(CNA|Xoco):\s*((?:\d{1,2}:\d{2}(?:\s+|$|\n))+)/gi);
        
        for (const match of salaMatches) {
            const sala = match[1];
            const sede = match[2] === 'CNA' ? 'CENART' : 'XOCO';
            const horariosBlock = match[3];
            
            // Extract each horario from the block
            const timePattern = /\d{1,2}:\d{2}/g;
            let timeMatch;
            
            while ((timeMatch = timePattern.exec(horariosBlock)) !== null) {
                const horario = timeMatch[0];
                
                showtimes.push({
                    date: dateStr,
                    sala: sala,
                    sede: sede,
                    horario: horario
                });
            }
        }
    }
    
    // Sort by date, sede, sala, and time
    return showtimes.sort((a, b) => {
        // Extract date components for proper sorting
        const aDateParts = a.date.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
        const bDateParts = b.date.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
        
        const months = {
            'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
            'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        };
        
        // Create Date objects for comparison
        const aDate = new Date(aDateParts[3], months[aDateParts[2]], aDateParts[1]);
        const bDate = new Date(bDateParts[3], months[bDateParts[2]], bDateParts[1]);
        
        // Compare dates
        if (aDate.getTime() !== bDate.getTime()) {
            return aDate.getTime() - bDate.getTime();
        }
        
        // Same date, sort by sede
        if (a.sede !== b.sede) {
            return a.sede.localeCompare(b.sede);
        }
        
        // Same sede, sort by sala
        if (a.sala !== b.sala) {
            return parseInt(a.sala) - parseInt(b.sala);
        }
        
        // Same sala, sort by time
        return timeToMinutes(a.horario) - timeToMinutes(b.horario);
    });
}

async function fetchMovieImage(filmId) {
    if (!filmId) return null;
    
    try {
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2FdetallePelicula.php%3FFilmId%3D${filmId}%26cinemaId%3D000&selector=img%5Bclass%3D%22img-fluid%22%5D&scrape=attr&attr=src&pretty=true`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data && data.result) {
            return data.result;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching movie image:', error);
        return null;
    }
}