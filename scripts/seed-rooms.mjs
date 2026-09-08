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

    console.log(`\n🔍 Se encontraron ${allSessions.length} sesiones únicas para resolver.`);
    console.log('🚀 Resolviendo salas físicas en paralelo (concurrencia: 15)...');

    const roomsMap = {};
    let resolvedCount = 0;

    const resolvedList = await runPool(allSessions, async (session) => {
        const info = await resolveSessionRoom(session);
        if (info) {
            roomsMap[session.sessionId] = info;
            resolvedCount++;
        }
        return info;
    }, 15);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ ¡Completado en ${duration}s! Resueltas: ${resolvedCount}/${allSessions.length} salas físicas.`);

    const outputPayload = {
        lastUpdated: new Date().toISOString(),
        totalRooms: Object.keys(roomsMap).length,
        rooms: roomsMap
    };

    const outPath = path.resolve(process.cwd(), 'session-rooms.json');
    fs.writeFileSync(outPath, JSON.stringify(outputPayload, null, 2), 'utf8');
    console.log(`💾 Guardado archivo local: ${outPath}`);

    const args = process.argv.slice(2);
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
}

main().catch(err => {
    console.error('❌ Error en seed-rooms:', err);
    process.exit(1);
});
