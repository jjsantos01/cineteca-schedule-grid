import { timeToMinutes, minutesToTime, getMovieUniqueId } from './utils.js';

/**
 * Decodifica entidades HTML comunes en texto español
 */
export function decodeHTMLEntities(text) {
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&oacute;/g, 'ó')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&aacute;/g, 'á')
        .replace(/&uacute;/g, 'ú')
        .replace(/&ntilde;/g, 'ñ')
        .replace(/&Aacute;/g, 'Á')
        .replace(/&Eacute;/g, 'É')
        .replace(/&Iacute;/g, 'Í')
        .replace(/&Oacute;/g, 'Ó')
        .replace(/&Uacute;/g, 'Ú')
        .replace(/&Ntilde;/g, 'Ñ');
}

/**
 * Extrae año y título original del primer párrafo de información
 * @param {string} firstParagraph - Primer párrafo de la información de la película
 * @param {string} movieTitle - Título de la película para comparación
 * @returns {{ year: string, originalTitle: string }}
 */
export function extractMovieMetadata(firstParagraph, movieTitle = '') {
    let year = '';
    let originalTitle = '';

    if (!firstParagraph) {
        return { year, originalTitle };
    }

    const parenthesisMatch = firstParagraph.match(/\(([^)]+)\)/);
    if (parenthesisMatch && parenthesisMatch[1]) {
        const content = parenthesisMatch[1];
        const titleCommaCount = (movieTitle.match(/,/g) || []).length;
        const parts = content.split(',');

        if (parts.length > titleCommaCount) {
            originalTitle = parts.slice(0, titleCommaCount + 1).join(',').trim();
        } else {
            originalTitle = parts[0].trim();
        }

        const yearMatch = content.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
            year = yearMatch[0];
        }
    } else {
        const yearMatch = firstParagraph.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
            year = yearMatch[0];
        }
    }

    return { year, originalTitle };
}

/**
 * Genera URLs de búsqueda para servicios externos
 * @param {string} searchTitle - Título para búsqueda (original o título de la película)
 * @param {string} year - Año de la película (opcional)
 * @returns {{ imdbUrl: string, letterboxdUrl: string, youtubeUrl: string }}
 */
export function generateSearchURLs(searchTitle, year = '') {
    const imdbUrl = year
        ? `https://www.imdb.com/es/search/title/?title=${encodeURIComponent(searchTitle)}&title_type=feature,short&release_date=${year}-01-01,${year}-12-31`
        : `https://www.imdb.com/es/search/title/?title=${encodeURIComponent(searchTitle)}&title_type=feature,short`;

    const letterboxdUrl = `https://letterboxd.com/search/films/${searchTitle.replace(/\s+/g, '+')}${year ? '+' + year : ''}/`;

    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${searchTitle} ${year ? year + ' ' : ''}trailer`)}`;

    return { imdbUrl, letterboxdUrl, youtubeUrl };
}

/**
 * Formatea el título de la película con versión (si existe)
 * @param {string} title - Título de la película
 * @param {string} version - Versión (DOB, SUB, etc.)
 * @param {boolean} includeSpace - Si debe incluir espacio antes de la versión
 * @returns {string}
 */
export function formatMovieTitle(title, version = '', includeSpace = true) {
    if (!version) {
        return title;
    }
    return includeSpace ? `${title} ${version}` : `${title}${version}`;
}

/**
 * Obtiene o calcula datos enriquecidos para un horario específico de una película
 * Usa caché lazy almacenado en movie._enrichedShowtimes
 * @param {Object} movie - Objeto de película
 * @param {string} horario - Horario en formato HH:MM
 * @returns {{ startMinutes: number, endMinutes: number, endTime: string, uniqueId: string }}
 */
export function getEnrichedShowtime(movie, horario) {
    // Inicializar caché si no existe o si no es un Map (por serialización JSON)
    if (!movie._enrichedShowtimes || !(movie._enrichedShowtimes instanceof Map)) {
        movie._enrichedShowtimes = new Map();
    }

    // Retornar desde caché si existe
    if (movie._enrichedShowtimes.has(horario)) {
        return movie._enrichedShowtimes.get(horario);
    }

    // Calcular y cachear
    const startMinutes = timeToMinutes(horario);
    const endMinutes = startMinutes + movie.duracion;
    const endTime = minutesToTime(endMinutes);
    const uniqueId = getMovieUniqueId(movie, horario);

    const enriched = {
        startMinutes,
        endMinutes,
        endTime,
        uniqueId
    };

    movie._enrichedShowtimes.set(horario, enriched);
    return enriched;
}
