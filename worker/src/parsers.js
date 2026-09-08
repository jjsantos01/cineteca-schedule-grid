/**
 * Cloudflare Worker: cinetk
 * Módulo de Parsers HTML y Extracción mediante Expresiones Regulares
 */

import { SEDE_CODES, SEDE_NAMES } from './config.js';
import { getPosterUrl } from './utils.js';

/**
 * Parser de la respuesta HTML de data/cartelera.php (duraciones, director, país, año)
 */
export function parseCarteleraDurations(html) {
    const map = new Map();
    if (!html) return map;

    const items = [...html.matchAll(/onclick=location\.href="detallePelicula\.php\?FilmId=([^&"]+)&cinemas=([^"]+)"[\s\S]*?<div class="text-uppercase font-weight-bold"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<p>\(([\s\S]*?)\)<\/p>/gi)];

    for (const item of items) {
        const filmId = item[1];
        const title = item[3].trim();
        const details = item[4].trim();

        const durMatch = details.match(/Dur\.\s*:\s*(\d+)\s*mins?/i);
        const duration = durMatch ? parseInt(durMatch[1], 10) : 90;

        const parts = details.split(',').map(p => p.trim());
        const yearMatch = details.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? yearMatch[1] : '';

        let originalTitle = '';
        let country = '';
        if (parts.length >= 3) {
            originalTitle = parts[0];
            country = parts[1];
        } else if (parts.length === 2) {
            country = parts[0];
        }

        map.set(filmId, {
            filmId,
            title,
            duration,
            originalTitle,
            country,
            year,
            details
        });
    }

    return map;
}

/**
 * Parser del catálogo de sesiones semanales de Vista Cinema (Cinemas/Details/{cinemaId})
 */
export function parseVistaSessions(html, dia, cinemaId) {
    const movies = [];
    if (!html) return movies;

    const filmBlockRegex = /<div class="film-item[^"]*"[^>]*data-movie-id="([^"]+)"[\s\S]*?(?=<div class="film-item\b|$)/g;
    let match;

    while ((match = filmBlockRegex.exec(html)) !== null) {
        const filmId = match[1];
        const block = match[0];

        const titleMatch = block.match(/<h[23][^>]*class="[^"]*film-title[^"]*"[^>]*>([\s\S]*?)<\/h[23]>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Sin Título';

        const sessionMatches = [...block.matchAll(/<a[^>]+href="([^"]*visSelectTickets[^"]*)"[^>]*>[\s\S]*?<time datetime="([^"]+)">([^<]+)<\/time>/gi)];

        const horarios = [];
        const sessions = [];
        const ticketUrls = {};
        const allShowtimes = [];

        for (const sm of sessionMatches) {
            const ticketUrl = sm[1].replace(/&amp;/g, '&');
            const fullDateTime = sm[2];
            const displayTime = sm[3].trim();
            const sessionUrl = ticketUrl.startsWith('//') ? `https:${ticketUrl}` : ticketUrl;

            const sessionIdMatch = ticketUrl.match(/txtSessionId=(\d+)/i) || ticketUrl.match(/SessionId=(\d+)/i);
            const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;

            const datePart = fullDateTime.includes('T') ? fullDateTime.split('T')[0] : fullDateTime.split(' ')[0];
            const timePartMatch = fullDateTime.match(/(\d{1,2}:\d{2})/);

            let formattedTime = '';
            if (timePartMatch) {
                const [h, m] = timePartMatch[1].split(':');
                formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            } else {
                const dateObj = new Date(fullDateTime);
                if (!isNaN(dateObj.getTime())) {
                    const hours = String(dateObj.getHours()).padStart(2, '0');
                    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                    formattedTime = `${hours}:${minutes}`;
                }
            }

            if (formattedTime && datePart) {
                allShowtimes.push({
                    date: datePart,
                    time: formattedTime,
                    displayTime: displayTime || formattedTime,
                    ticketUrl: sessionUrl,
                    sessionId,
                    sedeId: cinemaId,
                    sede: SEDE_NAMES[cinemaId] || cinemaId,
                    sedeCodigo: SEDE_CODES[cinemaId] || cinemaId
                });
            }

            if (fullDateTime.startsWith(dia) && formattedTime) {
                horarios.push(formattedTime);

                sessions.push({
                    sessionId,
                    ticketUrl: sessionUrl,
                    time: formattedTime,
                    displayTime
                });

                ticketUrls[formattedTime] = sessionUrl;
            }
        }

        if (horarios.length > 0) {
            horarios.sort();
            sessions.sort((a, b) => a.time.localeCompare(b.time));
            allShowtimes.sort((a, b) => {
                const dateCmp = a.date.localeCompare(b.date);
                if (dateCmp !== 0) return dateCmp;
                return a.time.localeCompare(b.time);
            });

            movies.push({
                filmId,
                titulo: title,
                tipoVersion: '',
                horarios,
                sessions,
                allShowtimes,
                ticketUrls,
                sedeId: cinemaId,
                sede: SEDE_NAMES[cinemaId] || cinemaId,
                sedeCodigo: SEDE_CODES[cinemaId] || cinemaId,
                href: `detallePelicula.php?FilmId=${filmId}`,
                posterUrl: getPosterUrl(filmId)
            });
        }
    }

    return movies;
}

/**
 * Parser de la ficha técnica completa en HTML (detallePelicula.php)
 */
export function parseMovieDetailsHtml(html, filmId) {
    const titleMatch = html.match(/class=['"][^'"]*font-weight-bold[^'"]*text-uppercase[^'"]*h[1234][^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<div class=['"]h[1234] text-uppercase font-weight-bold['"][^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const genMatch = html.match(/<p class=['"]lh-1['"]>\s*(\([^<]+\))\s*<\/p>/i);
    const generalInfo = genMatch ? genMatch[1].trim() : '';

    let credits = '';
    let synopsis = '';
    const collapseMatch = html.match(/id=['"]collapseReseña['"][^>]*>[\s\S]*?<div class=['"]card card-body['"]>([\s\S]*?)<\/div>/i)
        || html.match(/<div class=['"]card card-body['"]>([\s\S]*?)<\/div>/i);

    if (collapseMatch) {
        const bodyHtml = collapseMatch[1];
        const ps = [...bodyHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
            .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        if (ps.length >= 1) credits = ps[0];
        if (ps.length >= 2) synopsis = ps[1];
    }

    const info = [];
    if (generalInfo) info.push(generalInfo);
    if (credits) info.push(credits);
    if (synopsis) info.push(synopsis);

    if (info.length === 0) {
        const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
            .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(t => t && !t.match(/^(sinopsis:|trailer:|cartelera|foro al aire libre|programa mensual|desarrollo académico|acervos|centro de documentación|videoteca digital|exposiciones|circuito cineteca|cafeteria|quienes somos|directorio|prensa|transparencia|sedes|contacto|consulta|enlaces de interés|siguenos|aliados|algunos derechos|horario de atención|si tu duda)/i));
        info.push(...pMatches.slice(0, 3));
    }

    let trailerUrl = null;
    const iframeMatch = html.match(/<iframe[^>]+src="([^"]+youtube[^"]+)"/i);
    if (iframeMatch) {
        trailerUrl = iframeMatch[1];
    } else {
        const ytLinkMatch = html.match(/href="([^"]+youtu\.?be[^"]+)"/i);
        if (ytLinkMatch) trailerUrl = ytLinkMatch[1];
    }

    const stillMatch = html.match(/src=['"]([^'"]*FilmStill[^'"]*)['"]/i);
    const posterUrl = stillMatch
        ? (stillMatch[1].startsWith('//') ? `https:${stillMatch[1]}` : stillMatch[1])
        : `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmStill/${filmId}?referenceScheme=Cinema&allowPlaceHolder=true`;

    return {
        filmId,
        title,
        info,
        generalInfo,
        credits,
        synopsis,
        posterUrl,
        posterUrlLarge: posterUrl,
        trailerUrl
    };
}
