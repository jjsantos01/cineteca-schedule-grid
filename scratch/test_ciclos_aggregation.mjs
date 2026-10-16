import { parseCarteleraCatalogoJson } from './test_parser_draft.mjs';

async function testCiclosAggregation() {
    const [carteleraRes, eventoRes] = await Promise.all([
        fetch('https://www.cinetecanacional.net/obtener_cartelera.php', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }),
        fetch('https://www.cinetecanacional.net/evento.php', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        })
    ]);

    const json = await carteleraRes.json();
    const html = await eventoRes.text();

    const parsedCartelera = parseCarteleraCatalogoJson(json, '2026-10-16');

    // Parse ciclos from HTML
    const cardBlocks = html.split(/<div\s+class=["'][^"']*card\b/i).slice(1);
    const ciclosMap = {};
    for (const block of cardBlocks) {
        const idMatch = block.match(/id_evento=([0-9a-zA-Z]+)/i);
        const titleMatch = block.match(/<h6[^>]*class=["'][^"']*card-title[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i);
        if (idMatch && titleMatch) {
            const id = idMatch[1].trim();
            const nombre = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            ciclosMap[id] = {
                id,
                nombre,
                posterUrl: `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${id}?referenceScheme=Cinema&allowPlaceHolder`
            };
        }
    }

    const feedCiclos = {};
    for (const [id, ciclo] of Object.entries(ciclosMap)) {
        feedCiclos[id] = {
            ...ciclo,
            totalPeliculas: 0
        };
    }

    for (const [filmId, catMovie] of Object.entries(parsedCartelera.catalogMovies)) {
        if (!parsedCartelera.activeFilmIds.has(filmId)) continue;
        for (const cId of (catMovie.ciclos || [])) {
            if (!feedCiclos[cId]) {
                feedCiclos[cId] = {
                    id: cId,
                    nombre: `Ciclo ${cId}`,
                    posterUrl: `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${cId}?referenceScheme=Cinema&allowPlaceHolder`,
                    totalPeliculas: 0
                };
            }
            feedCiclos[cId].totalPeliculas++;
        }
    }

    console.log('Aggregated feedCiclos:');
    console.log(JSON.stringify(feedCiclos, null, 2));
}

testCiclosAggregation().catch(console.error);
