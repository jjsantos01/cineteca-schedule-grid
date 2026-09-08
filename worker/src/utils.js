/**
 * Cloudflare Worker: cinetk
 * Módulo de Utilidades de Fecha, Tiempo, Ordenamiento y Respuestas JSON
 */

import { CORS_HEADERS } from './config.js';

export function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
            ...extraHeaders
        }
    });
}

export function assignOutdoorOrSpecialLanes(movies) {
    const outdoorMovies = movies.filter(m => m.sala === 'FORO AL AIRE LIBRE' || m.salaCompleta?.includes('FORO'));
    const standardMovies = movies.filter(m => m.sala !== 'FORO AL AIRE LIBRE' && !m.salaCompleta?.includes('FORO'));

    if (outdoorMovies.length <= 1) {
        return [...standardMovies, ...outdoorMovies];
    }

    const sorted = [...outdoorMovies].sort((a, b) => {
        const minA = a.horarios && a.horarios[0] ? timeToMinutes(a.horarios[0]) : 0;
        const minB = b.horarios && b.horarios[0] ? timeToMinutes(b.horarios[0]) : 0;
        return minA - minB;
    });

    const lanes = [];
    for (const movie of sorted) {
        const start = movie.horarios && movie.horarios[0] ? timeToMinutes(movie.horarios[0]) : 0;
        const end = start + (movie.duracion || 90);

        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i] <= start) {
                lanes[i] = end;
                const laneName = i === 0 ? 'FORO AL AIRE LIBRE' : `FORO AL AIRE LIBRE ${i + 1}`;
                movie.sala = laneName;
                movie.salaCompleta = laneName;
                placed = true;
                break;
            }
        }

        if (!placed) {
            lanes.push(end);
            const laneIndex = lanes.length;
            const laneName = laneIndex === 1 ? 'FORO AL AIRE LIBRE' : `FORO AL AIRE LIBRE ${laneIndex}`;
            movie.sala = laneName;
            movie.salaCompleta = laneName;
        }
    }

    return [...standardMovies, ...sorted];
}

export function sortMoviesBySala(movies) {
    return [...movies].sort((a, b) => {
        const aIsForo = a.sala?.includes('FORO') || a.salaCompleta?.includes('FORO');
        const bIsForo = b.sala?.includes('FORO') || b.salaCompleta?.includes('FORO');

        if (aIsForo && !bIsForo) return 1;
        if (!aIsForo && bIsForo) return -1;

        const aNum = parseInt(a.sala, 10);
        const bNum = parseInt(b.sala, 10);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }

        return (a.salaCompleta || a.sala || '').localeCompare(b.salaCompleta || b.sala || '', 'es', { numeric: true });
    });
}

export function normalizeTitleKey(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

export function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

export function getPosterUrl(filmId) {
    if (!filmId) return null;
    return `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/${filmId}?referenceScheme=Cinema&allowPlaceHolder`;
}

export function extractFilmIdFromHref(href) {
    if (!href) return null;
    const match = href.match(/FilmId=([^&]+)/);
    return match ? match[1] : null;
}

export function getCdmxDate(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

export function getTodayDateString() {
    return getCdmxDate(new Date());
}

export function getNextDatesList(count = 7) {
    const dates = [];
    const todayStr = getTodayDateString();
    const [y, m, d] = todayStr.split('-').map(Number);
    for (let i = 0; i < count; i++) {
        const dt = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
        const year = dt.getUTCFullYear();
        const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dt.getUTCDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }
    return dates;
}
