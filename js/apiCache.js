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
 * Fetch de detalles de película con caché
 */
export async function fetchMovieDetailsWithCache(filmId) {
    if (!filmId) return { info: [], showtimes: null };

    const cached = getCachedItem(movieDetailsCache, filmId);
    if (cached) {
        return cached;
    }

    try {
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2FdetallePelicula.php%3FFilmId%3D${filmId}%26cinemaId%3D000&selector=p%5Bclass*%3D%22lh-1%22%5D%2C+div%5Bclass%3D%22col-12+col-md-3+float-left+small%22%5D&scrape=text&pretty=true`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        const result = { info: [], showtimes: null };
        if (data && data.result) {
            if (data.result['p[class*="lh-1"]'] && data.result['p[class*="lh-1"]'].length > 0) {
                result.info = data.result['p[class*="lh-1"]'];
            }
            if (data.result['div[class="col-12 col-md-3 float-left small"]'] &&
                data.result['div[class="col-12 col-md-3 float-left small"]'].length > 0) {
                result.showtimes = data.result['div[class="col-12 col-md-3 float-left small"]'][0];
            }
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
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2FdetallePelicula.php%3FFilmId%3D${filmId}%26cinemaId%3D000&selector=img%5Bclass%3D%22img-fluid%22%5D&scrape=attr&attr=src&pretty=true`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        const result = data?.result ?? null;
        setCachedItem(movieImageCache, filmId, result);
        return result;
    } catch (error) {
        console.error('Error fetching movie image:', error);
        return null;
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
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2Fsedes%2FdetallePelicula.php%3FFilmId%3D${filmId}&selector=%5Bclass%3D%22float-left+ml-2%22%5D+%3E+a&scrape=attr&attr=href&pretty=true`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        const result = data?.result ?? null;
        setCachedItem(movieTrailerCache, filmId, result);
        return result;
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
