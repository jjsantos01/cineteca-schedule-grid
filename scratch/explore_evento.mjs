async function test() {
  const res = await fetch('https://www.cinetecanacional.net/evento.php', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();

  // Match each card block
  const cardRegex = /<div class="card\b[\s\S]*?(?=<div class="card\b|<\/div>\s*<\/div>\s*<\/div>\s*<\/main>|$)/gi;
  // Or match card by card container:
  // Let's see how cards are structured
  const cards = html.split('<div class="card').slice(1);
  console.log('Cards count:', cards.length);

  const results = {};
  for (const card of cards) {
    const idMatch = card.match(/id_evento=([0-9a-zA-Z]+)/i);
    const titleMatch = card.match(/<h6[^>]*class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\/h6>/i);
    if (idMatch && titleMatch) {
      const id = idMatch[1].trim();
      const nombre = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const posterUrl = `https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/EventPosterGraphic/${id}?referenceScheme=Cinema&allowPlaceHolder`;
      results[id] = { id, nombre, posterUrl };
    }
  }

  console.log('Parsed ciclos:', Object.keys(results).length);
  console.log(JSON.stringify(results, null, 2));
}

test().catch(console.error);
