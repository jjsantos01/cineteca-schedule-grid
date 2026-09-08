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
 */
export async function runSyncPipeline(env) {
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

    for (const filmId of activeFilmIds) {
        const storageKey = `movies/${filmId}.json`;
        const exists = await hasStoredKey(env, storageKey);

        if (!exists) {
            try {
                const details = await scrapeMovieDetails(filmId);
                await putStoredJson(env, storageKey, details, { filmId });
                newMoviesScraped++;
            } catch (e) {
                console.warn(`[Sync Pipeline] Failed to scrape movie details for ${filmId}:`, e.message);
            }
        } else {
            existingMoviesSkipped++;
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

    let newSessionsResolved = 0;
    if (missingSessions.length > 0) {
        newSessionsResolved = await fetchMissingSessionRooms(missingSessions, sessionRoomsMap);
        await saveSessionRoomsMap(env, sessionRoomsMap);
        console.log(`[Sync Pipeline] Resolved and saved ${newSessionsResolved} new session rooms to R2.`);
    }

    // FASE 4: Precomputación de Carteleras Diarias (v2)
    const durationsByDate = {};
    await Promise.all(activeDates.map(async (date) => {
        durationsByDate[date] = await fetchCarteleraDurationsMap(date, '000');
    }));

    let schedulesWritten = 0;

    for (const date of activeDates) {
        const durationsMap = durationsByDate[date] || new Map();

        for (const sedeId of ALL_SEDES) {
            const vistaMovies = vistaParsedBySedeAndDate[sedeId][date] || [];
            const sedeCode = SEDE_CODES[sedeId] || sedeId;

            // Asignar salas resueltas de la sesión específica y enriquecer metadatos
            const resolvedMovies = vistaMovies.map(movie => {
                const metadata = durationsMap.get(movie.filmId) || {};
                const firstSession = movie.sessions && movie.sessions.length > 0 ? movie.sessions[0] : null;
                let sessionInfo = firstSession && firstSession.sessionId ? sessionRoomsMap.get(firstSession.sessionId) : null;

                // Fallback inteligente: si la primera sesión no está en caché, buscar en cualquier otra sesión del día o de la película
                if (!sessionInfo && movie.sessions) {
                    for (const s of movie.sessions) {
                        if (s.sessionId && sessionRoomsMap.has(s.sessionId)) {
                            sessionInfo = sessionRoomsMap.get(s.sessionId);
                            break;
                        }
                    }
                }
                if (!sessionInfo && movie.allShowtimes) {
                    for (const st of movie.allShowtimes) {
                        if (st.sessionId && sessionRoomsMap.has(st.sessionId) && (st.sedeId === sedeId || !st.sedeId)) {
                            sessionInfo = sessionRoomsMap.get(st.sessionId);
                            break;
                        }
                    }
                }

                const isOutdoor = movie.titulo?.toLowerCase().includes('foro al aire libre');
                const sala = sessionInfo ? sessionInfo.sala : (isOutdoor ? 'FORO AL AIRE LIBRE' : '1');
                const salaCompleta = sessionInfo ? sessionInfo.salaCompleta : (isOutdoor ? 'FORO AL AIRE LIBRE' : `SALA 1 ${sedeCode}`);

                // Enriquecer cada función en movie.allShowtimes
                const enrichedShowtimes = (movie.allShowtimes || []).map(st => {
                    const stSessionInfo = st.sessionId ? sessionRoomsMap.get(st.sessionId) : null;
                    const stSedeCode = SEDE_CODES[st.sedeId] || st.sedeCodigo || sedeCode;
                    const stIsOutdoor = isOutdoor || st.sede?.toLowerCase().includes('foro');
                    return {
                        ...st,
                        sala: stSessionInfo ? stSessionInfo.sala : (stIsOutdoor ? 'FORO AL AIRE LIBRE' : '1'),
                        salaCompleta: stSessionInfo ? stSessionInfo.salaCompleta : (stIsOutdoor ? 'FORO AL AIRE LIBRE' : `SALA 1 ${stSedeCode}`)
                    };
                });

                // Enriquecer movie.sessions
                const enrichedSessions = (movie.sessions || []).map(s => {
                    const sSessionInfo = s.sessionId ? sessionRoomsMap.get(s.sessionId) : null;
                    return {
                        ...s,
                        sala: sSessionInfo ? sSessionInfo.sala : (isOutdoor ? 'FORO AL AIRE LIBRE' : '1'),
                        salaCompleta: sSessionInfo ? sSessionInfo.salaCompleta : (isOutdoor ? 'FORO AL AIRE LIBRE' : `SALA 1 ${sedeCode}`)
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

            const processedMovies = assignOutdoorOrSpecialLanes(resolvedMovies);
            const sortedMovies = sortMoviesBySala(processedMovies);

            const nonOutdoor = sortedMovies.filter(m => !m.titulo?.toLowerCase().includes('foro al aire libre'));
            const unresolvedCount = nonOutdoor.filter(m => m.sala === '1' && (!m.sessions?.[0]?.sessionId || !sessionRoomsMap.has(m.sessions[0].sessionId))).length;
            const isComplete = unresolvedCount === 0;

            // Guardar versión v2 precomputada en R2 SOLO si está 100% resuelta
            const v2Payload = {
                version: 'v2',
                source: 'vista_session_rooms',
                cinemaId: sedeId,
                date,
                isComplete,
                unresolvedCount,
                total: sortedMovies.length,
                data: sortedMovies
            };

            if (isComplete) {
                await putStoredJson(env, `schedules/v2/${sedeId}/${date}.json`, v2Payload, {
                    cinemaId: sedeId,
                    date,
                    version: 'v2'
                });
                schedulesWritten++;
            }
        }
    }

    console.log(`[Sync Pipeline] Wrote ${schedulesWritten} schedule files (v2) to R2.`);

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
        schedulesWritten,
        purgedMovies,
        purgedSchedules,
        purgedSessions,
        status: 'success'
    };

    await putStoredJson(env, 'meta/sync-status.json', syncStatus);
    console.log(`[Sync Pipeline] Completed in ${totalDurationMs}ms. Purged: ${purgedMovies} movies, ${purgedSchedules} expired schedules, ${purgedSessions} expired sessions.`);

    return syncStatus;
}
