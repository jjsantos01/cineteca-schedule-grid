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
    const tooltip = document.getElementById('tooltip');
    const endMinutes = timeToMinutes(horario) + movie.duracion;
    const endTime = minutesToTime(endMinutes);
    
    currentTooltipMovie = movie;
    currentTooltipHorario = horario;
    
    // Configurar header
    const titleElement = tooltip.querySelector('.tooltip-title');
    titleElement.textContent = `${movie.titulo} ${movie.tipoVersion || ''}`;
    
    // Configurar información
    const infoElement = tooltip.querySelector('.tooltip-info');
    infoElement.innerHTML = `
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Horario:</span>
            <span class="tooltip-info-value">${horario} - ${endTime}</span>
        </div>
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Duración:</span>
            <span class="tooltip-info-value">${movie.duracion} minutos</span>
        </div>
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Sala:</span>
            <span class="tooltip-info-value">${movie.salaCompleta}</span>
        </div>
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
    
    actionsElement.innerHTML = `
        <div class="primary-actions">
            ${selectButton}
            ${movie.href ? `
                <button class="tooltip-btn btn-link" 
                        onclick="window.open('https://www.cinetecanacional.net/${movie.href}', '_blank')">
                    Ver más info
                </button>
            ` : ''}
        </div>
        <div class="secondary-actions">
            ${calendarButton}
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