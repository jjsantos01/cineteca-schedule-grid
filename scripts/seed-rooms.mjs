/**
 * Script de Inicialización y Seed de Salas Físicas (Node.js)
 * Resuelve las ~400 sesiones de las 3 sedes sin límites de subrequests de Cloudflare.
 * 
 * Uso:
 *   node scripts/seed-rooms.mjs
 *   node scripts/seed-rooms.mjs --upload-preview
 *   node scripts/seed-rooms.mjs --upload-remote
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
    const regex = /<a[^>]+href="([^"]*visSelectTickets[^"]*)"[^>]*>[\s\S]*?<time datetime="([^"]+)">([^<]+)<\/time>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const ticketUrl = match[1].replace(/&amp;/g, '&');
        const fullDateTime = match[2];
        const displayTime = match[3].trim();
        const datePart = fullDateTime.includes('T') ? fullDateTime.split('T')[0] : fullDateTime.split(' ')[0];

        const idMatch = ticketUrl.match(/txtSessionId=(\d+)/i) || ticketUrl.match(/SessionId=(\d+)/i);
        const sessionId = idMatch ? idMatch[1] : null;

        if (sessionId) {
            sessions.push({
                sessionId,
                cinemaId,
                sedeCode,
                date: datePart,
                displayTime,
                ticketUrl: ticketUrl.startsWith('//') ? `https:${ticketUrl}` : ticketUrl
            });
        }
    }
    return sessions;
}

async function resolveSessionRoom(session) {
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

async function runPool(items, fn, concurrency = 15) {
    const results = [];
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const i = index++;
            const res = await fn(items[i]);
            results[i] = res;
            if ((i + 1) % 50 === 0 || i === items.length - 1) {
                process.stdout.write(`Progress: ${i + 1}/${items.length} sessions resolved...\r`);
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    console.log('');
    return results;
}

async function main() {
    console.log('🎬 Iniciando Seed de Salas Físicas de Cineteca Nacional...');
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

    for (const cinemaId of ALL_SEDES) {
        console.log(`  📡 Descargando sesiones de sede ${cinemaId} (${SEDE_CODES[cinemaId]})...`);
        const html = await fetchVistaDetails(cinemaId);
        const list = extractSessionsFromHtml(html, cinemaId);
        for (const s of list) {
            if (!seenIds.has(s.sessionId)) {
                seenIds.add(s.sessionId);
                allSessions.push(s);
            }
        }
    }

    console.log(`\n🔍 Se encontraron ${allSessions.length} sesiones activas en cartelera.`);

    // Identificar cuáles faltan
    const sessionsToResolve = forceAll
        ? allSessions
        : allSessions.filter(s => !existingRooms[s.sessionId]);

    console.log(`📋 Sesiones a resolver en vivo: ${sessionsToResolve.length} (${allSessions.length - sessionsToResolve.length} ya cacheadas).`);

    const roomsMap = { ...existingRooms };
    let resolvedCount = 0;

    if (sessionsToResolve.length > 0) {
        console.log('🚀 Resolviendo salas físicas en paralelo (concurrencia: 15)...');
        await runPool(sessionsToResolve, async (session) => {
            const info = await resolveSessionRoom(session);
            if (info) {
                roomsMap[session.sessionId] = info;
                resolvedCount++;
            }
            return info;
        }, 15);
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
