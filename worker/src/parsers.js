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
 * Extraer todas las fechas únicas disponibles (>= minDateStr) presentes en el HTML de Vista
 * @param {Array<string>} htmlList Arreglo de contenidos HTML de las sedes
 * @param {string} minDateStr Fecha mínima en formato YYYY-MM-DD (ej. hoy en CDMX)
 * @returns {Array<string>} Lista ordenada de fechas YYYY-MM-DD con funciones publicadas
 */
export function extractAvailableDatesFromVista(htmlList, minDateStr) {
    const datesSet = new Set();
    const timeRegex = /<time datetime="([^"]+)">/gi;

    for (const html of (htmlList || [])) {
        if (!html) continue;
        let match;
        while ((match = timeRegex.exec(html)) !== null) {
            const fullDateTime = match[1];
            const datePart = fullDateTime.includes('T')
                ? fullDateTime.split('T')[0]
                : fullDateTime.split(' ')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && (!minDateStr || datePart >= minDateStr)) {
                datesSet.add(datePart);
            }
        }
    }

    if (datesSet.size === 0 && minDateStr) {
        return [minDateStr];
    }

    return Array.from(datesSet).sort();
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

    const cleanGen = generalInfo.replace(/^\(|\)$/g, '').trim();
    const durMatch = cleanGen.match(/Dur\.\s*:\s*(\d+)\s*mins?/i);
    const duration = durMatch ? parseInt(durMatch[1], 10) : null;
    const yearMatch = cleanGen.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : '';
    const genParts = cleanGen.split(',').map(p => p.trim());
    let originalTitle = '';
    let country = '';
    if (genParts.length >= 3) {
        originalTitle = genParts[0];
        country = genParts[1];
    } else if (genParts.length === 2) {
        country = genParts[0];
    }

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

    const sessionRooms = parseMovieDetailRooms(html);

    return {
        filmId,
        title,
        duration,
        originalTitle,
        country,
        year,
        info,
        generalInfo,
        credits,
        synopsis,
        posterUrl,
        posterUrlLarge: posterUrl,
        trailerUrl,
        sessionRooms
    };
}

/**
 * Extraer salas físicas por sessionId desde el bloque #horarios de detallePelicula.php
 * @param {string} html Contenido HTML de detallePelicula.php
 * @returns {Map<string, {sala: string, salaCompleta: string, cinemaCode: string}>}
 */
export function parseMovieDetailRooms(html) {
    const roomsMap = new Map();
    if (!html) return roomsMap;

    const sessionRegex = /<a[^>]+href=['"]([^'"]*visSelectTickets[^'"]*)['"][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div><\/a>/gi;
    let match;

    while ((match = sessionRegex.exec(html)) !== null) {
        const ticketUrl = match[1].replace(/&amp;/g, '&');
        const innerText = match[2].replace(/\s+/g, ' ').trim();

        const sessionMatch = ticketUrl.match(/txtSessionId=(\d+)/i) || ticketUrl.match(/SessionId=(\d+)/i);
        const cinemaMatch = ticketUrl.match(/cinemacode=(\d+)/i) || ticketUrl.match(/cinemaId=(\d+)/i);
        const sessionId = sessionMatch ? sessionMatch[1] : null;
        const cinemaCode = cinemaMatch ? cinemaMatch[1] : null;

        if (!sessionId || roomsMap.has(sessionId)) continue;

        const sedeCode = cinemaCode ? (SEDE_CODES[cinemaCode] || cinemaCode) : '';

        let sala = 'POR CONFIRMAR';
        let salaCompleta = sedeCode ? `SALA POR CONFIRMAR ${sedeCode}` : 'SALA POR CONFIRMAR';

        if (innerText.toLowerCase().includes('foro al aire libre') || innerText.toLowerCase().includes('foro')) {
            sala = 'FORO AL AIRE LIBRE';
            salaCompleta = 'FORO AL AIRE LIBRE';
        } else {
            const salaNumMatch = innerText.match(/SALA\s*(\d+)/i);
            if (salaNumMatch) {
                const salaNum = salaNumMatch[1];
                sala = salaNum;
                salaCompleta = sedeCode ? `SALA ${salaNum} ${sedeCode}` : `SALA ${salaNum}`;
            }
        }

        roomsMap.set(sessionId, {
            sala,
            salaCompleta,
            cinemaCode
        });
    }

    return roomsMap;
}

/**
 * Formatear hora de formato 24h (HH:mm) a 12h con 'a. m.' / 'p. m.'
 * @param {string} time24 Hora en formato "HH:mm"
 * @returns {string} Hora legible en formato 12h
 */
export function formatDisplayTime(time24) {
    if (!time24 || typeof time24 !== 'string') return '';
    const match = time24.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return time24;
    let [_, hStr, mStr] = match;
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'p. m.' : 'a. m.';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
}

/**
 * Parser de la API JSON de obtener_cartelera.php
 * @param {object|Array} jsonData Respuesta JSON de obtener_cartelera.php
 * @param {string} minDateStr Fecha mínima en formato YYYY-MM-DD (ej. hoy en CDMX)
 * @returns {{
 *   activeDates: Array<string>,
 *   activeFilmIds: Set<string>,
 *   catalogMovies: Object<string, { filmId: string, titulo: string, clasificacion: string, posterUrl: string, ciclos: Array<string>, eventos: Array<{code: string, name: string}> }>,
 *   schedulesBySedeAndDate: Object<string, Object<string, Array<object>>>,
 *   allSessionsMap: Map<string, object>
 * }}
 */
export function parseCarteleraCatalogoJson(jsonData, minDateStr = '') {
    const rawMovies = Array.isArray(jsonData) ? jsonData : (jsonData?.data || []);

    const activeDatesSet = new Set();
    const activeFilmIds = new Set();
    const catalogMovies = {};
    const schedulesBySedeAndDate = {
        '001': {},
        '002': {},
        '003': {}
    };
    const allSessionsMap = new Map();

    for (const item of rawMovies) {
        const filmId = item.film_id;
        if (!filmId) continue;

        const titulo = (item.titulo || '').trim();
        const clasificacion = (item.clasificacion || '').trim();
        const posterUrl = getPosterUrl(filmId) || item.poster;

        // Extraer eventos / ciclos
        const rawEventos = Array.isArray(item.eventos) && item.eventos.length > 0
            ? item.eventos
            : (item.event_code ? [{ code: item.event_code, name: item.event_name || '' }] : []);

        const eventos = [];
        const seenCodes = new Set();

        for (const ev of rawEventos) {
            const code = String(ev.code || '').trim();
            if (code && !seenCodes.has(code)) {
                seenCodes.add(code);
                eventos.push({
                    code,
                    name: String(ev.name || '').trim()
                });
            }
        }

        if (item.event_code) {
            const code = String(item.event_code).trim();
            if (code && !seenCodes.has(code)) {
                seenCodes.add(code);
                eventos.push({
                    code,
                    name: String(item.event_name || '').trim()
                });
            }
        }

        const ciclos = Array.from(seenCodes);

        catalogMovies[filmId] = {
            filmId,
            titulo,
            clasificacion,
            posterUrl,
            ciclos,
            eventos
        };

        let hasActiveSession = false;

        for (const sedeObj of (item.sedes || [])) {
            const sedeId = String(sedeObj.codigo_sede || '').trim();
            if (!schedulesBySedeAndDate[sedeId]) {
                schedulesBySedeAndDate[sedeId] = {};
            }

            const horariosByDate = new Map();

            for (const h of (sedeObj.horarios || [])) {
                const date = (h.fecha || '').trim();
                const time = (h.hora || '').trim();
                const sessionId = String(h.session_id || '').trim();

                if (!date || !time || !sessionId) continue;
                if (minDateStr && date < minDateStr) continue;

                activeDatesSet.add(date);
                hasActiveSession = true;

                if (!horariosByDate.has(date)) {
                    horariosByDate.set(date, []);
                }

                const ticketUrl = `https://rbvfcn.cinetecanacional.net/Ticketing/visSelectTickets.aspx?cinemacode=${sedeId}&txtSessionId=${sessionId}&visLang=1`;

                horariosByDate.get(date).push({
                    sessionId,
                    time,
                    displayTime: formatDisplayTime(time),
                    ticketUrl
                });

                if (!allSessionsMap.has(sessionId)) {
                    allSessionsMap.set(sessionId, {
                        sessionId,
                        filmId,
                        cinemaId: sedeId,
                        ticketUrl,
                        date,
                        movieTitle: titulo
                    });
                }
            }

            for (const [date, sessionsList] of horariosByDate.entries()) {
                if (!schedulesBySedeAndDate[sedeId][date]) {
                    schedulesBySedeAndDate[sedeId][date] = [];
                }

                sessionsList.sort((a, b) => a.time.localeCompare(b.time));

                const horarios = sessionsList.map(s => s.time);
                const ticketUrls = {};
                for (const s of sessionsList) {
                    ticketUrls[s.time] = s.ticketUrl;
                }

                schedulesBySedeAndDate[sedeId][date].push({
                    filmId,
                    titulo,
                    clasificacion,
                    tipoVersion: '',
                    horarios,
                    sessions: sessionsList,
                    ticketUrls,
                    sedeId,
                    sede: SEDE_NAMES[sedeId] || sedeObj.nombre_sede || sedeId,
                    sedeCodigo: SEDE_CODES[sedeId] || sedeId,
                    href: `detallePelicula.php?FilmId=${filmId}`,
                    posterUrl: getPosterUrl(filmId),
                    ciclos,
                    eventos
                });
            }
        }

        if (hasActiveSession) {
            activeFilmIds.add(filmId);
        }
    }

    const activeDates = Array.from(activeDatesSet).sort();

    for (const sId of ['001', '002', '003']) {
        if (!schedulesBySedeAndDate[sId]) schedulesBySedeAndDate[sId] = {};
        for (const d of activeDates) {
            if (!schedulesBySedeAndDate[sId][d]) {
                schedulesBySedeAndDate[sId][d] = [];
            }
        }
    }

    return {
        activeDates,
        activeFilmIds,
        catalogMovies,
        schedulesBySedeAndDate,
        allSessionsMap
    };
}

/**
 * Extraer metadatos de eventos y ciclos desde evento.php
 * @param {string} html Contenido HTML de evento.php
 * @returns {Object<string, { id: string, nombre: string, posterUrl: string }>} Mapa de ciclos por ID
 */
export function parseCiclosHtml(html) {
    const ciclos = {};
    if (!html || typeof html !== 'string') return ciclos;

    const cardBlocks = html.split(/<div\s+class=["'][^"']*card\b/i).slice(1);

    for (const block of cardBlocks) {
        const idMatch = block.match(/id_evento=([0-9a-zA-Z]+)/i);
        const titleMatch = block.match(/<h6[^>]*class=["'][^"']*card-title[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i);

        if (idMatch && titleMatch) {
            const id = idMatch[1].trim();
            const nombre = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const posterUrl = `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${id}?referenceScheme=Cinema&allowPlaceHolder`;
            ciclos[id] = {
                id,
                nombre,
                posterUrl
            };
        }
    }

    return ciclos;
}

