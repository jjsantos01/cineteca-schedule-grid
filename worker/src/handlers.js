/**
 * Cloudflare Worker: cinetk
 * Módulo de Manejadores de Peticiones HTTP (Read-Through Caching y Admin)
 */

import { sendTelegramNotification } from './notifications.js';
import { runSyncPipeline } from './pipeline.js';
import { scrapeMovieDetails, getSchedule } from './scrapers.js';
import { getStoredJson, putStoredJson } from './storage.js';
import { jsonResponse, getTodayDateString } from './utils.js';

/**
 * GET /health: Estado de conectividad de R2, metadatos de sincronización y conteos activos
 */
export async function handleHealth(env) {
    const syncStatus = await getStoredJson(env, 'meta/sync-status.json');
    return jsonResponse({
        status: 'ok',
        worker: 'cinetk',
        architecture: 'r2_persisted_cron_cache',
        storage: env?.STORAGE ? 'connected' : 'disabled',
        lastSync: syncStatus?.lastSync || null,
        durationMs: syncStatus?.durationMs || null,
        activeMoviesCount: syncStatus?.activeMoviesCount || 0,
        activeDates: syncStatus?.activeDates || [],
        totalSessionRooms: syncStatus?.totalSessionRooms || 0,
        versions: ['v2'],
        defaultVersion: 'v2'
    });
}

/**
 * GET /admin/sync: Disparo manual del pipeline de sincronización protegido por token
 */
export async function handleAdminSync(request, env, ctx) {
    const url = new URL(request.url);
    const secret = url.searchParams.get('token') || request.headers.get('Authorization');

    // Si hay un ADMIN_TOKEN configurado en env, validar autorización
    if (env.ADMIN_TOKEN && secret !== env.ADMIN_TOKEN && secret !== `Bearer ${env.ADMIN_TOKEN}`) {
        return jsonResponse({ error: 'Unauthorized. Invalid token.' }, 401);
    }

    try {
        const stats = await runSyncPipeline(env);
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

/**
 * GET /movie-details: Ficha técnica y multimedia con Read-Through Cache hacia R2
 */
export async function handleMovieDetails(url, env, ctx) {
    const filmId = url.searchParams.get('filmId') || url.searchParams.get('FilmId');
    if (!filmId) {
        return jsonResponse({ error: 'Missing required query param: filmId' }, 400);
    }

    const storageKey = `movies/${filmId}.json`;

    // 1. Intentar lectura desde Cloudflare R2
    const cachedMovie = await getStoredJson(env, storageKey);
    if (cachedMovie) {
        return jsonResponse(cachedMovie, 200, {
            'X-Cache': 'HIT-R2',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=600'
        });
    }

    // 2. Fallback On-Demand: Scraping en vivo
    try {
        const movieDetails = await scrapeMovieDetails(filmId);

        // Guardar en R2 en segundo plano
        if (ctx && ctx.waitUntil) {
            ctx.waitUntil(putStoredJson(env, storageKey, movieDetails, { filmId }));
        } else {
            await putStoredJson(env, storageKey, movieDetails, { filmId });
        }

        return jsonResponse(movieDetails, 200, {
            'X-Cache': 'MISS-FETCHED',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=600'
        });
    } catch (e) {
        console.error(`Error scraping movie details for ${filmId}:`, e);
        return jsonResponse({ error: e.message || 'Failed to fetch movie details' }, 500);
    }
}

/**
 * GET /v2, /v1, /: Cartelera por sede y fecha con Read-Through Cache desde R2
 */
export async function handleScheduleRequest(url, env, ctx, strategy = 'v2') {
    const cinemaId = url.searchParams.get('cinemaId') || url.searchParams.get('cinema') || '003';
    const dia = url.searchParams.get('dia') || url.searchParams.get('fecha') || getTodayDateString();
    const storageKey = `schedules/${strategy}/${cinemaId}/${dia}.json`;

    // 1. Intentar lectura directa de Cloudflare R2 con validación de completitud
    const cachedSchedule = await getStoredJson(env, storageKey);
    const nonOutdoor = (cachedSchedule?.data || []).filter(m => !m.titulo?.toLowerCase().includes('foro al aire libre'));
    const dummySala1Count = nonOutdoor.filter(m => m.sala === '1' || (m.salaCompleta && /\bSALA\s+1\b/i.test(m.salaCompleta))).length;
    const isCachedValid = cachedSchedule && cachedSchedule.data && cachedSchedule.data.length > 0 &&
        cachedSchedule.isComplete === true &&
        (dummySala1Count <= Math.max(2, nonOutdoor.length * 0.35));

    if (isCachedValid) {
        return jsonResponse(cachedSchedule, 200, {
            'X-Cache': 'HIT-R2',
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=120'
        });
    }

    // 2. Fallback On-Demand: Scraping en vivo y guardado en R2
    try {
        const scheduleResult = await getSchedule(cinemaId, dia, env);
        const payload = {
            version: strategy,
            source: 'vista_session_rooms',
            cinemaId,
            date: dia,
            isComplete: scheduleResult.isComplete,
            unresolvedCount: scheduleResult.unresolvedCount,
            total: scheduleResult.movies.length,
            data: scheduleResult.movies
        };

        if (scheduleResult.isComplete && env?.STORAGE) {
            if (ctx && ctx.waitUntil) {
                ctx.waitUntil(putStoredJson(env, storageKey, payload, { cinemaId, date: dia, version: strategy }));
            } else {
                await putStoredJson(env, storageKey, payload, { cinemaId, date: dia, version: strategy });
            }
        }

        return jsonResponse(payload, 200, {
            'X-Cache': 'MISS-FETCHED',
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=120'
        });
    } catch (e) {
        console.error(`Error fetching on-demand ${strategy} schedule:`, e);
        return jsonResponse({
            version: strategy,
            error: e.message || `Failed to fetch ${strategy} schedule`,
            cinemaId,
            date: dia,
            data: []
        }, 502);
    }
}
