/**
 * Sistema de caché en memoria para respuestas de API y catálogo precargado
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
 * Precarga el catálogo completo de películas desde el feed consolidado en los cachés en memoria
 * @param {Object} moviesMap Mapa de filmId -> objeto de película con sinopsis, créditos, posters y trailer
 */
export function primeMovieCatalog(moviesMap) {
    if (!moviesMap || typeof moviesMap !== 'object') return;

    for (const [filmId, meta] of Object.entries(moviesMap)) {
        if (!filmId || !meta) continue;

        const info = Array.isArray(meta.info) && meta.info.length > 0
            ? meta.info
            : [meta.generalInfo, meta.credits, meta.synopsis].filter(Boolean);

        const movieDetails = {
            info: info,
            showtimes: null,
            generalInfo: meta.generalInfo || '',
            credits: meta.credits || '',
            synopsis: meta.synopsis || '',
            title: meta.titulo || ''
        };

        const imageUrl = meta.stillUrl || meta.posterUrl || `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmStill/${filmId}?referenceScheme=Cinema&allowPlaceHolder=true`;
        const trailerUrl = meta.trailerUrl || null;

        setCachedItem(movieDetailsCache, filmId, movieDetails);
        setCachedItem(movieImageCache, filmId, imageUrl);
        setCachedItem(movieTrailerCache, filmId, trailerUrl);
    }
}

/**
 * Función coordinadora: Obtiene todos los datos de la película (detalles, póster, tráiler)
 * desde el caché en memoria precargado por el feed consolidado.
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

    if (detailsEntry || imageEntry || trailerEntry) {
        return {
            movieDetails: detailsEntry?.data || { info: [], showtimes: null },
            imageUrl: imageEntry?.data || `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmStill/${filmId}?referenceScheme=Cinema&allowPlaceHolder=true`,
            trailerUrl: trailerEntry?.data || null
        };
    }

    return {
        movieDetails: { info: [], showtimes: null },
        imageUrl: `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmStill/${filmId}?referenceScheme=Cinema&allowPlaceHolder=true`,
        trailerUrl: null
    };
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
