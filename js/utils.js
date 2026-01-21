import { HOUR_WIDTH } from './config.js';

export function formatDate(date) {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function minutesToPosition(minutes, startHour) {
    const startMinutes = startHour * 60;
    const minutesFromStart = minutes - startMinutes;
    return (minutesFromStart / 60) * HOUR_WIDTH;
}

export function calculateTimeRange(movieData) {
    let minTime = 24 * 60;
    let maxTime = 0;

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

    const minHour = Math.floor(minTime / 60);
    const maxHour = Math.ceil(maxTime / 60) + 1;
    return {
        startHour: Math.max(0, minHour),
        endHour: Math.min(24, maxHour)
    };
}

export function updateURLParams(params) {
    const url = new URL(window.location);
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    });
    window.history.replaceState({}, '', url);
}

export function getURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        date: urlParams.get('date'),
        sedes: urlParams.get('sedes'),
        filter: urlParams.get('filter'),
        timeStart: urlParams.get('timeStart'),
        timeEnd: urlParams.get('timeEnd')
    };
}

export function showLoading() {
    document.getElementById('scheduleContainer').innerHTML = '<div class="loading">Cargando cartelera...</div>';
}

export function showError(message) {
    document.getElementById('scheduleContainer').innerHTML = `<div class="error">${message}</div>`;
}

export function isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
}

export function getMovieUniqueId(movie, horario) {
    return `${movie.sedeId}-${movie.sala}-${horario}-${movie.titulo}`;
}

export function formatDuration(durationInMinutes) {
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;

    if (hours === 0) {
        return `${minutes} minutos`;
    }

    if (minutes === 0) {
        return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }

    return `${hours} ${hours === 1 ? 'hora' : 'horas'} y ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
}

export function doMoviesOverlap(movie1, movie2) {
    return movie1.startMinutes < movie2.endMinutes && movie2.startMinutes < movie1.endMinutes;
}
export function extractFilmId(href) {
    if (!href) {
        return null;
    }

    const match = href.match(/FilmId=([^&]+)/);
    return match ? match[1] : null;
}

export function getYouTubeEmbedUrl(youtubeUrl) {
    if (!youtubeUrl) return null;

    let videoId = null;
    if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
    } else if (youtubeUrl.includes('youtube.com/watch?v=')) {
        videoId = youtubeUrl.split('v=')[1].split('&')[0];
    } else if (youtubeUrl.includes('youtube.com/embed/')) {
        videoId = youtubeUrl.split('embed/')[1].split('?')[0];
    }

    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }

    return null;
}
