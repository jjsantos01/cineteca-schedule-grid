/**
 * Cloudflare Worker: cinetkv2
 * API unificada y resiliente para Cineteca Nacional de México
 * 
 * Pipeline Central Unificado:
 * - Consulta de sesiones y salas reales directamente desde Vista Ticketing (visSelectTickets.aspx)
 * - Compatibilidad: /v2, /v1 y / resuelven vía Vista Ticketing
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=120' // 10 min en Cloudflare Edge
};

const SEDE_CODES = {
    '001': 'CNCH',
    '002': 'CNA',
    '003': 'XOCO'
};

const SEDE_NAMES = {
    '001': 'CHAPULTEPEC',
    '002': 'CENART',
    '003': 'XOCO'
};

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        try {
            const url = new URL(request.url);
            const path = url.pathname;

            if (path === '/health') {
                return jsonResponse({
                    status: 'ok',
                    worker: 'cinetkv2',
                    architecture: 'unified_live_scraping_proxy',
                    versions: ['v2'],
                    defaultVersion: 'v2'
                });
            }

            if (path === '/movie-details') {
                return await handleMovieDetails(url);
            }

            if (path === '/v2' || path === '/v1' || path === '/') {
                return await handleSchedule(url, 'v2');
            }

            return jsonResponse({
                error: `Not found: ${path}. Available endpoints: /v2, /movie-details, /health`,
                data: []
            }, 404);

        } catch (error) {
            console.error('Worker error:', error);
            return jsonResponse({
                error: error.message || 'Internal Server Error',
                data: []
            }, 500);
        }
    }
};

/**
 * Manejador principal de cartelera (v2 / compatibilidad)
 */
async function handleSchedule(url, strategy = 'v2') {
    const cinemaId = url.searchParams.get('cinemaId') || url.searchParams.get('cinema') || '003';
    const dia = url.searchParams.get('dia') || url.searchParams.get('fecha') || getTodayDateString();

    try {
        const scheduleData = await getSchedule(cinemaId, dia);
        return jsonResponse({
            version: 'v2',
            source: 'vista_session_rooms',
            cinemaId,
            date: dia,
            total: scheduleData.length,
            data: scheduleData
        });
    } catch (e) {
        console.error('Error fetching v2 schedule:', e);
        return jsonResponse({
            version: 'v2',
            error: e.message || 'Failed to fetch v2 schedule',
            cinemaId,
            date: dia,
            data: []
        }, 502);
    }
}

/**
 * PIPELINE CENTRAL UNIFICADO:
 * 1. Consulta data/cartelera.php (duraciones exactas en lote) y Vista Cinemas/Details (sesiones) en paralelo.
 * 2. Cruza por FilmId y enriquece metadatos.
 * 3. Asigna salas reales consultando las sesiones en Vista Ticketing (visSelectTickets.aspx).
 */
async function getSchedule(cinemaId, dia) {
    // 1. Consultar metadatos en paralelo
    const [durationsMap, vistaHtml] = await Promise.all([
        fetchCarteleraDurationsMap(dia, cinemaId),
        fetchVistaCinemasDetails(cinemaId)
    ]);

    // 2. Extraer películas y sesiones del día seleccionado desde Vista
    const vistaMovies = parseVistaSessions(vistaHtml, dia, cinemaId);

    // 3. Enriquecer con duraciones exactas en lote y metadatos limpios
    const enrichedMovies = vistaMovies.map(movie => {
        const metadata = durationsMap.get(movie.filmId) || {};
        return {
            ...movie,
            duracion: metadata.duration || 90,
            originalTitle: metadata.originalTitle || '',
            director: metadata.director || '',
            country: metadata.country || '',
            year: metadata.year || '',
            posterUrl: getPosterUrl(movie.filmId)
        };
    });

    // 4. Asignar salas reales consultando las sesiones en Vista Ticketing
    const resultMovies = await resolveSalasViaVistaTicketing(enrichedMovies, cinemaId);

    // 5. Ordenar salas de forma consistente (numéricas primero, FORO / especiales al fondo)
    return sortMoviesBySala(resultMovies);
}

/**
 * ============================================================================
 * ESTRATEGIA V2: Salas Físicas desde visSelectTickets.aspx (Sesiones de Vista)
 * ============================================================================
 */
async function resolveSalasViaVistaTicketing(movies, cinemaId) {
    const sedeCode = SEDE_CODES[cinemaId] || cinemaId;
    const sedeName = SEDE_NAMES[cinemaId] || cinemaId;

    // Consultar la sala real de cada película en paralelo usando su primera sesión
    const promises = movies.map(async (movie) => {
        const firstSession = movie.sessions && movie.sessions.length > 0 ? movie.sessions[0] : null;
        if (!firstSession || !firstSession.ticketUrl) {
            return {
                filmId: movie.filmId,
                realSala: 'FORO AL AIRE LIBRE',
                salaCompleta: 'FORO AL AIRE LIBRE'
            };
        }

        try {
            const rawUrl = firstSession.ticketUrl.startsWith('//') ? `https:${firstSession.ticketUrl}` : firstSession.ticketUrl;
            const ticketPageUrl = rawUrl.includes('AspxAutoDetectCookieSupport')
                ? rawUrl
                : `${rawUrl}&AspxAutoDetectCookieSupport=1`;

            const res = await fetch(ticketPageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cookie': 'AspxAutoDetectCookieSupport=1'
                }
            });

            if (!res.ok) {
                return { filmId: movie.filmId, realSala: null, salaCompleta: null };
            }

            const html = await res.text();

            const screenMatch = html.match(/<div class="session-overview-line cinema-screen-name">\s*([^<]+)\s*<\/div>/i);
            if (screenMatch) {
                const fullScreenText = screenMatch[1].trim();
                const salaNumMatch = fullScreenText.match(/SALA\s*(\d+)/i);
                const salaNumber = salaNumMatch ? salaNumMatch[1] : fullScreenText;
                return {
                    filmId: movie.filmId,
                    realSala: salaNumber,
                    salaCompleta: `SALA ${salaNumber} ${sedeCode}`
                };
            }

            if (html.includes('visError.aspx') || html.includes('AltMessage=NoTickets')) {
                return {
                    filmId: movie.filmId,
                    realSala: 'FORO AL AIRE LIBRE',
                    salaCompleta: 'FORO AL AIRE LIBRE'
                };
            }

            return { filmId: movie.filmId, realSala: null, salaCompleta: null };
        } catch (e) {
            console.warn(`Error resolving real sala for filmId ${movie.filmId}:`, e.message);
            return { filmId: movie.filmId, realSala: null, salaCompleta: null };
        }
    });

    const results = await Promise.all(promises);
    const filmSalaMap = new Map();
    for (const r of results) {
        if (r && r.realSala) {
            filmSalaMap.set(r.filmId, {
                sala: r.realSala,
                salaCompleta: r.salaCompleta
            });
        }
    }

    const assignedMovies = movies.map(movie => {
        const resolved = filmSalaMap.get(movie.filmId);
        if (resolved) {
            return {
                ...movie,
                sala: resolved.sala,
                salaCompleta: resolved.salaCompleta
            };
        }
        return {
            ...movie,
            sala: 'FORO AL AIRE LIBRE',
            salaCompleta: 'FORO AL AIRE LIBRE'
        };
    });

    return assignOutdoorOrSpecialLanes(assignedMovies);
}

/**
 * ============================================================================
 * CONSULTAS EXTERNAS Y PARSEO
 * ============================================================================
 */

/**
 * Consulta la API oficial data/cartelera.php para obtener duraciones exactas en lote
 */
async function fetchCarteleraDurationsMap(dia, cinemaId = '000') {
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
 * Consulta las sesiones de la sede en Vista Ticketing
 */
async function fetchVistaCinemasDetails(cinemaId) {
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
 * Extrae duraciones y metadatos limpios de data/cartelera.php
 */
function parseCarteleraDurations(html) {
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
 * Parsea las sesiones de rbvfcn para la fecha solicitada
 */
function parseVistaSessions(html, dia, cinemaId) {
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

            // Extraer fecha (YYYY-MM-DD) y hora (HH:mm)
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
                href: `detallePelicula.php?FilmId=${filmId}&cinemaId=000`,
                posterUrl: getPosterUrl(filmId)
            });
        }
    }

    return movies;
}

/**
 * ============================================================================
 * ENDPOINT /movie-details: Ficha técnica y sinopsis
 * ============================================================================
 */
async function handleMovieDetails(url) {
    const filmId = url.searchParams.get('filmId') || url.searchParams.get('FilmId');
    if (!filmId) {
        return jsonResponse({ error: 'Missing required query param: filmId' }, 400);
    }

    try {
        const detailUrl = `https://www.cinetecanacional.net/detallePelicula.php?FilmId=${filmId}&cinemaId=000`;
        const res = await fetch(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
            }
        });

        if (!res.ok) {
            return jsonResponse({ error: `Failed to fetch movie detail: HTTP ${res.status}` }, res.status);
        }

        const html = await res.text();
        const parsed = parseMovieDetailsHtml(html, filmId);

        return jsonResponse({
            filmId,
            ...parsed
        });
    } catch (e) {
        console.error('Error fetching movie details:', e);
        return jsonResponse({ error: e.message || 'Failed to fetch movie details' }, 500);
    }
}

function parseMovieDetailsHtml(html, filmId) {
    // 1. Título
    const titleMatch = html.match(/class=['"][^'"]*font-weight-bold[^'"]*text-uppercase[^'"]*h[1234][^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<div class=['"]h[1234] text-uppercase font-weight-bold['"][^>]*>([\s\S]*?)<\/div>/i)
        || html.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // 2. Información General: (Título original, País, Año, Dur.: X mins.)
    const genMatch = html.match(/<p class=['"]lh-1['"]>\s*(\([^<]+\))\s*<\/p>/i);
    const generalInfo = genMatch ? genMatch[1].trim() : '';

    // 3. Créditos y Sinopsis desde #collapseReseña / .card-body
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

    // Construir arreglo de párrafos info que espera el frontend modal.js
    const info = [];
    if (generalInfo) info.push(generalInfo);
    if (credits) info.push(credits);
    if (synopsis) info.push(synopsis);

    // Fallback si no se encontró collapseReseña
    if (info.length === 0) {
        const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
            .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(t => t && !t.match(/^(sinopsis:|trailer:|cartelera|foro al aire libre|programa mensual|desarrollo académico|acervos|centro de documentación|videoteca digital|exposiciones|circuito cineteca|cafeteria|quienes somos|directorio|prensa|transparencia|sedes|contacto|consulta|enlaces de interés|siguenos|aliados|algunos derechos|horario de atención|si tu duda)/i));
        info.push(...pMatches.slice(0, 3));
    }

    // 4. Trailer
    let trailerUrl = null;
    const iframeMatch = html.match(/<iframe[^>]+src="([^"]+youtube[^"]+)"/i);
    if (iframeMatch) {
        trailerUrl = iframeMatch[1];
    } else {
        const ytLinkMatch = html.match(/href="([^"]+youtu\.?be[^"]+)"/i);
        if (ytLinkMatch) trailerUrl = ytLinkMatch[1];
    }

    // 5. Póster oficial
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

/**
 * ============================================================================
 * UTILIDADES DE SALAS Y FORMATEO
 * ============================================================================
 */

function assignOutdoorOrSpecialLanes(movies) {
    const outdoorMovies = movies.filter(m => m.sala === 'FORO AL AIRE LIBRE' || m.salaCompleta?.includes('FORO'));
    const standardMovies = movies.filter(m => m.sala !== 'FORO AL AIRE LIBRE' && !m.salaCompleta?.includes('FORO'));

    if (outdoorMovies.length <= 1) {
        return [...standardMovies, ...outdoorMovies];
    }

    // Si hay más de una película al aire libre, ordenar y evitar colisiones de carril
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

function sortMoviesBySala(movies) {
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

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function getPosterUrl(filmId) {
    if (!filmId) return null;
    return `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/${filmId}?referenceScheme=Cinema&allowPlaceHolder`;
}

function getPosterUrlLarge(filmId) {
    if (!filmId) return null;
    return `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/${filmId}?referenceScheme=Cinema&allowPlaceHolder`;
}

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        }
    });
}
