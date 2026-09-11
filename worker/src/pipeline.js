/**
 * Cloudflare Worker: cinetk
 * Módulo del Pipeline Central de Sincronización y Persistencia (Cron Trigger Engine)
 */

import { ALL_SEDES, SEDE_CODES, SYNC_DAYS_AHEAD } from './config.js';
import { parseVistaSessions } from './parsers.js';
import {
    fetchVistaCinemasDetails,
    fetchCarteleraDurationsMap,
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
    getNextDatesList,
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

    const activeDates = getNextDatesList(SYNC_DAYS_AHEAD);
    const todayDate = activeDates[0];

    // FASE 1: Extraer sesiones semanales de Vista para las 3 sedes
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

    // Identificar todas las películas y sesiones activas en los próximos 7 días
    const activeFilmIds = new Set();
    const vistaParsedBySedeAndDate = {};
    const allSessionsMap = new Map(); // sessionId -> sessionData

    for (const sedeId of ALL_SEDES) {
        vistaParsedBySedeAndDate[sedeId] = {};
        const html = vistaHtmlBySede[sedeId];
        for (const date of activeDates) {
            const movies = parseVistaSessions(html, date, sedeId);
            vistaParsedBySedeAndDate[sedeId][date] = movies;
            for (const m of movies) {
                if (m.filmId) activeFilmIds.add(m.filmId);
            }
        }
    }

    // Priorizar fechas cercanas (hoy y mañana primero) y Xoco (003) para resolver primero lo más visto
    const ORDERED_SEDES = ['003', '002', '001'];
    // Pase 1: Sesiones directas de cada día y sede en orden cronológico
    for (const date of activeDates) {
        for (const sedeId of ORDERED_SEDES) {
            const movies = vistaParsedBySedeAndDate[sedeId]?.[date] || [];
            for (const m of movies) {
                for (const s of (m.sessions || [])) {
                    if (s.sessionId && !allSessionsMap.has(s.sessionId)) {
                        allSessionsMap.set(s.sessionId, {
                            sessionId: s.sessionId,
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
            const movies = vistaParsedBySedeAndDate[sedeId]?.[date] || [];
            for (const m of movies) {
                for (const st of (m.allShowtimes || [])) {
                    if (st.sessionId && !allSessionsMap.has(st.sessionId)) {
                        allSessionsMap.set(st.sessionId, {
                            sessionId: st.sessionId,
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

    console.log(`[Sync Pipeline] Found ${activeFilmIds.size} unique active films and ${allSessionsMap.size} unique sessions across ${activeDates.length} days.`);

    // FASE 2: Hidratación Incremental de Fichas Técnicas (Inmutables)
    let newMoviesScraped = 0;
    let existingMoviesSkipped = 0;
    const activeMoviesMap = {};

    for (const filmId of activeFilmIds) {
        const storageKey = `movies/${filmId}.json`;
        let details = await getStoredJson(env, storageKey);

        if (!details) {
            try {
                details = await scrapeMovieDetails(filmId);
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

    // FASE 3: Hidratación Incremental de Salas por Sesión (Opción C - R2 Inmutable)
    const sessionRoomsMap = await getSessionRoomsMap(env);
    const missingSessions = [];

    for (const [sessionId, sessionData] of allSessionsMap.entries()) {
        if (!sessionRoomsMap.has(sessionId)) {
            missingSessions.push(sessionData);
        }
    }

    console.log(`[Sync Pipeline] Session rooms status: ${sessionRoomsMap.size} cached, ${missingSessions.length} missing.`);

    const MAX_ROOM_SUBREQUESTS_PER_RUN = 25;
    let newSessionsResolved = 0;
    if (missingSessions.length > 0) {
        newSessionsResolved = await fetchMissingSessionRooms(missingSessions, sessionRoomsMap, MAX_ROOM_SUBREQUESTS_PER_RUN);
        await saveSessionRoomsMap(env, sessionRoomsMap);
        console.log(`[Sync Pipeline] Resolved and saved ${newSessionsResolved} new session rooms to R2.`);

        if (missingSessions.length > MAX_ROOM_SUBREQUESTS_PER_RUN) {
            const remaining = missingSessions.length - MAX_ROOM_SUBREQUESTS_PER_RUN;
            console.log(`[Sync Pipeline] ${remaining} sessions remain unresolved. Handled by GitHub Actions / subsequent cron runs.`);
        }
    }

    // FASE 4: Precomputación de Catálogo Consolidado y Feed Semanal (/feed)
    const durationsByDate = {};
    await Promise.all(activeDates.map(async (date) => {
        durationsByDate[date] = await fetchCarteleraDurationsMap(date, '000');
    }));

    const metadataByFilm = new Map();
    for (const date of activeDates) {
        const durationsMap = durationsByDate[date];
        if (durationsMap) {
            for (const [filmId, meta] of durationsMap.entries()) {
                if (!metadataByFilm.has(filmId)) {
                    metadataByFilm.set(filmId, meta);
                }
            }
        }
    }

    // Catálogo normalizado de películas (definido una sola vez)
    const feedMovies = {};
    for (const filmId of activeFilmIds) {
        const details = activeMoviesMap[filmId] || {};
        const meta = metadataByFilm.get(filmId) || {};

        let movieTitle = details.title || meta.title || '';
        if (!movieTitle) {
            for (const sedeId of ALL_SEDES) {
                for (const date of activeDates) {
                    const found = (vistaParsedBySedeAndDate[sedeId]?.[date] || []).find(m => m.filmId === filmId);
                    if (found && found.titulo) {
                        movieTitle = found.titulo;
                        break;
                    }
                }
                if (movieTitle) break;
            }
        }

        feedMovies[filmId] = {
            filmId,
            titulo: movieTitle || 'Sin Título',
            originalTitle: meta.originalTitle || details.originalTitle || '',
            duracion: meta.duration || details.duration || 90,
            director: meta.director || details.director || '',
            country: meta.country || details.country || '',
            year: meta.year || details.year || '',
            posterUrl: getPosterUrl(filmId),
            stillUrl: details.posterUrl || details.posterUrlLarge || getPosterUrl(filmId),
            trailerUrl: details.trailerUrl || null,
            generalInfo: details.generalInfo || '',
            credits: details.credits || '',
            synopsis: details.synopsis || '',
            info: details.info || []
        };
    }

    // Programaciones compactas agrupadas por fecha y sede
    const feedSchedules = {};

    for (const date of activeDates) {
        feedSchedules[date] = {};

        for (const sedeId of ALL_SEDES) {
            const vistaMovies = vistaParsedBySedeAndDate[sedeId][date] || [];
            const sedeCode = SEDE_CODES[sedeId] || sedeId;

            const resolvedMovies = vistaMovies.map(movie => {
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
