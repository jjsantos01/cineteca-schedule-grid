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

function minutesToPosition(minutes) {
    const startMinutes = START_HOUR * 60;
    const minutesFromStart = minutes - startMinutes;
    return (minutesFromStart / 60) * HOUR_WIDTH;
}

// UI utilities
function showLoading() {
    document.getElementById('scheduleContainer').innerHTML = '<div class="loading">Cargando cartelera...</div>';
}

function showError(message) {
    document.getElementById('scheduleContainer').innerHTML = `<div class="error">${message}</div>`;
}