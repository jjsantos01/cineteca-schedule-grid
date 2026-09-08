/**
 * Cloudflare Worker: cinetk
 * Módulo de Persistencia en Cloudflare R2 y Garbage Collection
 */

/**
 * Obtener mapa en memoria de salas físicas por sesión desde R2
 */
export async function getSessionRoomsMap(env) {
    const stored = await getStoredJson(env, 'meta/session-rooms.json');
    return stored?.rooms ? new Map(Object.entries(stored.rooms)) : new Map();
}

/**
 * Guardar mapa consolidado de salas por sesión en R2
 */
export async function saveSessionRoomsMap(env, roomsMap) {
    const roomsObj = Object.fromEntries(roomsMap.entries());
    await putStoredJson(env, 'meta/session-rooms.json', {
        lastUpdated: new Date().toISOString(),
        totalRooms: roomsMap.size,
        rooms: roomsObj
    });
}

/**
 * Purgar del mapa en memoria aquellas sesiones cuya fecha sea anterior al día de hoy
 */
export function purgeExpiredSessions(sessionRoomsMap, todayDate) {
    let purged = 0;
    for (const [sessionId, info] of sessionRoomsMap.entries()) {
        if (info.date && info.date < todayDate) {
            sessionRoomsMap.delete(sessionId);
            purged++;
        }
    }
    return purged;
}

/**
 * Leer y deserializar un objeto JSON desde Cloudflare R2
 */
export async function getStoredJson(env, key) {
    if (!env?.STORAGE) return null;
    try {
        const object = await env.STORAGE.get(key);
        if (!object) return null;
        return await object.json();
    } catch (e) {
        console.warn(`[R2] Error reading key "${key}":`, e.message);
        return null;
    }
}

/**
 * Verificar existencia de una clave en R2 mediante operación HEAD
 */
export async function hasStoredKey(env, key) {
    if (!env?.STORAGE) return false;
    try {
        const head = await env.STORAGE.head(key);
        return head !== null;
    } catch (e) {
        return false;
    }
}

/**
 * Serializar y escribir un objeto JSON en Cloudflare R2 con metadatos personalizados
 */
export async function putStoredJson(env, key, data, customMetadata = {}) {
    if (!env?.STORAGE) return;
    try {
        const body = JSON.stringify(data);
        await env.STORAGE.put(key, body, {
            httpMetadata: {
                contentType: 'application/json; charset=utf-8'
            },
            customMetadata: {
                savedAt: new Date().toISOString(),
                ...customMetadata
            }
        });
    } catch (e) {
        console.warn(`[R2] Error writing key "${key}":`, e.message);
    }
}

/**
 * Garbage Collector: Eliminar fichas técnicas de películas fuera de la cartelera activa
 */
export async function purgeObsoleteMovies(env, activeFilmIds) {
    if (!env?.STORAGE) return 0;
    try {
        let count = 0;
        let cursor = undefined;

        do {
            const list = await env.STORAGE.list({ prefix: 'movies/', cursor });
            for (const obj of list.objects) {
                const match = obj.key.match(/^movies\/(.+)\.json$/);
                if (match) {
                    const filmId = match[1];
                    if (!activeFilmIds.has(filmId)) {
                        await env.STORAGE.delete(obj.key);
                        count++;
                    }
                }
            }
            cursor = list.truncated ? list.cursor : undefined;
        } while (cursor);

        return count;
    } catch (e) {
        console.warn('[R2] Error during movie garbage collection:', e.message);
        return 0;
    }
}

/**
 * Garbage Collector: Eliminar carteleras de fechas pasadas
 */
export async function purgeExpiredSchedules(env, todayDate) {
    if (!env?.STORAGE) return 0;
    try {
        let count = 0;
        let cursor = undefined;

        do {
            const list = await env.STORAGE.list({ prefix: 'schedules/', cursor });
            for (const obj of list.objects) {
                const match = obj.key.match(/^schedules\/(v1|v2)\/\d+\/(\d{4}-\d{2}-\d{2})\.json$/);
                if (match) {
                    const scheduleDate = match[2];
                    if (scheduleDate < todayDate) {
                        await env.STORAGE.delete(obj.key);
                        count++;
                    }
                }
            }
            cursor = list.truncated ? list.cursor : undefined;
        } while (cursor);

        return count;
    } catch (e) {
        console.warn('[R2] Error during schedule garbage collection:', e.message);
        return 0;
    }
}
