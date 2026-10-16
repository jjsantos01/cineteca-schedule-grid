async function check() {
  const [carteleraRes, eventoRes] = await Promise.all([
    fetch('https://www.cinetecanacional.net/obtener_cartelera.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }),
    fetch('https://www.cinetecanacional.net/evento.php', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
  ]);

  const carteleraJson = await carteleraRes.json();
  const eventoHtml = await eventoRes.text();

  // Parse ciclos from evento.php
  const cardBlocks = eventoHtml.split(/<div\s+class=["'][^"']*card\b/i).slice(1);
  const ciclosMap = {};
  for (const block of cardBlocks) {
    const idMatch = block.match(/id_evento=([0-9a-zA-Z]+)/i);
    const titleMatch = block.match(/<h6[^>]*class=["'][^"']*card-title[^"']*["'][^>]*>([\s\S]*?)<\/h6>/i);
    if (idMatch && titleMatch) {
      const id = idMatch[1].trim();
      const nombre = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      ciclosMap[id] = { id, nombre, posterUrl: `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${id}?referenceScheme=Cinema&allowPlaceHolder` };
    }
  }

  console.log('Ciclos in evento.php:', Object.keys(ciclosMap));

  // Check eventos in cartelera
  const carteleraEventos = new Map();
  for (const m of (carteleraJson.data || [])) {
    for (const e of (m.eventos || [])) {
      if (e.code) {
        carteleraEventos.set(e.code, e.name);
      }
    }
    if (m.event_code) {
      carteleraEventos.set(m.event_code, m.event_name);
    }
  }

  console.log('Eventos in cartelera:', Array.from(carteleraEventos.keys()));

  for (const [code, name] of carteleraEventos.entries()) {
    if (!ciclosMap[code]) {
      console.log(`Evento ${code} (${name}) found in cartelera but NOT in evento.php!`);
    } else {
      console.log(`Evento ${code} matches: Cartelera="${name}" vs Evento.php="${ciclosMap[code].nombre}"`);
    }
  }
}

check().catch(console.error);
