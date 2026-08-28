# Módulo: Caché de Detalles y Multimedia (`js/apiCache.js`)

## 📌 Propósito y Resumen
Provee una capa de **caché en memoria con TTL (Time-To-Live de 1 hora)** para fichas técnicas, sinopsis, imágenes de pósters y tráilers obtenidos desde el endpoint `movie-details`. Evita peticiones repetitivas a la red cuando el usuario navega entre películas en el modal o panel inline.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`MOVIE_DETAILS_API_URL`).
- **Consumido por**: `modal.js` (`buildMovieInfoContent`), `dataLoader.js` (`clearAPICache`).

---

## 🧠 Estructuras de Almacenamiento en Memoria

- `movieDetailsCache`: `Map<filmId, { data: { info: Array<string>, showtimes: Array }, timestamp: number }>`
- `movieImageCache`: `Map<filmId, { data: string, timestamp: number }>`
- `movieTrailerCache`: `Map<filmId, { data: string|null, timestamp: number }>`
- **TTL**: 3,600,000 ms (1 hora). Si se consulta un item expirado, se elimina automáticamente del mapa.

---

## ⚙️ API Exportada

### `fetchMovieDetailsWithCache(filmId)`
- **Firma**: `async fetchMovieDetailsWithCache(filmId: string): Promise<{ info: Array<string>, showtimes: Array|null }>`
- **Comportamiento**: Si existe en caché válida, lo retorna directamente. Si no, consulta `MOVIE_DETAILS_API_URL`, almacena el resultado en los tres mapas de caché y retorna la ficha.

### `fetchMovieImageWithCache(filmId)`
- **Firma**: `async fetchMovieImageWithCache(filmId: string): Promise<string|null>`
- **Comportamiento**: Retorna la URL del póster oficial o un fallback al endpoint gráfico de Cineteca.

### `fetchMovieTrailerWithCache(filmId)`
- **Firma**: `async fetchMovieTrailerWithCache(filmId: string): Promise<string|null>`
- **Comportamiento**: Retorna la URL del tráiler de YouTube si está disponible en la ficha técnica.

### `clearAPICache()`
- **Firma**: `clearAPICache(): void`
- **Comportamiento**: Vacía todos los mapas de caché en memoria. Se invoca automáticamente en `dataLoader.js` cuando el usuario cambia de fecha.
