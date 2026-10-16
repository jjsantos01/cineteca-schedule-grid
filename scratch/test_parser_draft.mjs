import { SEDE_CODES, SEDE_NAMES } from '../worker/src/config.js';
import { getPosterUrl } from '../worker/src/utils.js';

function formatDisplayTime(time24) {
    if (!time24 || typeof time24 !== 'string') return '';
    const match = time24.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return time24;
    let [_, hStr, mStr] = match;
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'p. m.' : 'a. m.';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
}

export function parseCarteleraCatalogoJson(jsonData, minDateStr = '') {
    const rawMovies = Array.isArray(jsonData) ? jsonData : (jsonData?.data || []);

    const activeDatesSet = new Set();
    const activeFilmIds = new Set();
    const catalogMovies = {};
    const schedulesBySedeAndDate = {
        '001': {},
        '002': {},
        '003': {}
    };
    const allSessionsMap = new Map();

    for (const item of rawMovies) {
        const filmId = item.film_id;
        if (!filmId) continue;

        const titulo = (item.titulo || '').trim();
        const clasificacion = (item.clasificacion || '').trim();
        const posterUrl = getPosterUrl(filmId) || item.poster;

        // Extraer eventos / ciclos
        const rawEventos = Array.isArray(item.eventos) && item.eventos.length > 0
            ? item.eventos
            : (item.event_code ? [{ code: item.event_code, name: item.event_name || '' }] : []);

        const eventos = [];
        const seenCodes = new Set();

        for (const ev of rawEventos) {
            const code = String(ev.code || '').trim();
            if (code && !seenCodes.has(code)) {
                seenCodes.add(code);
                eventos.push({
                    code,
                    name: String(ev.name || '').trim()
                });
            }
        }

        if (item.event_code) {
            const code = String(item.event_code).trim();
            if (code && !seenCodes.has(code)) {
                seenCodes.add(code);
                eventos.push({
                    code,
                    name: String(item.event_name || '').trim()
                });
            }
        }

        const ciclos = Array.from(seenCodes);

        // Guardar metadatos de catálogo
        catalogMovies[filmId] = {
            filmId,
            titulo,
            clasificacion,
            posterUrl,
            ciclos,
            eventos
        };

        // Procesar sedes y horarios
        let hasActiveSession = false;

        for (const sedeObj of (item.sedes || [])) {
            const sedeId = String(sedeObj.codigo_sede || '').trim();
            if (!schedulesBySedeAndDate[sedeId]) {
                schedulesBySedeAndDate[sedeId] = {};
            }

            // Agrupar horarios por fecha para esta película y sede
            const horariosByDate = new Map();

            for (const h of (sedeObj.horarios || [])) {
                const date = (h.fecha || '').trim();
                const time = (h.hora || '').trim();
                const sessionId = String(h.session_id || '').trim();

                if (!date || !time || !sessionId) continue;
                if (minDateStr && date < minDateStr) continue;

                activeDatesSet.add(date);
                hasActiveSession = true;

                if (!horariosByDate.has(date)) {
                    horariosByDate.set(date, []);
                }
                horariosByDate.get(date).push({
                    sessionId,
                    time,
                    displayTime: formatDisplayTime(time),
                    ticketUrl: `https://rbvfcn.cinetecanacional.net/Ticketing/visSelectTickets.aspx?cinemacode=${sedeId}&txtSessionId=${sessionId}&visLang=1`
                });

                // Registrar en allSessionsMap si no está presente
                if (!allSessionsMap.has(sessionId)) {
                    allSessionsMap.set(sessionId, {
                        sessionId,
                        filmId,
                        cinemaId: sedeId,
                        ticketUrl: `https://rbvfcn.cinetecanacional.net/Ticketing/visSelectTickets.aspx?cinemacode=${sedeId}&txtSessionId=${sessionId}&visLang=1`,
                        date,
                        movieTitle: titulo
                    });
                }
            }

            // Para cada fecha donde hay horarios en esta sede, agregar la película al arreglo
            for (const [date, sessionsList] of horariosByDate.entries()) {
                if (!schedulesBySedeAndDate[sedeId][date]) {
                    schedulesBySedeAndDate[sedeId][date] = [];
                }

                // Ordenar sesiones por hora cronológica
                sessionsList.sort((a, b) => a.time.localeCompare(b.time));

                const horarios = sessionsList.map(s => s.time);
                const ticketUrls = {};
                for (const s of sessionsList) {
                    ticketUrls[s.time] = s.ticketUrl;
                }

                schedulesBySedeAndDate[sedeId][date].push({
                    filmId,
                    titulo,
                    clasificacion,
                    tipoVersion: '',
                    horarios,
                    sessions: sessionsList,
                    ticketUrls,
                    sedeId,
                    sede: SEDE_NAMES[sedeId] || sedeObj.nombre_sede || sedeId,
                    sedeCodigo: SEDE_CODES[sedeId] || sedeId,
                    href: `detallePelicula.php?FilmId=${filmId}`,
                    posterUrl: getPosterUrl(filmId),
                    ciclos,
                    eventos
                });
            }
        }

        if (hasActiveSession) {
            activeFilmIds.add(filmId);
        }
    }

    const activeDates = Array.from(activeDatesSet).sort();

    // Asegurar que todas las sedes tengan claves para todas las fechas activas
    for (const sId of ['001', '002', '003']) {
        if (!schedulesBySedeAndDate[sId]) schedulesBySedeAndDate[sId] = {};
        for (const d of activeDates) {
            if (!schedulesBySedeAndDate[sId][d]) {
                schedulesBySedeAndDate[sId][d] = [];
            }
        }
    }

    return {
        activeDates,
        activeFilmIds,
        catalogMovies,
        schedulesBySedeAndDate,
        allSessionsMap
    };
}

async function run() {
    const res = await fetch('https://www.cinetecanacional.net/obtener_cartelera.php', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const json = await res.json();
    const result = parseCarteleraCatalogoJson(json, '2026-10-16');

    console.log('Active dates count:', result.activeDates.length, result.activeDates);
    console.log('Active films count:', result.activeFilmIds.size);
    console.log('Catalog movies count:', Object.keys(result.catalogMovies).length);
    console.log('All sessions count:', result.allSessionsMap.size);

    // Check sample movie in schedules
    const sampleDate = result.activeDates[0];
    for (const sId of ['001', '002', '003']) {
        const movies = result.schedulesBySedeAndDate[sId][sampleDate] || [];
        console.log(`Sede ${sId} on ${sampleDate}: ${movies.length} movies`);
        if (movies.length > 0) {
            console.log(` Sample movie at ${sId}:`, movies[0].titulo, 'Horarios:', movies[0].horarios, 'Clasif:', movies[0].clasificacion, 'Ciclos:', movies[0].ciclos);
        }
    }
}

run().catch(console.error);
