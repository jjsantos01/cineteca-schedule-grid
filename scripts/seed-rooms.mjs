/**
 * Script de Inicialización y Seed de Salas Físicas (Node.js)
 * Resuelve las ~650 sesiones de las 3 sedes de forma masiva y ultrarrápida
 * utilizando detallePelicula.php por película, con fallback por sesión.
 * 
 * Uso:
 *   node scripts/seed-rooms.mjs
 *   node scripts/seed-rooms.mjs --upload-preview
 *   node scripts/seed-rooms.mjs --upload-remote
 *   node scripts/seed-rooms.mjs --upload-remote --force --notify-worker
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SEDE_CODES = {
    '001': 'CNCH',
    '002': 'CNA',
    '003': 'XOCO'
};

const ALL_SEDES = ['001', '002', '003'];

async function fetchVistaDetails(cinemaId) {
    const url = `https://rbvfcn.cinetecanacional.net/Browsing/Cinemas/Details/${cinemaId}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching details for ${cinemaId}`);
    return await res.text();
}

function extractSessionsFromHtml(html, cinemaId) {
    const sessions = [];
    const sedeCode = SEDE_CODES[cinemaId] || cinemaId;

    const filmBlockRegex = /<div class="film-item[^"]*"[^>]*data-movie-id="([^"]+)"[\s\S]*?(?=<div class="film-item\b|$)/g;
    let match;

    while ((match = filmBlockRegex.exec(html)) !== null) {
        const filmId = match[1];
        const block = match[0];

        const sessionMatches = [...block.matchAll(/<a[^>]+href="([^"]*visSelectTickets[^"]*)"[^>]*>[\s\S]*?<time datetime="([^"]+)">([^<]+)<\/time>/gi)];

        for (const sm of sessionMatches) {
            const ticketUrl = sm[1].replace(/&amp;/g, '&');
            const fullDateTime = sm[2];
            const displayTime = sm[3].trim();
            const datePart = fullDateTime.includes('T') ? fullDateTime.split('T')[0] : fullDateTime.split(' ')[0];

            const idMatch = ticketUrl.match(/txtSessionId=(\d+)/i) || ticketUrl.match(/SessionId=(\d+)/i);
            const sessionId = idMatch ? idMatch[1] : null;

            if (sessionId) {
                sessions.push({
                    sessionId,
                    filmId,
                    cinemaId,
                    sedeCode,
                    date: datePart,
                    displayTime,
                    ticketUrl: ticketUrl.startsWith('//') ? `https:${ticketUrl}` : ticketUrl
                });
            }
        }
    }
    return sessions;
}

/**
 * Extraer salas físicas de todas las sesiones de una película desde detallePelicula.php
 */
async function fetchMovieRooms(filmId) {
    const url = `https://www.cinetecanacional.net/detallePelicula.php?FilmId=${filmId}&cinemaId=000`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
            }
        });
        if (!res.ok) return new Map();
        const html = await res.text();

        const sessionRegex = /<a[^>]+href=['"]([^'"]*visSelectTickets[^'"]*)['"][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div><\/a>/gi;
        let match;
        const roomsMap = new Map();

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
    } catch (e) {
        console.warn(`⚠️ Error consultando salas para película ${filmId}:`, e.message);
        return new Map();
    }
}

/**
 * Fallback: Resolver sala física real de una sesión individual en visSelectTickets.aspx
 */
async function resolveSingleSessionRoomFallback(session) {
    const cleanUrl = session.ticketUrl.includes('AspxAutoDetectCookieSupport')
        ? session.ticketUrl
        : `${session.ticketUrl}&AspxAutoDetectCookieSupport=1`;

    try {
        const res = await fetch(cleanUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Cookie': 'AspxAutoDetectCookieSupport=1'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();

        const screenMatch = html.match(/<div class="session-overview-line cinema-screen-name">\s*([^<]+)\s*<\/div>/i);
        if (screenMatch) {
            const screenText = screenMatch[1].trim();
            const numMatch = screenText.match(/SALA\s*(\d+)/i);
            if (numMatch) {
                return {
                    sala: numMatch[1],
                    salaCompleta: `SALA ${numMatch[1]} ${session.sedeCode}`,
                    date: session.date
                };
            }
            if (screenText.toLowerCase().includes('foro')) {
                return {
                    sala: 'FORO AL AIRE LIBRE',
                    salaCompleta: 'FORO AL AIRE LIBRE',
                    date: session.date
                };
            }
            return {
                sala: screenText,
                salaCompleta: `${screenText} ${session.sedeCode}`,
                date: session.date
            };
        }

        if (html.includes('AltMessage=NoTickets')) {
            return {
                sala: 'FORO AL AIRE LIBRE',
                salaCompleta: 'FORO AL AIRE LIBRE',
                date: session.date
            };
        }
    } catch (err) {
        // Fallback retry or null
    }
    return null;
}

async function runPool(items, fn, concurrency = 10) {
    const results = [];
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const i = index++;
            const res = await fn(items[i]);
            results[i] = res;
            if ((i + 1) % 10 === 0 || i === items.length - 1) {
                process.stdout.write(`Progreso: ${i + 1}/${items.length} consultas procesadas...\r`);
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    console.log('');
    return results;
}

async function main() {
    console.log('🎬 Iniciando Seed de Salas Físicas de Cineteca Nacional (Modo Optimizado por Película)...');
    const startTime = Date.now();
    const args = process.argv.slice(2);
    const forceAll = args.includes('--force');

    const outPath = path.resolve(process.cwd(), 'session-rooms.json');
    let existingRooms = {};
    if (!forceAll && fs.existsSync(outPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(outPath, 'utf8'));
            if (raw && raw.rooms) {
                existingRooms = raw.rooms;
                console.log(`📦 Se cargaron ${Object.keys(existingRooms).length} salas previamente resueltas desde caché local.`);
            }
        } catch (e) {
            console.warn('⚠️ No se pudo leer el archivo local previo, se resolverán todas.');
        }
    }

    const allSessions = [];
    const seenIds = new Set();
    const sessionsById = new Map();

    for (const cinemaId of ALL_SEDES) {
        console.log(`  📡 Descargando sesiones de sede ${cinemaId} (${SEDE_CODES[cinemaId]})...`);
        const html = await fetchVistaDetails(cinemaId);
        const list = extractSessionsFromHtml(html, cinemaId);
        for (const s of list) {
            if (!seenIds.has(s.sessionId)) {
                seenIds.add(s.sessionId);
                allSessions.push(s);
                sessionsById.set(s.sessionId, s);
            }
        }
    }

    console.log(`\n🔍 Se encontraron ${allSessions.length} sesiones activas en cartelera.`);

    // Identificar sesiones faltantes
    const sessionsToResolve = forceAll
        ? allSessions
        : allSessions.filter(s => !existingRooms[s.sessionId]);

    console.log(`📋 Sesiones a resolver: ${sessionsToResolve.length} (${allSessions.length - sessionsToResolve.length} ya cacheadas).`);

    const roomsMap = { ...existingRooms };
    let resolvedCount = 0;

    if (sessionsToResolve.length > 0) {
        // Agrupar sesiones faltantes por película
        const missingFilmsSet = new Set();
        for (const s of sessionsToResolve) {
            if (s.filmId) missingFilmsSet.add(s.filmId);
        }

        const missingFilmIds = Array.from(missingFilmsSet);
        console.log(`🚀 Resolviendo salas consultando ${missingFilmIds.length} películas en detallePelicula.php (concurrencia: 10)...`);

        await runPool(missingFilmIds, async (filmId) => {
            const movieRooms = await fetchMovieRooms(filmId);
            for (const [sessionId, roomInfo] of movieRooms.entries()) {
                const sData = sessionsById.get(sessionId);
                roomsMap[sessionId] = {
                    ...roomInfo,
                    date: sData?.date || roomInfo.date
                };
                resolvedCount++;
            }
        }, 10);

        // Verificar si alguna sesión pendiente no se resolvió vía detallePelicula.php
        const stillMissing = sessionsToResolve.filter(s => !roomsMap[s.sessionId]);
        if (stillMissing.length > 0) {
            console.log(`ℹ️ ${stillMissing.length} sesiones no encontradas en detallePelicula.php, ejecutando fallback individual...`);
            await runPool(stillMissing, async (session) => {
                const info = await resolveSingleSessionRoomFallback(session);
                if (info) {
                    roomsMap[session.sessionId] = info;
                    resolvedCount++;
                }
            }, 10);
        }
    }

    // Purgar sesiones de días anteriores a hoy (CDMX)
    const todayCdmx = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());

    let purgedCount = 0;
    for (const [sid, info] of Object.entries(roomsMap)) {
        if (info.date && info.date < todayCdmx) {
            delete roomsMap[sid];
            purgedCount++;
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ ¡Completado en ${duration}s! Resueltas en esta corrida: ${resolvedCount} | Purgadas: ${purgedCount} | Total activas: ${Object.keys(roomsMap).length}.`);

    const outputPayload = {
        lastUpdated: new Date().toISOString(),
        totalRooms: Object.keys(roomsMap).length,
        rooms: roomsMap
    };

    fs.writeFileSync(outPath, JSON.stringify(outputPayload, null, 2), 'utf8');
    console.log(`💾 Guardado archivo local: ${outPath}`);

    if (args.includes('--upload-preview')) {
        console.log('☁️  Subiendo a R2 (cinetk-storage-preview)...');
        execSync(`npx --yes wrangler r2 object put cinetk-storage-preview/meta/session-rooms.json --file "${outPath}" --remote`, { stdio: 'inherit' });
        console.log('🎉 Subido exitosamente a cinetk-storage-preview');
    } else if (args.includes('--upload-remote')) {
        console.log('☁️  Subiendo a R2 (cinetk-storage producción)...');
        execSync(`npx --yes wrangler r2 object put cinetk-storage/meta/session-rooms.json --file "${outPath}" --remote`, { stdio: 'inherit' });
        console.log('🎉 Subido exitosamente a cinetk-storage');
    } else {
        console.log('\n💡 Tip: Para subir a R2 usa:');
        console.log('   node scripts/seed-rooms.mjs --upload-preview   (desarrollo)');
        console.log('   node scripts/seed-rooms.mjs --upload-remote    (producción)');
    }

    // Notificación automática al Worker para regenerar el feed consolidado
    const shouldNotify = args.includes('--notify-worker') || args.includes('--sync') || process.env.TRIGGER_SYNC === 'true';
    if (shouldNotify) {
        const workerBase = process.env.WORKER_URL || 'https://cinetk.jjsantosochoa.workers.dev';
        const token = process.env.ADMIN_TOKEN || '';
        const syncUrl = `${workerBase}/admin/sync${token ? `?token=${encodeURIComponent(token)}` : ''}`;

        console.log(`\n🔄 Notificando al Worker para recompilar feed consolidado (${workerBase})...`);
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(syncUrl, { method: 'POST', headers });
            if (res.ok) {
                const data = await res.json();
                console.log('✅ ¡Feed consolidado recompilado exitosamente por el Worker!', data?.stats ? `(${data.stats.durationMs}ms)` : '');
            } else {
                console.warn(`⚠️ El Worker respondió con status HTTP ${res.status}`);
            }
        } catch (e) {
            console.warn(`⚠️ Error al notificar al Worker: ${e.message}`);
        }
    }
}

main().catch(err => {
    console.error('❌ Error en seed-rooms:', err);
    process.exit(1);
});
