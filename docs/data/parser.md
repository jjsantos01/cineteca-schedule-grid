# Módulo: Parser de Películas (`js/parser.js`)

## 📌 Propósito y Resumen
Normaliza la información cruda que proviene del proxy (tanto en formato de objeto JSON moderno de la API como en cadenas de texto legadas del scraper) en una estructura de datos estándar y enriquecida para cada película.

---

## 📦 Dependencias e Interacciones
- **Importa**: `utils.js` (`extractFilmId`), `movieUtils.js` (`formatMovieTitle`), `config.js` (`SEDES`).
- **Consumido por**: `dataLoader.js` (`hydrateMovieItem`).

---

## 📄 Estructura del Objeto Normalizado `Movie`

```javascript
{
    titulo: "La Caza",
    tipoVersion: "SUB",               // 'DOB', 'SUB' o ''
    sala: "1",                        // '1', '2', ..., 'FORO AL AIRE LIBRE', 'POR CONFIRMAR'
    salaCompleta: "SALA 1 XOCO",      // Etiqueta legible de sala
    horarios: ["16:00", "19:00"],     // Horarios para esta sala en formato 'HH:MM'
    allShowtimes: [],                 // Todas las funciones de la semana para esta película
    duracion: 115,                    // Duración en minutos (entero)
    sede: "XOCO",                     // Nombre de la sede
    sedeId: "003",                    // '001' (CNCH), '002' (CNA), '003' (XOCO)
    sedeCodigo: "XOCO",               // 'CNCH', 'CNA', 'XOCO'
    href: "detallePelicula.php?FilmId=123&cinemaId=000",
    ticketUrls: { "16:00": "https..." }, // Mapa de links de compra directa por horario
    filmId: "123",                    // ID único de la película
    posterUrl: "https...",            // URL directa del póster
    stillUrl: "https...",             // URL de imagen horizontal / still
    trailerUrl: "https...",           // URL del tráiler de YouTube o null
    synopsis: "...",                  // Sinopsis de la película
    credits: "...",                   // Ficha de dirección, elenco y créditos
    generalInfo: "...",               // Ficha técnica compacta
    displayTitle: "La Caza SUB",      // Título formateado para la UI
    _enrichedShowtimes: Map           // Caché lazy para datos temporales por horario
}
```

---

## ⚙️ API Exportada

### `hydrateMovieItem(item, movieMeta, sedeId, dateKey, allShowtimes)`
- **Firma**: `hydrateMovieItem(item: Object, movieMeta: Object, sedeId: string, dateKey: string, allShowtimes?: Array): Movie`
- **Comportamiento**: Hidrata un registro compacto de función procedente de `feed.schedules[date][sede]` con los metadatos globales del catálogo desduplicado `feed.movies[filmId]`. Genera el objeto canónico `Movie` con título formateado, salas canónicas, mapa de boletos y funciones agregadas de toda la semana. Es la función principal utilizada por `dataLoader.js`.

### `parseMovieData(textOrItem, sedeId, href, ticketUrls)`
- **Firma**: `parseMovieData(textOrItem: Object|string, sedeId: string, href?: string, ticketUrls?: Object): Movie | null`
- **Capacidades de Parseo**:
  1. **Objetos JSON**: Extrae propiedades directas (`titulo`, `duracion`, `sala`, `horarios`, `sessions`), infiere nombres canónicos de salas y sedes, y vincula mapas de `ticketUrls`.
  2. **Cadenas de Texto / Expresiones Regulares**: Procesa cadenas tradicionales usando regex para títulos (`/^(.+?)(?:\s+(DOB|SUB))?\s*\(/`), duración (`/Dur\.\s*:\s*(\d+)\s*mins?\.\)/i`), salas estándar (`/SALA\s+(\d+)\s+(CNA|XOCO|CNCH)\s*:\s*(.+)$/i`) y foros al aire libre (`/FORO AL AIRE LIBRE\s*:\s*(.+)$/i`).
- **Retorno**: Retorna el objeto `Movie` o `null` si faltan campos indispensables (`title`, `horarios` o `duracion`).
