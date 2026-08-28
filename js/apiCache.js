import { MOVIE_DETAILS_API_URL } from './config.js';

/**
 * Sistema de caché en memoria para respuestas de API
 * TTL: 1 hora para navegación rápida entre películas
 */

const API_CACHE_TTL = 60 * 60 * 1000; // 1 hora en milisegundos

// Caché en memoria: Map<filmId, { data, timestamp }>
const movieDetailsCache = new Map();
const movieImageCache = new Map();
const movieTrailerCache = new Map();

/**
 * Obtiene un item del caché si no ha expirado
 */
function getCachedItem(cache, key) {
    const cached = cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > API_CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return cached.data;
}

/**
 * Guarda un item en el caché con timestamp
 */
function setCachedItem(cache, key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Obtiene datos completos de la película desde cinetkv2
 */
async function fetchFullMovieDetails(filmId) {
    if (!filmId) return null;
    try {
        const url = MOVIE_DETAILS_API_URL.replace('{filmId}', filmId);
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error('Error fetching full movie details:', e);
        return null;
    }
}

/**
 * Fetch de detalles de película con caché
 */
export async function fetchMovieDetailsWithCache(filmId) {
    if (!filmId) return { info: [], showtimes: null };

    const cached = getCachedItem(movieDetailsCache, filmId);
    if (cached) {
        return cached;
    }

    try {
        const fullData = await fetchFullMovieDetails(filmId);
        const result = {
            info: fullData?.info || [],
            showtimes: fullData?.showtimes || null
        };

        if (fullData?.posterUrl) {
            setCachedItem(movieImageCache, filmId, fullData.posterUrl);
        }
        if (fullData?.trailerUrl) {
            setCachedItem(movieTrailerCache, filmId, fullData.trailerUrl);
        }

        setCachedItem(movieDetailsCache, filmId, result);
        return result;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return { info: [], showtimes: null };
    }
}

/**
 * Fetch de imagen de película con caché
 */
export async function fetchMovieImageWithCache(filmId) {
    if (!filmId) return null;

    const cached = getCachedItem(movieImageCache, filmId);
    if (cached !== null) {
        return cached;
    }

    try {
        const fullData = await fetchFullMovieDetails(filmId);
        const posterUrl = fullData?.posterUrl || `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/${filmId}?referenceScheme=Cinema&allowPlaceHolder`;
        setCachedItem(movieImageCache, filmId, posterUrl);
        return posterUrl;
    } catch (error) {
        console.error('Error fetching movie image:', error);
        return `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/${filmId}?referenceScheme=Cinema&allowPlaceHolder`;
    }
}

/**
 * Fetch de trailer de película con caché
 */
export async function fetchMovieTrailerWithCache(filmId) {
    if (!filmId) return null;

    const cached = getCachedItem(movieTrailerCache, filmId);
    if (cached !== null) {
        return cached;
    }

    try {
        const fullData = await fetchFullMovieDetails(filmId);
        const trailerUrl = fullData?.trailerUrl || null;
        setCachedItem(movieTrailerCache, filmId, trailerUrl);
        return trailerUrl;
    } catch (error) {
        console.error('Error fetching movie trailer:', error);
        return null;
    }
}

/**
 * Limpia todos los cachés de API
 * Se debe llamar cuando se cambia de fecha
 */
export function clearAPICache() {
    movieDetailsCache.clear();
    movieImageCache.clear();
    movieTrailerCache.clear();
}
