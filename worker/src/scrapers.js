/**
 * Cloudflare Worker: cinetk
 * Módulo de Consultas Externas y Scraping Upstream hacia Cineteca Nacional y Vista Cinema
 */

import { SEDE_CODES } from './config.js';
import { parseCarteleraDurations, parseVistaSessions, parseMovieDetailsHtml, parseMovieDetailRooms } from './parsers.js';
import { getSessionRoomsMap, saveSessionRoomsMap } from './storage.js';
import { getPosterUrl, assignOutdoorOrSpecialLanes, sortMoviesBySala } from './utils.js';

/**
 * Consultar catálogo semanal completo de Vista Ticketing para una sede
 */
export async function fetchVistaCinemasDetails(cinemaId) {
    try {
        const res = await fetch(`https://rbvfcn.cinetecanacional.net/Browsing/Cinemas/Details/${cinemaId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        if (!res.ok) return '';
        return await res.text();
    } catch (e) {
        console.warn(`Could not fetch Vista Cinemas/Details/${cinemaId}:`, e.message);
        return '';
    }
}

/**
 * Consultar metadatos de cartelera oficial (duraciones, directores, país, año)
 */
export async function fetchCarteleraDurationsMap(dia, cinemaId = '000') {
    try {
        const params = new URLSearchParams({
            vista: 'full',
            fecha: dia,
            cinema: cinemaId,
            eventId: '000'
        });

        const res = await fetch('https://www.cinetecanacional.net/data/cartelera.php', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.cinetecanacional.net/cartelera.php'
            },
            body: params.toString()
        });

        if (!res.ok) return new Map();
        const json = await res.json();
        return parseCarteleraDurations(json?.html || '');
    } catch (e) {
        console.warn('Could not fetch cartelera durations map:', e.message);
        return new Map();
    }
}

/**
 * Resolver sala física real de una sesión individual en visSelectTickets.aspx
 */
export async function fetchSingleSessionRoom(session) {
    const cinemaId = session.cinemaId || '003';
    const sedeCode = SEDE_CODES[cinemaId] || cinemaId;

    let ticketPageUrl;
    if (session.ticketUrl) {
        const rawUrl = session.ticketUrl.startsWith('//') ? `https:${session.ticketUrl}` : session.ticketUrl;
        const cleanUrl = rawUrl.replace(/&amp;/g, '&');
        ticketPageUrl = cleanUrl.includes('AspxAutoDetectCookieSupport')
            ? cleanUrl
            : `${cleanUrl}&AspxAutoDetectCookieSupport=1`;
    } else {
        ticketPageUrl = `https://rbvfcn.cinetecanacional.net/Ticketing/visSelectTickets.aspx?cinemacode=${cinemaId}&txtSessionId=${session.sessionId}&visLang=1&AspxAutoDetectCookieSupport=1`;
    }

    try {
        const res = await fetch(ticketPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Cookie': 'AspxAutoDetectCookieSupport=1'
            }
        });

        if (!res.ok) {
            console.warn(`[SessionRoom] HTTP ${res.status} for session ${session.sessionId}`);
            return null;
        }

        const html = await res.text();

        // 1. Extraer sala física real de la pantalla (prioridad máxima)
        const screenMatch = html.match(/<div class="session-overview-line cinema-screen-name">\s*([^<]+)\s*<\/div>/i);
        if (screenMatch) {
            const fullScreenText = screenMatch[1].trim();
            const salaNumMatch = fullScreenText.match(/SALA\s*(\d+)/i);
            if (salaNumMatch) {
                const salaNumber = salaNumMatch[1];
                return {
                    sala: salaNumber,
                    salaCompleta: `SALA ${salaNumber} ${sedeCode}`,
                    date: session.date
                };
            }
            if (fullScreenText.toLowerCase().includes('foro')) {
                return {
                    sala: 'FORO AL AIRE LIBRE',
                    salaCompleta: 'FORO AL AIRE LIBRE',
                    date: session.date
                };
            }
            return {
                sala: fullScreenText,
                salaCompleta: `${fullScreenText} ${sedeCode}`,
                date: session.date
            };
        }

        // 2. Detección de Foro al Aire Libre o eventos sin venta directa de tickets (solo si no hubo pantalla)
        if (session.movieTitle?.toLowerCase().includes('foro al aire libre') || html.includes('AltMessage=NoTickets')) {
            return {
                sala: 'FORO AL AIRE LIBRE',
                salaCompleta: 'FORO AL AIRE LIBRE',
                date: session.date
            };
        }

        return null;
    } catch (e) {
        console.warn(`[SessionRoom] Error resolving session ${session.sessionId}:`, e.message);
        return null;
    }
}

/**
 * Resolver en lotes concurrentes (10 peticiones paralelas) las sesiones faltantes
 * @param {Array} missingSessions Lista de sesiones por resolver
 * @param {Map} sessionRoomsMap Mapa de sesiones donde se guardarán los resultados
 * @param {number} maxBatch Máximo de sesiones a resolver en esta invocación (por defecto 25 para respetar el límite de 50 subrequests)
 */
export async function fetchMissingSessionRooms(missingSessions, sessionRoomsMap, maxBatch = 25) {
    if (!missingSessions || missingSessions.length === 0) return 0;

    const BATCH_SIZE = 10;
    const sessionsToFetch = missingSessions.slice(0, maxBatch);
    let fetchedCount = 0;

    for (let i = 0; i < sessionsToFetch.length; i += BATCH_SIZE) {
        const batch = sessionsToFetch.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(session => fetchSingleSessionRoom(session)));

        for (let j = 0; j < batch.length; j++) {
            const roomInfo = results[j];
            if (roomInfo) {
                sessionRoomsMap.set(batch[j].sessionId, roomInfo);
                fetchedCount++;
            }
        }
    }

    return fetchedCount;
}

/**
 * Consultar detallePelicula.php para extraer todas las salas de sesiones de una película
 * @param {string} filmId Identificador universal de la película
 * @returns {Promise<Map<string, {sala: string, salaCompleta: string, cinemaCode: string}>>}
 */
export async function fetchMovieRooms(filmId) {
    try {
        const detailUrl = `https://www.cinetecanacional.net/detallePelicula.php?FilmId=${filmId}&cinemaId=000`;
        const res = await fetch(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
            }
        });
        if (!res.ok) return new Map();
        const html = await res.text();
        return parseMovieDetailRooms(html);
    } catch (e) {
        console.warn(`[MovieRooms] Failed to fetch rooms for film ${filmId}:`, e.message);
        return new Map();
    }
}

/**
 * Resolver salas de sesiones faltantes consultando por película (máx. maxMovies por corrida)
 * @param {Array<string>} missingFilmIds Lista de filmIds con sesiones pendientes de sala
 * @param {Map} sessionRoomsMap Mapa consolidado de salas en memoria
 * @param {Map} allSessionsMap Mapa con metadatos de sesiones (para asociar fecha)
 * @param {number} maxMovies Límite de películas a consultar (por defecto 25 para no exceder cuota de subrequests)
 * @returns {Promise<{ resolvedSessionsCount: number, processedMoviesCount: number }>}
 */
export async function fetchMissingRoomsByMovie(missingFilmIds, sessionRoomsMap, allSessionsMap = new Map(), maxMovies = 25) {
    if (!missingFilmIds || missingFilmIds.length === 0) {
        return { resolvedSessionsCount: 0, processedMoviesCount: 0 };
    }

    const BATCH_SIZE = 10;
    const filmsToFetch = missingFilmIds.slice(0, maxMovies);
    let resolvedSessionsCount = 0;

    for (let i = 0; i < filmsToFetch.length; i += BATCH_SIZE) {
        const batch = filmsToFetch.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(filmId => fetchMovieRooms(filmId)));

        for (const movieRooms of results) {
            for (const [sessionId, roomInfo] of movieRooms.entries()) {
                const sessionMeta = allSessionsMap.get(sessionId);
                const enrichedInfo = {
                    ...roomInfo,
                    date: sessionMeta?.date || roomInfo.date
                };
                sessionRoomsMap.set(sessionId, enrichedInfo);
                resolvedSessionsCount++;
            }
        }
    }

    return {
        resolvedSessionsCount,
        processedMoviesCount: filmsToFetch.length
    };
}


/**
 * Scraping de la ficha técnica de una película desde detallePelicula.php
 */
export async function scrapeMovieDetails(filmId) {
    const detailUrl = `https://www.cinetecanacional.net/detallePelicula.php?FilmId=${filmId}&cinemaId=000`;
    const res = await fetch(detailUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
        }
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch movie detail: HTTP ${res.status}`);
    }

    const html = await res.text();
    const parsed = parseMovieDetailsHtml(html, filmId);

    return {
        filmId,
        ...parsed
    };
}

/**
 * Obtener cartelera completa en vivo (Fallback On-Demand cuando no está en R2)
 */
export async function getSchedule(cinemaId, dia, env) {
    const [durationsMap, vistaHtml] = await Promise.all([
        fetchCarteleraDurationsMap(dia, cinemaId),
        fetchVistaCinemasDetails(cinemaId)
    ]);

    const vistaMovies = parseVistaSessions(vistaHtml, dia, cinemaId);

    // Obtener mapa de sesiones cacheadas en R2
    const sessionRoomsMap = await getSessionRoomsMap(env);

    // Identificar sesiones faltantes para esta cartelera (enfocadas en el día consultado)
    const missingSessions = [];
    for (const movie of vistaMovies) {
        for (const s of (movie.sessions || [])) {
            if (s.sessionId && !sessionRoomsMap.has(s.sessionId)) {
                missingSessions.push({
                    sessionId: s.sessionId,
                    cinemaId,
                    ticketUrl: s.ticketUrl,
                    date: dia,
                    movieTitle: movie.titulo
                });
            }
        }
    }

    // Resolver sesiones faltantes si las hay
    if (missingSessions.length > 0) {
        const newlyFetched = await fetchMissingSessionRooms(missingSessions, sessionRoomsMap);
        if (newlyFetched > 0 && env?.STORAGE) {
            await saveSessionRoomsMap(env, sessionRoomsMap);
        }
    }

    const sedeCode = SEDE_CODES[cinemaId] || cinemaId;

    const enrichedMovies = vistaMovies.map(movie => {
        const metadata = durationsMap.get(movie.filmId) || {};
        const firstSession = movie.sessions && movie.sessions.length > 0 ? movie.sessions[0] : null;
        let sessionInfo = firstSession && firstSession.sessionId ? sessionRoomsMap.get(firstSession.sessionId) : null;

        // Fallback inteligente: si la primera sesión no está en caché, buscar en cualquier otra sesión del día
        if (!sessionInfo && movie.sessions) {
            for (const s of movie.sessions) {
                if (s.sessionId && sessionRoomsMap.has(s.sessionId)) {
                    sessionInfo = sessionRoomsMap.get(s.sessionId);
                    break;
                }
            }
        }

        const isOutdoor = movie.titulo?.toLowerCase().includes('foro al aire libre');

        const sala = sessionInfo ? sessionInfo.sala : (isOutdoor ? 'FORO AL AIRE LIBRE' : 'POR CONFIRMAR');
        const salaCompleta = sessionInfo ? sessionInfo.salaCompleta : (isOutdoor ? 'FORO AL AIRE LIBRE' : `SALA POR CONFIRMAR ${sedeCode}`);

        // Enriquecer allShowtimes
        const enrichedShowtimes = (movie.allShowtimes || []).map(st => {
            const stSessionInfo = st.sessionId ? sessionRoomsMap.get(st.sessionId) : null;
            const stSedeCode = SEDE_CODES[st.sedeId] || st.sedeCodigo || sedeCode;
            const stOutdoor = isOutdoor || st.sede?.toLowerCase().includes('foro');
            return {
                ...st,
                sala: stSessionInfo ? stSessionInfo.sala : (stOutdoor ? 'FORO AL AIRE LIBRE' : 'POR CONFIRMAR'),
                salaCompleta: stSessionInfo ? stSessionInfo.salaCompleta : (stOutdoor ? 'FORO AL AIRE LIBRE' : `SALA POR CONFIRMAR ${stSedeCode}`)
            };
        });

        // Enriquecer sessions
        const enrichedSessions = (movie.sessions || []).map(s => {
            const sSessionInfo = s.sessionId ? sessionRoomsMap.get(s.sessionId) : null;
            return {
                ...s,
                sala: sSessionInfo ? sSessionInfo.sala : (isOutdoor ? 'FORO AL AIRE LIBRE' : 'POR CONFIRMAR'),
                salaCompleta: sSessionInfo ? sSessionInfo.salaCompleta : (isOutdoor ? 'FORO AL AIRE LIBRE' : `SALA POR CONFIRMAR ${sedeCode}`)
            };
        });

        return {
            ...movie,
            sala,
            salaCompleta,
            sessions: enrichedSessions,
            allShowtimes: enrichedShowtimes,
            duracion: metadata.duration || 90,
            originalTitle: metadata.originalTitle || '',
            director: metadata.director || '',
            country: metadata.country || '',
            year: metadata.year || '',
            posterUrl: getPosterUrl(movie.filmId)
        };
    });

    const processedMovies = assignOutdoorOrSpecialLanes(enrichedMovies);
    const sortedMovies = sortMoviesBySala(processedMovies);

    const nonOutdoor = sortedMovies.filter(m => !m.titulo?.toLowerCase().includes('foro al aire libre'));
    const unresolvedCount = nonOutdoor.filter(m => m.sala.includes('CONFIRMAR') || (!m.sessions?.[0]?.sessionId || !sessionRoomsMap.has(m.sessions[0].sessionId))).length;
    const isComplete = unresolvedCount === 0;

    return {
        movies: sortedMovies,
        isComplete,
        unresolvedCount
    };
}
