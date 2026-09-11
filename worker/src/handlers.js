/**
 * Cloudflare Worker: cinetk
 * Módulo de Manejadores de Peticiones HTTP (Read-Through Caching y Admin)
 */

import { sendTelegramNotification } from './notifications.js';
import { runSyncPipeline } from './pipeline.js';
import { fetchVistaCinemasDetails, fetchMissingSessionRooms, scrapeMovieDetails, getSchedule } from './scrapers.js';
import { parseVistaSessions } from './parsers.js';
import { getStoredJson, putStoredJson, getSessionRoomsMap, saveSessionRoomsMap } from './storage.js';
import { jsonResponse, getTodayDateString, getNextDatesList } from './utils.js';
import { ALL_SEDES, SYNC_DAYS_AHEAD } from './config.js';

/**
 * GET /health: Estado de conectividad de R2, metadatos de sincronización y estado del feed
 */
export async function handleHealth(env) {
    const syncStatus = await getStoredJson(env, 'meta/sync-status.json');
    const feed = await getStoredJson(env, 'feed/consolidated.json');
    return jsonResponse({
        status: 'ok',
        worker: 'cinetk',
        architecture: 'r2_consolidated_feed',
        storage: env?.STORAGE ? 'connected' : 'disabled',
        feedReady: Boolean(feed),
        totalMoviesInFeed: feed?.totalMovies || 0,
        totalSessionsInFeed: feed?.totalSessions || 0,
        lastSync: syncStatus?.lastSync || null,
        durationMs: syncStatus?.durationMs || null,
        activeMoviesCount: syncStatus?.activeMoviesCount || 0,
        activeDates: syncStatus?.activeDates || [],
        totalSessionRooms: syncStatus?.totalSessionRooms || 0,
        endpoint: '/feed'
    });
}

/**
 * GET /feed: Feed consolidado con cartelera de 7-8 días, sedes y fichas técnicas completas
 */
export async function handleFeed(request, env, ctx) {
    const storageKey = 'feed/consolidated.json';

    // 1. Intentar lectura directa desde Cloudflare R2
    const cachedFeed = await getStoredJson(env, storageKey);
    if (cachedFeed && cachedFeed.movies && cachedFeed.schedules) {
        return jsonResponse(cachedFeed, 200, {
            'X-Cache': 'HIT-R2',
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=120'
        });
    }

    // 2. Fallback On-Demand: Si R2 aún no tiene el feed consolidado, ejecutar pipeline
    try {
        console.log('[Feed] Feed not found in R2, running sync pipeline on-demand...');
        const origin = new URL(request.url).origin;
        await runSyncPipeline(env, ctx, origin);
        const freshFeed = await getStoredJson(env, storageKey);
        if (freshFeed) {
            return jsonResponse(freshFeed, 200, {
                'X-Cache': 'MISS-GENERATED',
                'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=120'
            });
        }
    } catch (e) {
        console.error('Error generating consolidated feed on-demand:', e);
    }

    return jsonResponse({
        error: 'El feed consolidado aún no está listo. Intenta nuevamente en unos momentos.',
        data: null
    }, 503);
}

/**
 * GET /admin/sync: Disparo manual del pipeline de sincronización protegido por token
 */
export async function handleAdminSync(request, env, ctx) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('token') || request.headers.get('Authorization');

    if (env.ADMIN_TOKEN && secret !== env.ADMIN_TOKEN && secret !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized. Invalid token.' }, 401);
    }

    try {
        const origin = url.origin;
        const stats = await runSyncPipeline(env, ctx, origin);
        return jsonResponse({
            message: 'Sync pipeline executed successfully',
            stats
        });
    } catch (e) {
        console.error('Admin sync failed:', e);
        return jsonResponse({ error: e.message || 'Sync pipeline failed' }, 500);
    }
}

/**
 * POST/GET /admin/resolve-rooms: Resolución en cascada de salas de sesiones faltantes en lotes de 25
 */
export async function handleResolveRooms(request, env, ctx) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('token') || request.headers.get('Authorization');

    if (env.ADMIN_TOKEN && secret !== env.ADMIN_TOKEN && secret !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized. Invalid token.' }, 401);
    }

    const origin = url.origin;

    try {
        // 1. Obtener sesiones actuales de Vista para las 3 sedes
        const [vista001, vista002, vista003] = await Promise.all([
            fetchVistaCinemasDetails('001'),
            fetchVistaCinemasDetails('002'),
            fetchVistaCinemasDetails('003')
        ]);

        const activeDates = getNextDatesList(SYNC_DAYS_AHEAD);
        const allSessionsMap = new Map();

        const sedesData = [['001', vista001], ['002', vista002], ['003', vista003]];
        for (const [sedeId, html] of sedesData) {
            for (const date of activeDates) {
                const movies = parseVistaSessions(html, date, sedeId);
                for (const movie of movies) {
                    for (const s of (movie.sessions || [])) {
                        if (s.sessionId && !allSessionsMap.has(s.sessionId)) {
                            allSessionsMap.set(s.sessionId, {
                                sessionId: s.sessionId,
                                cinemaId: sedeId,
                                ticketUrl: s.ticketUrl,
                                date,
                                movieTitle: movie.titulo
                            });
                        }
                    }
                }
            }
        }

        // 2. Cargar sessionRoomsMap desde R2
        const sessionRoomsMap = await getSessionRoomsMap(env);

        // 3. Identificar las que faltan
        const missingSessions = [];
        for (const [sessionId, sessionData] of allSessionsMap.entries()) {
            if (!sessionRoomsMap.has(sessionId)) {
                missingSessions.push(sessionData);
            }
        }

        console.log(`[ResolveRooms] ${sessionRoomsMap.size} cached, ${missingSessions.length} missing.`);

        if (missingSessions.length === 0) {
            return jsonResponse({
                status: 'completed',
                resolvedInThisBatch: 0,
                remainingCount: 0,
                totalCached: sessionRoomsMap.size,
                message: 'All sessions are already resolved in R2.'
            });
        }

        const BATCH_LIMIT = 25;
        const toResolve = missingSessions.slice(0, BATCH_LIMIT);
        const resolvedInThisBatch = await fetchMissingSessionRooms(toResolve, sessionRoomsMap, BATCH_LIMIT);
        await saveSessionRoomsMap(env, sessionRoomsMap);
        console.log(`[ResolveRooms] Resolved and saved ${resolvedInThisBatch} rooms in this batch.`);

        const remainingCount = missingSessions.length - toResolve.length;

        // 4. Si aún faltan sesiones, responder estado parcial
        if (remainingCount > 0) {
            console.log(`[ResolveRooms] ${remainingCount} sessions remain.`);

            return jsonResponse({
                status: 'in_progress',
                resolvedInThisBatch,
                remainingCount,
                totalCached: sessionRoomsMap.size,
                message: `Batch of ${resolvedInThisBatch} resolved. ${remainingCount} sessions remain.`
            });
        }

        // 5. ¡Todas las sesiones resueltas! Recompilar el feed consolidado completo
        console.log(`[ResolveRooms] All sessions resolved! Recompiling consolidated feed...`);
        const stats = await runSyncPipeline(env, ctx, origin);

        return jsonResponse({
            status: 'completed',
            resolvedInThisBatch,
            remainingCount: 0,
            totalCached: sessionRoomsMap.size,
            message: 'All sessions resolved and consolidated feed regenerated successfully!',
            stats
        });
    } catch (e) {
        console.error('ResolveRooms failed:', e);
        return jsonResponse({ error: e.message || 'ResolveRooms failed' }, 500);
    }
}

/**
 * GET /admin/test-telegram: Prueba manual de envío de alertas a Telegram
 */
export async function handleTestTelegram(request, env) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('token') || request.headers.get('Authorization');

    if (env.ADMIN_TOKEN && secret !== env.ADMIN_TOKEN && secret !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized. Invalid token.' }, 401);
    }

    const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    const message = (
        `🎬 <b>[Cinetk] Alertas Conectadas con Éxito</b>\n\n` +
        `✅ El worker <code>cinetk</code> se ha configurado correctamente para enviar notificaciones automáticas a este chat.\n\n` +
        `Si el Cron Trigger de sincronización falla en algún momento, recibirás una alerta aquí.\n\n` +
        `🕒 <i>${now} CDMX</i>`
    );

    const result = await sendTelegramNotification(env, message);
    return jsonResponse({
        message: result.success ? 'Telegram test message sent successfully' : 'Failed to send Telegram test message',
        result
    }, result.success ? 200 : 500);
}
