# Módulo: Utilidades de Películas (`js/movieUtils.js`)

## 📌 Propósito y Resumen
Contiene funciones de transformación textual, extracción de metadatos cinematográficos (año, título original), generación de enlaces de búsqueda a bases de datos externas (IMDb, Letterboxd, YouTube) y **cálculo enriquecido en memoria (lazy caching)** para funciones horarias.

---

## 📦 Dependencias e Interacciones
- **Importa**: `utils.js` (`timeToMinutes`, `minutesToTime`, `getMovieUniqueId`).
- **Consumido por**: `filters.js`, `grid.js`, `modal.js`, `parser.js`, `selection.js`, `tooltip.js`.

---

## ⚙️ API Exportada

### `decodeHTMLEntities(text)`
- **Firma**: `decodeHTMLEntities(text: string): string`
- **Descripción**: Reemplaza entidades HTML comunes en español (`&oacute;` → `ó`, `&ntilde;` → `ñ`, `&Aacute;` → `Á`, `&nbsp;` → espacio, etc.) para visualización limpia de textos.

### `extractMovieMetadata(firstParagraph, movieTitle)`
- **Firma**: `extractMovieMetadata(firstParagraph: string, movieTitle?: string): { year: string, originalTitle: string }`
- **Descripción**: Analiza el primer párrafo descriptivo de Cineteca (típicamente contiene país, año, título original y director) y extrae de forma precisa el año (4 dígitos `19xx`/`20xx`) y el título original.

### `cleanSearchTitle(title)`
- **Firma**: `cleanSearchTitle(title: string): string`
- **Descripción**: Remueve menciones o sufijos de versión de doblaje/subtítulos (ej. `SUB`, `DOB`, `(SUB)`, `[DOB]`, `- SUB`, `/ DOB`) y normaliza espacios para generar términos de búsqueda limpios y exactos en motores externos.

### `generateSearchURLs(searchTitle, year)`
- **Firma**: `generateSearchURLs(searchTitle: string, year?: string): { imdbUrl: string, letterboxdUrl: string, youtubeUrl: string }`
- **Descripción**: Limpia automáticamente variantes `SUB`/`DOB` del título y construye enlaces directos con términos y filtros de año predefinidos para:
  - **IMDb**: `https://www.imdb.com/es/search/title/?title=...&release_date=YYYY-01-01,YYYY-12-31`
  - **Letterboxd**: `https://letterboxd.com/search/films/...`
  - **YouTube**: `https://www.youtube.com/results?search_query=... trailer`

### `formatMovieTitle(title, version, includeSpace)`
- **Firma**: `formatMovieTitle(title: string, version?: string, includeSpace?: boolean): string`
- **Descripción**: Concatena el título con la variante de idioma (ej. `"Anatomía de una caída SUB"`).

### `getEnrichedShowtime(movie, horario)`
- **Firma**: `getEnrichedShowtime(movie: Object, horario: string): { startMinutes: number, endMinutes: number, endTime: string, uniqueId: string }`
- **Optimización Crítica**: Emplea una caché perezosa almacenada en `movie._enrichedShowtimes` (`Map`). Calcula `startMinutes`, `endMinutes` (sumando `movie.duracion`), `endTime` formateado y `uniqueId` una sola vez por función, acelerando drásticamente el filtrado y detección de traslapes en bucles masivos.
