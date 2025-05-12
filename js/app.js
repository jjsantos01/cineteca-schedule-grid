// Main application logic
let currentDate = new Date();
let activeSedes = new Set(['003']); // XOCO by default
let movieData = {};
let cachedData = {}; // Cache for already loaded data
let isLoading = false;
let loadingSedes = new Set(); // Track which sedes are currently loading

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
    if (isChecked) {
        activeSedes.add(sedeId);
        if (!movieData[sedeId] || !isSameDate(cachedData[sedeId]?.date, currentDate)) {
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

// Check if two dates are the same day
function isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
}

// Load data for a specific sede
async function loadSedeData(sedeId) {
    if (loadingSedes.has(sedeId)) return; // Already loading this sede
    
    loadingSedes.add(sedeId);
    
    try {
        // Show loading indicator for this sede
        updateLoadingState();
        
        const movies = await fetchMoviesForSede(sedeId, currentDate);
        movieData[sedeId] = movies;
        cachedData[sedeId] = { data: movies, date: new Date(currentDate) };
        
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
        
        if (Object.keys(getCurrentMovieData()).length === 0) {
            container.innerHTML = '<div class="error">No hay películas disponibles para las sedes seleccionadas</div>';
        }
        return;
    }
    
    if (loadingSedes.size > 0) {
        // Show which sedes are loading
        const loadingSedeNames = Array.from(loadingSedes).map(id => SEDES[id].nombre).join(', ');
        const currentData = getCurrentMovieData();
        
        if (Object.keys(currentData).length > 0) {
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
    
    // Clear cache when date changes
    if (!isSameDate(cachedData.lastDate, currentDate)) {
        movieData = {};
        cachedData = { lastDate: new Date(currentDate) };
    }
    
    showLoading();
    
    try {
        // Load data for all active sedes that don't have cached data
        const promises = [];
        for (const sedeId of activeSedes) {
            if (!movieData[sedeId] || !isSameDate(cachedData[sedeId]?.date, currentDate)) {
                promises.push(loadSedeData(sedeId));
            }
        }
        
        if (promises.length > 0) {
            await Promise.all(promises);
        } else {
            // All data is cached, just render
            renderSchedule(getCurrentMovieData());
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
    
    // Initial load
    updateDateDisplay();
    loadAndRenderMovies();
    
    // Update time every minute
    setInterval(() => {
        updateDateDisplay();
    }, 60000);
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);