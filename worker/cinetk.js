/**
 * Cloudflare Worker: cinetk
 * Arquitectura Asíncrona de Persistencia en Cloudflare R2 con Cron Triggers
 * Implementación de Opción C: Caché Inmutable de Salas por Sesión en R2
 * 
 * Punto de Entrada Principal (Entry Point & Dispatcher)
 * Los módulos especializados residen en el directorio ./src/:
 * - config.js: Constantes, sedes y cabeceras CORS
 * - handlers.js: Enrutamiento y respuestas HTTP (/v2, /movie-details, /health, etc.)
 * - pipeline.js: Orquestador del Cron Trigger (Fases 1 a 5 de sincronización)
 * - storage.js: Capa de persistencia R2 y Garbage Collection
 * - scrapers.js: Peticiones upstream a Cineteca Nacional y Vista Ticketing
 * - parsers.js: Parsers HTML y expresiones regulares
 * - notifications.js: Notificaciones y alertas de Telegram
 * - utils.js: Formateo, fechas CDMX, asignación de salas y respuestas JSON
 */

import { CORS_HEADERS } from './src/config.js';
import {
    handleHealth,
    handleAdminSync,
    handleTestTelegram,
    handleMovieDetails,
    handleScheduleRequest
} from './src/handlers.js';
import { sendTelegramNotification } from './src/notifications.js';
import { runSyncPipeline } from './src/pipeline.js';
import { jsonResponse } from './src/utils.js';

export default {
    /**
     * Manejador HTTP Fetch (Read-Through Cache con Fallback)
     */
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        try {
            const url = new URL(request.url);
            const path = url.pathname;

            if (path === '/health') {
                return await handleHealth(env);
            }

            if (path === '/admin/sync') {
                return await handleAdminSync(request, env, ctx);
            }

            if (path === '/admin/test-telegram') {
                return await handleTestTelegram(request, env);
            }

            if (path === '/movie-details') {
                return await handleMovieDetails(url, env, ctx);
            }

            // /v2 es el estándar canónico; /v1 y / sirven v2 por retrocompatibilidad
            if (path === '/v2' || path === '/v1' || path === '/') {
                return await handleScheduleRequest(url, env, ctx, 'v2');
            }

            return jsonResponse({
                error: `Not found: ${path}. Available endpoints: /v2, /v1, /movie-details, /health, /admin/sync, /admin/test-telegram`,
                data: []
            }, 404);

        } catch (error) {
            console.error('Worker fetch error:', error);
            return jsonResponse({
                error: error.message || 'Internal Server Error',
                data: []
            }, 500);
        }
    },

    /**
     * Manejador Cron Trigger (Ejecución periódica 8:00 - 21:00 CDMX)
     */
    async scheduled(event, env, ctx) {
        console.log(`[Cron] Starting scheduled sync trigger: ${event.cron} at ${new Date().toISOString()}`);
        ctx.waitUntil((async () => {
            try {
                await runSyncPipeline(env);
            } catch (err) {
                console.error('[Cron] Scheduled sync failed:', err);
                const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
                await sendTelegramNotification(
                    env,
                    `🚨 <b>[Cinetk Alert]</b> Falló la sincronización automática del Cron Trigger.\n\n` +
                    `<b>Error:</b> <code>${err.message || err}</code>\n` +
                    `🕒 <i>${now} CDMX</i>`
                );
            }
        })());
    }
};
