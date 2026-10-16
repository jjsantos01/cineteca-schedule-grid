async function check() {
  const res = await fetch('https://rbvfcn.cinetecanacional.net/Browsing/Cinemas/Details/003', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const timeRegex = /<time datetime="([^"]+)">/gi;
  let match;
  const dates = new Set();
  while ((match = timeRegex.exec(html)) !== null) {
    dates.add(match[1].split('T')[0]);
  }
  console.log('Vista 003 dates count:', dates.size, 'Dates:', Array.from(dates).sort());
}
check().catch(console.error);
