/**
 * Cloudflare Worker: cinetk
 * Módulo del Pipeline Central de Sincronización y Persistencia (Cron Trigger Engine)
 */

import { ALL_SEDES, SEDE_CODES } from './config.js';
import {
    parseVistaSessions,
    extractAvailableDatesFromVista,
    parseCarteleraCatalogoJson,
    parseCiclosHtml
} from './parsers.js';
import {
    fetchCarteleraCatalogo,
    fetchCiclosMetadata,
    fetchVistaCinemasDetails,
    fetchCarteleraDurationsMap,
    fetchMissingRoomsByMovie,
    fetchMissingSessionRooms,
    scrapeMovieDetails
} from './scrapers.js';
import {
    hasStoredKey,
    getStoredJson,
    putStoredJson,
    getSessionRoomsMap,
    saveSessionRoomsMap,
    purgeObsoleteMovies,
    purgeExpiredSchedules,
    purgeExpiredSessions
} from './storage.js';
import {
    getTodayDateString,
    getPosterUrl,
    assignOutdoorOrSpecialLanes,
    sortMoviesBySala
} from './utils.js';


/**
 * Ejecutar pipeline completo de sincronización horaria
 * @param {object} env Variables de entorno y bindings de Cloudflare (STORAGE, etc.)
 * @param {object|null} ctx Contexto de ejecución de Cloudflare Workers (para waitUntil)
 * @param {string|null} origin Origen HTTP del worker para llamadas en cascada
 */
export async function runSyncPipeline(env, ctx = null, origin = null) {
    const startTime = Date.now();
    console.log(`[Sync Pipeline] Running at ${new Date().toISOString()}...`);

    const todayDate = getTodayDateString();

    // FASE 1: Obtener catálogo semanal y sesiones (primaria: obtener_cartelera.php, fallback: Vista)
    let activeDates = [];
    let activeFilmIds = new Set();
    let parsedBySedeAndDate = { '001': {}, '002': {}, '003': {} };
    let catalogMoviesMap = {};
    let allSessionsMap = new Map(); // sessionId -> sessionData
    let isFallback = false;

    try {
        const carteleraJson = await fetchCarteleraCatalogo();
        const rawList = Array.isArray(carteleraJson) ? carteleraJson : (carteleraJson?.data || []);
        if (carteleraJson && rawList.length > 0) {
            const parsed = parseCarteleraCatalogoJson(carteleraJson, todayDate);
            if (parsed.activeDates.length > 0 && parsed.activeFilmIds.size > 0) {
                activeDates = parsed.activeDates;
                activeFilmIds = parsed.activeFilmIds;
                parsedBySedeAndDate = parsed.schedulesBySedeAndDate;
                catalogMoviesMap = parsed.catalogMovies;
                allSessionsMap = parsed.allSessionsMap;
                console.log(`[Sync Pipeline] Primary source (obtener_cartelera.php) succeeded: ${activeFilmIds.size} films, ${allSessionsMap.size} sessions across ${activeDates.length} dates.`);
            } else {
                isFallback = true;
            }
        } else {
            isFallback = true;
        }
    } catch (e) {
        console.warn('[Sync Pipeline] Error fetching from obtener_cartelera.php:', e.message);
        isFallback = true;
    }

    if (isFallback) {
        console.warn('[Sync Pipeline] Primary source failed or empty. Falling back to Vista Cinemas Details...');
        const [vista001, vista002, vista003] = await Promise.all([
            fetchVistaCinemasDetails('001'),
            fetchVistaCinemasDetails('002'),
            fetchVistaCinemasDetails('003')
        ]);

        const vistaHtmlBySede = {
            '001': vista001,
            '002': vista002,
            '003': vista003
        };

        activeDates = extractAvailableDatesFromVista([vista001, vista002, vista003], todayDate);
        parsedBySedeAndDate = { '001': {}, '002': {}, '003': {} };
        activeFilmIds = new Set();
        allSessionsMap = new Map();

        for (const sedeId of ALL_SEDES) {
            parsedBySedeAndDate[sedeId] = {};
            const html = vistaHtmlBySede[sedeId];
            for (const date of activeDates) {
                const movies = parseVistaSessions(html, date, sedeId);
                parsedBySedeAndDate[sedeId][date] = movies;
                for (const m of movies) {
                    if (m.filmId) activeFilmIds.add(m.filmId);
                }
            }
        }

        const ORDERED_SEDES = ['003', '002', '001'];
        // Pase 1: Sesiones directas de cada día y sede en orden cronológico
        for (const date of activeDates) {
            for (const sedeId of ORDERED_SEDES) {
                const movies = parsedBySedeAndDate[sedeId]?.[date] || [];
                for (const m of movies) {
                    for (const s of (m.sessions || [])) {
                        if (s.sessionId && !allSessionsMap.has(s.sessionId)) {
                            allSessionsMap.set(s.sessionId, {
                                sessionId: s.sessionId,
                                filmId: m.filmId,
                                cinemaId: sedeId,
                                ticketUrl: s.ticketUrl,
                                date,
                                movieTitle: m.titulo
                            });
                        }
                    }
                }
            }
        }
        // Pase 2: Cualquier otra sesión en allShowtimes
        for (const date of activeDates) {
            for (const sedeId of ORDERED_SEDES) {
                const movies = parsedBySedeAndDate[sedeId]?.[date] || [];
                for (const m of movies) {
                    for (const st of (m.allShowtimes || [])) {
                        if (st.sessionId && !allSessionsMap.has(st.sessionId)) {
                            allSessionsMap.set(st.sessionId, {
                                sessionId: st.sessionId,
                                filmId: m.filmId,
                                cinemaId: st.sedeId || sedeId,
                                ticketUrl: st.ticketUrl,
                                date: st.date || date,
                                movieTitle: m.titulo
                            });
                        }
                    }
                }
            }
        }
    }

    // Consultar metadatos de ciclos y pósters (evento.php)
    let ciclosMetadata = {};
    try {
        const ciclosHtml = await fetchCiclosMetadata();
        ciclosMetadata = parseCiclosHtml(ciclosHtml);
    } catch (e) {
        console.warn('[Sync Pipeline] Error fetching ciclos metadata:', e.message);
    }

    console.log(`[Sync Pipeline] Found ${activeFilmIds.size} unique active films and ${allSessionsMap.size} unique sessions across ${activeDates.length} days.`);

    // FASE 2: Hidratación Incremental de Fichas Técnicas (Inmutables) y Extracción Oportunista de Salas
    const sessionRoomsMap = await getSessionRoomsMap(env);
    let newMoviesScraped = 0;
    let existingMoviesSkipped = 0;
    const activeMoviesMap = {};

    for (const filmId of activeFilmIds) {
        const storageKey = `movies/${filmId}.json`;
        let details = await getStoredJson(env, storageKey);

        if (!details) {
            try {
                details = await scrapeMovieDetails(filmId);
                // Si la ficha técnica incluyó sessionRooms, poblarlas de inmediato en memoria
                if (details?.sessionRooms instanceof Map) {
                    for (const [sessionId, roomInfo] of details.sessionRooms.entries()) {
                        const sessionMeta = allSessionsMap.get(sessionId);
                        sessionRoomsMap.set(sessionId, {
                            ...roomInfo,
                            date: sessionMeta?.date || roomInfo.date
                        });
                    }
                }
                await putStoredJson(env, storageKey, details, { filmId });
                newMoviesScraped++;
            } catch (e) {
                console.warn(`[Sync Pipeline] Failed to scrape movie details for ${filmId}:`, e.message);
            }
        } else {
            existingMoviesSkipped++;
        }

        if (details) {
            activeMoviesMap[filmId] = details;
        }
    }

    console.log(`[Sync Pipeline] Movie metadata sync: ${newMoviesScraped} new fetched, ${existingMoviesSkipped} skipped (cached).`);

    // FASE 3: Hidratación Incremental de Salas por Película (detallePelicula.php)
    const missingFilmIds = [];
    const seenMissingFilms = new Set();
    let totalMissingSessionsCount = 0;

    for (const [sessionId, sessionData] of allSessionsMap.entries()) {
        if (!sessionRoomsMap.has(sessionId)) {
            totalMissingSessionsCount++;
            const fId = sessionData.filmId;
            if (fId && !seenMissingFilms.has(fId)) {
                seenMissingFilms.add(fId);
                missingFilmIds.push(fId);
            }
        }
    }

    console.log(`[Sync Pipeline] Session rooms status: ${sessionRoomsMap.size} cached, ${totalMissingSessionsCount} sessions missing across ${missingFilmIds.length} films.`);

    const MAX_MOVIE_SUBREQUESTS_PER_RUN = 25;
    let newSessionsResolved = 0;

    if (missingFilmIds.length > 0) {
        const { resolvedSessionsCount, processedMoviesCount } = await fetchMissingRoomsByMovie(
            missingFilmIds,
            sessionRoomsMap,
            allSessionsMap,
            MAX_MOVIE_SUBREQUESTS_PER_RUN
        );
        newSessionsResolved += resolvedSessionsCount;

        await saveSessionRoomsMap(env, sessionRoomsMap);
        console.log(`[Sync Pipeline] Resolved ${resolvedSessionsCount} sessions from ${processedMoviesCount} movies and saved to R2.`);

        if (missingFilmIds.length > MAX_MOVIE_SUBREQUESTS_PER_RUN) {
            const remainingFilms = missingFilmIds.length - MAX_MOVIE_SUBREQUESTS_PER_RUN;
            console.log(`[Sync Pipeline] ${remainingFilms} films with unresolved sessions remain for subsequent cron run or manual GitHub Action.`);
        }
    }

    // FASE 4: Precomputación de Catálogo Consolidado y Feed Semanal (/feed)
    // data/cartelera.php devuelve el catálogo general en 1 sola llamada (ignora el parámetro fecha)
    const metadataByFilm = (await fetchCarteleraDurationsMap(todayDate, '000')) || new Map();

    // Catálogo normalizado de películas (definido una sola vez)
    const feedMovies = {};
    for (const filmId of activeFilmIds) {
        const details = activeMoviesMap[filmId] || {};
        const meta = metadataByFilm.get(filmId) || {};
        const catalogMovie = catalogMoviesMap[filmId] || {};

        let movieTitle = details.title || catalogMovie.titulo || meta.title || '';
        if (!movieTitle) {
            for (const sedeId of ALL_SEDES) {
                for (const date of activeDates) {
                    const found = (parsedBySedeAndDate[sedeId]?.[date] || []).find(m => m.filmId === filmId);
                    if (found && found.titulo) {
                        movieTitle = found.titulo;
                        break;
                    }
                }
                if (movieTitle) break;
            }
        }

        let fallbackDuration = details.duration || null;
        if (!fallbackDuration && details.generalInfo) {
            const durMatch = details.generalInfo.match(/Dur\.?:\s*(\d+)\s*mins?/i);
            if (durMatch) fallbackDuration = parseInt(durMatch[1], 10);
        }

        feedMovies[filmId] = {
            filmId,
            titulo: movieTitle || 'Sin Título',
            originalTitle: meta.originalTitle || details.originalTitle || '',
            duracion: meta.duration || fallbackDuration || 90,
            director: meta.director || details.director || '',
            country: meta.country || details.country || '',
            year: meta.year || details.year || '',
            clasificacion: catalogMovie.clasificacion || details.clasificacion || '',
            ciclos: catalogMovie.ciclos || details.ciclos || [],
            posterUrl: getPosterUrl(filmId),
            stillUrl: details.posterUrl || details.posterUrlLarge || getPosterUrl(filmId),
            trailerUrl: details.trailerUrl || null,
            generalInfo: details.generalInfo || '',
            credits: details.credits || '',
            synopsis: details.synopsis || '',
            info: details.info || []
        };
    }

    // Mapa consolidado de ciclos para el objeto raíz de feed/consolidated.json
    const feedCiclos = {};
    for (const [id, ciclo] of Object.entries(ciclosMetadata || {})) {
        feedCiclos[id] = {
            id,
            nombre: ciclo.nombre || id,
            posterUrl: ciclo.posterUrl || `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${id}?referenceScheme=Cinema&allowPlaceHolder`,
            totalPeliculas: 0
        };
    }

    // Calcular totalPeliculas por ciclo e incluir cualquier ciclo activo referenciado
    for (const [filmId, movie] of Object.entries(feedMovies)) {
        const movieCiclos = Array.isArray(movie.ciclos) ? movie.ciclos : [];
        for (const cId of movieCiclos) {
            if (!feedCiclos[cId]) {
                const catMovie = catalogMoviesMap[filmId];
                const eventObj = catMovie?.eventos?.find(e => e.code === cId);
                feedCiclos[cId] = {
                    id: cId,
                    nombre: eventObj?.name || `Ciclo ${cId}`,
                    posterUrl: `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${cId}?referenceScheme=Cinema&allowPlaceHolder`,
                    totalPeliculas: 0
                };
            }
            feedCiclos[cId].totalPeliculas = (feedCiclos[cId].totalPeliculas || 0) + 1;
        }
    }

    // Programaciones compactas agrupadas por fecha y sede
    const feedSchedules = {};

    for (const date of activeDates) {
        feedSchedules[date] = {};

        for (const sedeId of ALL_SEDES) {
            const moviesAtSede = parsedBySedeAndDate[sedeId]?.[date] || [];
            const sedeCode = SEDE_CODES[sedeId] || sedeId;

            const resolvedMovies = moviesAtSede.map(movie => {
                const firstSession = movie.sessions && movie.sessions.length > 0 ? movie.sessions[0] : null;
                let sessionInfo = firstSession && firstSession.sessionId ? sessionRoomsMap.get(firstSession.sessionId) : null;

                if (!sessionInfo && movie.sessions) {
                    for (const s of movie.sessions) {
                        if (s.sessionId && sessionRoomsMap.has(s.sessionId)) {
                            sessionInfo = sessionRoomsMap.get(s.sessionId);
                            break;
                        }
                    }
                }
                // Solo se buscan sesiones de ESTE DÍA. Nunca heredar salas de otros días vía allShowtimes.

                const isOutdoor = movie.titulo?.toLowerCase().includes('foro al aire libre');
                const sala = sessionInfo ? sessionInfo.sala : (isOutdoor ? 'FORO AL AIRE LIBRE' : 'POR CONFIRMAR');
                const salaCompleta = sessionInfo ? sessionInfo.salaCompleta : (isOutdoor ? 'FORO AL AIRE LIBRE' : `SALA POR CONFIRMAR ${sedeCode}`);

                const enrichedSessions = (movie.sessions || []).map(s => {
                    const sSessionInfo = s.sessionId ? sessionRoomsMap.get(s.sessionId) : null;
                    return {
                        sessionId: s.sessionId,
                        time: s.time,
                        displayTime: s.displayTime || s.time,
                        ticketUrl: s.ticketUrl,
                        sala: sSessionInfo ? sSessionInfo.sala : (isOutdoor ? 'FORO AL AIRE LIBRE' : 'POR CONFIRMAR'),
                        salaCompleta: sSessionInfo ? sSessionInfo.salaCompleta : (isOutdoor ? 'FORO AL AIRE LIBRE' : `SALA POR CONFIRMAR ${sedeCode}`)
                    };
                });

                return {
                    filmId: movie.filmId,
                    titulo: movie.titulo,
                    sala,
                    salaCompleta,
                    horarios: movie.horarios || [],
                    ticketUrls: movie.ticketUrls || {},
                    sessions: enrichedSessions
                };
            });

            const processedMovies = assignOutdoorOrSpecialLanes(resolvedMovies);
            const sortedMovies = sortMoviesBySala(processedMovies);

            feedSchedules[date][sedeId] = sortedMovies.map(m => ({
                filmId: m.filmId,
                sala: m.sala,
                salaCompleta: m.salaCompleta,
                horarios: m.horarios,
                ticketUrls: m.ticketUrls,
                sessions: m.sessions
            }));
        }
    }

    // Escribir Feed Consolidado único en Cloudflare R2
    const consolidatedFeed = {
        version: 'feed-v1',
        generatedAt: new Date().toISOString(),
        activeDates,
        sedes: {
            '001': { nombre: 'CHAPULTEPEC', codigo: 'CNCH' },
            '002': { nombre: 'CENART', codigo: 'CNA' },
            '003': { nombre: 'XOCO', codigo: 'XOCO' }
        },
        totalMovies: Object.keys(feedMovies).length,
        totalSessions: allSessionsMap.size,
        ciclos: feedCiclos,
        movies: feedMovies,
        schedules: feedSchedules
    };

    await putStoredJson(env, 'feed/consolidated.json', consolidatedFeed, {
        version: 'feed-v1',
        updatedAt: new Date().toISOString()
    });
    console.log(`[Sync Pipeline] Saved feed/consolidated.json with ${Object.keys(feedMovies).length} movies and ${allSessionsMap.size} sessions.`);

    // FASE 5: Garbage Collection (Purga de películas obsoletas, fechas pasadas y sesiones expiradas)
    const purgedMovies = await purgeObsoleteMovies(env, activeFilmIds);
    const purgedSchedules = await purgeExpiredSchedules(env, todayDate);
    const purgedSessions = purgeExpiredSessions(sessionRoomsMap, todayDate);
    if (purgedSessions > 0) {
        await saveSessionRoomsMap(env, sessionRoomsMap);
    }

    const totalDurationMs = Date.now() - startTime;
    const syncStatus = {
        lastSync: new Date().toISOString(),
        durationMs: totalDurationMs,
        activeDates,
        activeMoviesCount: activeFilmIds.size,
        activeFilmIds: Array.from(activeFilmIds),
        totalSessionRooms: sessionRoomsMap.size,
        newSessionsResolved,
        newMoviesScraped,
        existingMoviesSkipped,
        feedGenerated: true,
        purgedMovies,
        purgedSchedules,
        purgedSessions,
        status: 'success'
    };

    await putStoredJson(env, 'meta/sync-status.json', syncStatus);
    console.log(`[Sync Pipeline] Completed in ${totalDurationMs}ms. Purged: ${purgedMovies} movies, ${purgedSchedules} expired schedules, ${purgedSessions} expired sessions.`);

    return syncStatus;
}
