async function test() {
  const res = await fetch('https://www.cinetecanacional.net/obtener_cartelera.php', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const json = await res.json();
  const items = json.data || [];
  console.log('Total items in data:', items.length);

  const keys = new Set();
  items.forEach(m => Object.keys(m).forEach(k => keys.add(k)));
  console.log('Movie keys:', Array.from(keys));

  // Let's examine clasificacion values
  const clasifs = new Set();
  const eventosSet = new Set();
  let hasEventCodeCount = 0;
  let hasEventosCount = 0;

  for (const m of items) {
    clasifs.add(m.clasificacion);
    if (m.event_code) hasEventCodeCount++;
    if (m.eventos && m.eventos.length > 0) hasEventosCount++;
    if (m.eventos) {
      m.eventos.forEach(ev => eventosSet.add(JSON.stringify(ev)));
    }
  }

  console.log('Clasificaciones found:', Array.from(clasifs));
  console.log(`hasEventCodeCount: ${hasEventCodeCount}, hasEventosCount: ${hasEventosCount}`);
  console.log('Unique eventos:', Array.from(eventosSet).map(s => JSON.parse(s)));

  // Inspect sedes and horarios
  let totalHorarios = 0;
  let sampleHorario = null;
  for (const m of items) {
    for (const s of (m.sedes || [])) {
      for (const h of (s.horarios || [])) {
        totalHorarios++;
        if (!sampleHorario) sampleHorario = { movie: m.film_id, sede: s.codigo_sede, ...h };
      }
    }
  }
  console.log('Total horarios count:', totalHorarios);
  console.log('Sample horario:', sampleHorario);
}

test().catch(console.error);
