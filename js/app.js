// Handle movie filter
function handleMovieFilter(filterText) {
    movieFilter = filterText.toLowerCase();
    applyMovieFilter();
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

// Update date display
function updateDateDisplay() {
    document.getElementById('currentDate').textContent = formatDate(currentDate);
    
    // Update button states
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = new Date(currentDate);
    current.setHours(0, 0, 0, 0);
    
    prevBtn.disabled = current <= today;
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);
    nextBtn.disabled = current >= maxDate;
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
        updateDateDisplay();
        loadAndRenderMovies();
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

// Initialize application
function init() {
    // Date controls
    document.getElementById('prevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDay').addEventListener('click', () => changeDate(1));
    
    // Sede checkboxes
    document.getElementById('cenart').addEventListener('change', (e) => {
        toggleSede('002', e.target.checked);
    });
    
    document.getElementById('xoco').addEventListener('change', (e) => {
        toggleSede('003', e.target.checked);
    });
    
    // Movie filter
    const movieFilterInput = document.getElementById('movieFilter');
    movieFilterInput.addEventListener('input', (e) => {
        handleMovieFilter(e.target.value);
    });
    
    // Initial load
    updateDateDisplay();
    loadAndRenderMovies();
    
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