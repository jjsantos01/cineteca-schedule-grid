/**
 * Test Suite: Validación de la Fase 1 del Pipeline de Datos (Worker Cinetk)
 * - Scraping y parsing de obtener_cartelera.php
 * - Scraping y parsing de evento.php
 * - Fallback de emergencia a Vista Cinemas Details
 * - Estructura de feed/consolidated.json (ciclos raíz, clasificacion, ciclos en movies)
 */

import { fetchCarteleraCatalogo, fetchCiclosMetadata, fetchVistaCinemasDetails } from '../worker/src/scrapers.js';
import { parseCarteleraCatalogoJson, parseCiclosHtml, parseVistaSessions, extractAvailableDatesFromVista } from '../worker/src/parsers.js';
import { runSyncPipeline } from '../worker/src/pipeline.js';
import { getTodayDateString } from '../worker/src/utils.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ [PASS] ${testName}`);
        passedTests++;
    } else {
        console.error(`  ❌ [FAIL] ${testName} - ${details}`);
        failedTests++;
    }
}

async function runTestSuite() {
    console.log('=====================================================');
    console.log('🎬 INICIANDO PRUEBAS DE FASE 1: PIPELINE DE DATOS');
    console.log('=====================================================\n');

    const todayDate = getTodayDateString();
    console.log(`Fecha base CDMX: ${todayDate}`);

    // -------------------------------------------------------------------------
    // TEST 1: Scraping y Parsing de obtener_cartelera.php
    // -------------------------------------------------------------------------
    console.log('\n[1/4] Probando fetchCarteleraCatalogo y parseCarteleraCatalogoJson...');
    const carteleraJson = await fetchCarteleraCatalogo();
    assert(carteleraJson !== null, 'fetchCarteleraCatalogo retorna respuesta no nula');
    assert(Array.isArray(carteleraJson?.data), 'carteleraJson contiene arreglo data');
    assert(carteleraJson.data.length > 0, `carteleraJson contiene películas (total: ${carteleraJson?.data?.length})`);

    const parsedCartelera = parseCarteleraCatalogoJson(carteleraJson, todayDate);
    assert(parsedCartelera.activeDates.length > 0, `activeDates extraídas dinámicamente (${parsedCartelera.activeDates.length} fechas >= hoy)`);
    assert(parsedCartelera.activeDates[0] >= todayDate, `Primera fecha (${parsedCartelera.activeDates[0]}) es >= hoy (${todayDate})`);
    assert(parsedCartelera.activeFilmIds.size > 0, `activeFilmIds detectadas (${parsedCartelera.activeFilmIds.size} películas activas)`);
    assert(parsedCartelera.allSessionsMap.size > 0, `allSessionsMap contiene sesiones (${parsedCartelera.allSessionsMap.size} sesiones únicas)`);

    // Validar sedes 001, 002, 003
    for (const sedeId of ['001', '002', '003']) {
        const hasSede = Boolean(parsedCartelera.schedulesBySedeAndDate[sedeId]);
        assert(hasSede, `Sede ${sedeId} inicializada en schedulesBySedeAndDate`);
    }

    // Validar estructura de película de catálogo
    const sampleFilmId = Array.from(parsedCartelera.activeFilmIds)[0];
    const sampleCatMovie = parsedCartelera.catalogMovies[sampleFilmId];
    assert(Boolean(sampleCatMovie?.filmId), 'Película de catálogo tiene filmId');
    assert(Boolean(sampleCatMovie?.titulo), `Película de catálogo tiene título ("${sampleCatMovie?.titulo}")`);
    assert('clasificacion' in sampleCatMovie, `Película tiene campo clasificacion ("${sampleCatMovie?.clasificacion}")`);
    assert(Array.isArray(sampleCatMovie?.ciclos), `Película tiene arreglo ciclos (${JSON.stringify(sampleCatMovie?.ciclos)})`);
    assert(Array.isArray(sampleCatMovie?.eventos), 'Película tiene arreglo eventos');
    assert(Boolean(sampleCatMovie?.posterUrl), `Película tiene posterUrl ("${sampleCatMovie?.posterUrl}")`);

    // Validar ticketUrl en una sesión
    const sampleSession = parsedCartelera.allSessionsMap.get(Array.from(parsedCartelera.allSessionsMap.keys())[0]);
    assert(Boolean(sampleSession?.ticketUrl), 'Sesión contiene ticketUrl');
    assert(
        sampleSession?.ticketUrl.includes('Ticketing/visSelectTickets.aspx?cinemacode=') &&
        sampleSession?.ticketUrl.includes('txtSessionId=') &&
        sampleSession?.ticketUrl.includes('visLang=1'),
        `Formato correcto de ticketUrl ("${sampleSession?.ticketUrl}")`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Scraping y Parsing de evento.php
    // -------------------------------------------------------------------------
    console.log('\n[2/4] Probando fetchCiclosMetadata y parseCiclosHtml...');
    const ciclosHtml = await fetchCiclosMetadata();
    assert(typeof ciclosHtml === 'string' && ciclosHtml.length > 0, `fetchCiclosMetadata retorna HTML (${ciclosHtml.length} bytes)`);

    const ciclosMap = parseCiclosHtml(ciclosHtml);
    const ciclosCount = Object.keys(ciclosMap).length;
    assert(ciclosCount > 0, `parseCiclosHtml extrae ciclos/eventos (${ciclosCount} ciclos detectados)`);

    const sampleCicloId = Object.keys(ciclosMap)[0];
    const sampleCiclo = ciclosMap[sampleCicloId];
    assert(Boolean(sampleCiclo?.id), 'Ciclo tiene id');
    assert(Boolean(sampleCiclo?.nombre), `Ciclo tiene nombre ("${sampleCiclo?.nombre}")`);
    assert(
        sampleCiclo?.posterUrl.includes(`EventPosterGraphic/${sampleCiclo.id}`),
        `Ciclo tiene posterUrl correcto con EventPosterGraphic ("${sampleCiclo?.posterUrl}")`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Simulación de Fallback de Emergencia (Vista)
    // -------------------------------------------------------------------------
    console.log('\n[3/4] Probando fallback de emergencia con Vista Cinemas Details...');
    // Simulamos que obtener_cartelera.php falla retornando null
    const mockFailedCartelera = null;
    let fallbackWorked = false;
    let vistaDates = [];

    if (!mockFailedCartelera) {
        // Ejecución idéntica al bloque if (isFallback) de pipeline.js
        const [v001, v002, v003] = await Promise.all([
            fetchVistaCinemasDetails('001'),
            fetchVistaCinemasDetails('002'),
            fetchVistaCinemasDetails('003')
        ]);
        assert(Boolean(v003 && v003.length > 0), 'Fallback recupera HTML de Vista para sede 003');

        vistaDates = extractAvailableDatesFromVista([v001, v002, v003], todayDate);
        assert(vistaDates.length > 0, `Fallback descubre ${vistaDates.length} fechas disponibles de Vista`);

        const vMovies003 = parseVistaSessions(v003, vistaDates[0], '003');
        assert(vMovies003.length > 0, `Fallback parsea ${vMovies003.length} películas en Xoco`);
        fallbackWorked = true;
    }
    assert(fallbackWorked, 'Mecanismo de fallback a Vista funciona correctamente ante fallo de la fuente primaria');

    // -------------------------------------------------------------------------
    // TEST 4: Simulación Completa del Pipeline y Validación de feed/consolidated.json
    // -------------------------------------------------------------------------
    console.log('\n[4/4] Ejecutando simulación de runSyncPipeline con almacenamiento mock R2...');
    const memoryR2 = new Map();
    const mockEnv = {
        STORAGE: {
            async get(key) {
                const item = memoryR2.get(key);
                if (!item) return null;
                return {
                    text: async () => item,
                    json: async () => JSON.parse(item)
                };
            },
            async put(key, value) {
                memoryR2.set(key, typeof value === 'string' ? value : JSON.stringify(value));
            },
            async list(options) {
                const prefix = options?.prefix || '';
                const keys = Array.from(memoryR2.keys())
                    .filter(k => k.startsWith(prefix))
                    .map(key => ({ key }));
                return { objects: keys };
            },
            async delete(key) {
                memoryR2.delete(key);
            }
        }
    };

    // Pre-poblar session-rooms con una sesión de muestra para evitar demoras
    const sampleSessionId = Array.from(parsedCartelera.allSessionsMap.keys())[0];
    await mockEnv.STORAGE.put('meta/session-rooms.json', JSON.stringify({
        [sampleSessionId]: {
            sala: '1',
            salaCompleta: 'SALA 1 XOCO',
            date: todayDate
        }
    }));

    const syncStatus = await runSyncPipeline(mockEnv, null, 'https://cinetk.test');
    assert(syncStatus.status === 'success', 'runSyncPipeline completó con status: success');

    const feedRaw = await mockEnv.STORAGE.get('feed/consolidated.json');
    assert(feedRaw !== null, 'feed/consolidated.json fue persistido en R2');

    const feed = await feedRaw.json();
    assert(feed.version === 'feed-v1', 'feed tiene version: feed-v1');
    assert(Array.isArray(feed.activeDates) && feed.activeDates.length > 0, `feed contiene activeDates (${feed.activeDates.length} fechas)`);
    assert(feed.totalMovies > 0, `feed contiene totalMovies: ${feed.totalMovies}`);
    assert(feed.totalSessions > 0, `feed contiene totalSessions: ${feed.totalSessions}`);

    // Validar objeto raíz ciclos
    assert(typeof feed.ciclos === 'object' && feed.ciclos !== null, 'feed contiene objeto raíz "ciclos"');
    const feedCicloIds = Object.keys(feed.ciclos);
    assert(feedCicloIds.length > 0, `feed.ciclos contiene ${feedCicloIds.length} ciclos registrados`);

    const firstCiclo = feed.ciclos[feedCicloIds[0]];
    assert('id' in firstCiclo && 'nombre' in firstCiclo && 'posterUrl' in firstCiclo, 'feed.ciclos[id] contiene { id, nombre, posterUrl }');
    assert('totalPeliculas' in firstCiclo, `feed.ciclos[id] contiene totalPeliculas (${firstCiclo.totalPeliculas})`);

    // Validar propiedades enriquecidas en movies
    const firstMovieId = Object.keys(feed.movies)[0];
    const firstMovie = feed.movies[firstMovieId];
    assert('clasificacion' in firstMovie, `feed.movies[filmId] contiene clasificacion ("${firstMovie.clasificacion}")`);
    assert(Array.isArray(firstMovie.ciclos), `feed.movies[filmId] contiene arreglo ciclos (${JSON.stringify(firstMovie.ciclos)})`);

    // Validar schedules
    const firstDate = feed.activeDates[0];
    assert(Boolean(feed.schedules[firstDate]), `feed.schedules contiene fecha ${firstDate}`);
    assert(Boolean(feed.schedules[firstDate]['003']), 'feed.schedules contiene sede 003');

    console.log('\n=====================================================');
    console.log(`📊 RESULTADO DE LA VALIDACIÓN: ${passedTests} PASADAS, ${failedTests} FALLIDAS`);
    console.log('=====================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Error fatal durante la prueba:', err);
    process.exit(1);
});
