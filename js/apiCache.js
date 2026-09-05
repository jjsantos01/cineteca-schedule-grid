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

// Deduplicación de peticiones en vuelo: Map<filmId, Promise<Object|null>>
const inFlightRequests = new Map();

/**
 * Obtiene la entrada de caché si existe y no ha expirado
 * @param {Map} cache 
 * @param {string} key 
 * @returns {{ data: any, timestamp: number } | null}
 */
function getCachedEntry(cache, key) {
    const cached = cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > API_CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return cached;
}

/**
 * Obtiene un item del caché si no ha expirado
 */
function getCachedItem(cache, key) {
    const entry = getCachedEntry(cache, key);
    return entry ? entry.data : null;
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
 * Puebla inmediatamente los tres cachés con la respuesta unificada
 * @param {string} filmId 
 * @param {Object|null} fullData 
 * @returns {{ movieDetails: { info: Array<string>, showtimes: Array|null }, imageUrl: string, trailerUrl: string|null }}
 */
function populateCaches(filmId, fullData) {
    const movieDetails = {
        info: fullData?.info || [],
        showtimes: fullData?.showtimes || null
    };
    const imageUrl = fullData?.posterUrl || `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/${filmId}?referenceScheme=Cinema&allowPlaceHolder`;
    const trailerUrl = fullData?.trailerUrl || null;

    if (fullData) {
        setCachedItem(movieDetailsCache, filmId, movieDetails);
        setCachedItem(movieImageCache, filmId, imageUrl);
        setCachedItem(movieTrailerCache, filmId, trailerUrl);
    }

    return {
        movieDetails,
        imageUrl,
        trailerUrl
    };
}

/**
 * Obtiene datos completos de la película desde cinetkv2 con deduplicación de peticiones en vuelo
 * @param {string} filmId
 * @returns {Promise<Object|null>}
 */
function fetchFullMovieDetails(filmId) {
    if (!filmId) return Promise.resolve(null);

    // Si ya existe una petición en curso para este filmId, reutilizarla
    if (inFlightRequests.has(filmId)) {
        return inFlightRequests.get(filmId);
    }

    const requestPromise = (async () => {
        try {
            const url = MOVIE_DETAILS_API_URL.replace('{filmId}', filmId);
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.error('Error fetching full movie details:', e);
            return null;
        } finally {
            inFlightRequests.delete(filmId);
        }
    })();

    inFlightRequests.set(filmId, requestPromise);
    return requestPromise;
}

/**
 * Función coordinadora: Obtiene todos los datos de la película (detalles, póster, tráiler)
 * usando caché en memoria y deduplicación de peticiones en vuelo.
 * @param {string} filmId
 * @returns {Promise<{ movieDetails: { info: Array<string>, showtimes: Array|null }, imageUrl: string, trailerUrl: string|null }>}
 */
export async function fetchMovieDataWithCache(filmId) {
    if (!filmId) {
        return {
            movieDetails: { info: [], showtimes: null },
            imageUrl: null,
            trailerUrl: null
        };
    }

    const detailsEntry = getCachedEntry(movieDetailsCache, filmId);
    const imageEntry = getCachedEntry(movieImageCache, filmId);
    const trailerEntry = getCachedEntry(movieTrailerCache, filmId);

    if (detailsEntry && imageEntry && trailerEntry) {
        return {
            movieDetails: detailsEntry.data,
            imageUrl: imageEntry.data,
            trailerUrl: trailerEntry.data
        };
    }

    const fullData = await fetchFullMovieDetails(filmId);
    return populateCaches(filmId, fullData);
}

/**
 * Fetch de detalles de película con caché
 */
export async function fetchMovieDetailsWithCache(filmId) {
    if (!filmId) return { info: [], showtimes: null };

    const entry = getCachedEntry(movieDetailsCache, filmId);
    if (entry) {
        return entry.data;
    }

    const data = await fetchMovieDataWithCache(filmId);
    return data.movieDetails;
}

/**
 * Fetch de imagen de película con caché
 */
export async function fetchMovieImageWithCache(filmId) {
    if (!filmId) return null;

    const entry = getCachedEntry(movieImageCache, filmId);
    if (entry) {
        return entry.data;
    }

    const data = await fetchMovieDataWithCache(filmId);
    return data.imageUrl;
}

/**
 * Fetch de trailer de película con caché
 */
export async function fetchMovieTrailerWithCache(filmId) {
    if (!filmId) return null;

    const entry = getCachedEntry(movieTrailerCache, filmId);
    if (entry) {
        return entry.data;
    }

    const data = await fetchMovieDataWithCache(filmId);
    return data.trailerUrl;
}

/**
 * Limpia todos los cachés de API y peticiones en vuelo
 * Se debe llamar cuando se cambia de fecha
 */
export function clearAPICache() {
    movieDetailsCache.clear();
    movieImageCache.clear();
    movieTrailerCache.clear();
    inFlightRequests.clear();
}
