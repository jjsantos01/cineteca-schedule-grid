// Main application logic
let currentDate = new Date();
let activeSedes = new Set(['003']); // XOCO by default
let movieData = {};
let isLoading = false;

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
function toggleSede(sedeId, isChecked) {
    if (isChecked) {
        activeSedes.add(sedeId);
    } else {
        activeSedes.delete(sedeId);
    }
    loadAndRenderMovies();
}

// Load and render movies
async function loadAndRenderMovies() {
    if (isLoading) return;
    
    isLoading = true;
    showLoading();
    
    try {
        movieData = await loadMovies(activeSedes, currentDate);
        renderSchedule(movieData);
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