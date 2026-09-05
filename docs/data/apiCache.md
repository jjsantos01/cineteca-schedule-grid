# Módulo: Caché de Detalles y Multimedia (`js/apiCache.js`)

## 📌 Propósito y Resumen
Provee una capa de **caché en memoria con TTL (Time-To-Live de 1 hora)** y **deduplicación de peticiones en vuelo (in-flight request deduplication)** para fichas técnicas, sinopsis, imágenes de pósters y tráilers obtenidos desde el endpoint `movie-details`. Evita peticiones repetitivas a la red cuando el usuario navega entre películas en el modal o panel inline, así como peticiones concurrentes redundantes para el mismo `filmId`.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`MOVIE_DETAILS_API_URL`).
- **Consumido por**: `modal.js` (`buildMovieInfoContent`), `dataLoader.js` (`clearAPICache`).

---

## 🧠 Estructuras de Almacenamiento en Memoria

- `movieDetailsCache`: `Map<filmId, { data: { info: Array<string>, showtimes: Array|null }, timestamp: number }>`
- `movieImageCache`: `Map<filmId, { data: string, timestamp: number }>`
- `movieTrailerCache`: `Map<filmId, { data: string|null, timestamp: number }>`
  - **Soporte de valores nulos**: Utiliza `getCachedEntry` para distinguir entre un cache-miss y un resultado en caché cuyo valor es `null` (por ejemplo, películas sin tráiler), evitando consultas repetitivas de red.
- `inFlightRequests`: `Map<filmId, Promise<Object|null>>`
  - **Deduplicación en vuelo**: Si múltiples llamadas solicitan datos para un mismo `filmId` simultáneamente, comparten la misma promesa de red en lugar de disparar peticiones HTTP duplicadas. Se limpia automáticamente en el bloque `finally` al concluir la petición.
- **TTL**: 3,600,000 ms (1 hora). Si se consulta un item expirado, se elimina automáticamente del mapa.

---

## ⚙️ API Exportada

### `fetchMovieDataWithCache(filmId)`
- **Firma**: `async fetchMovieDataWithCache(filmId: string): Promise<{ movieDetails: { info: Array<string>, showtimes: Array|null }, imageUrl: string, trailerUrl: string|null }>`
- **Comportamiento**: Función coordinadora principal. Si los datos están en caché válida, los retorna de inmediato. Si no, consulta `MOVIE_DETAILS_API_URL` (deduplicando peticiones en vuelo con `inFlightRequests`), puebla inmediatamente los tres cachés (`movieDetailsCache`, `movieImageCache`, `movieTrailerCache`) con la respuesta unificada y retorna el objeto consolidado.

### `fetchMovieDetailsWithCache(filmId)`
- **Firma**: `async fetchMovieDetailsWithCache(filmId: string): Promise<{ info: Array<string>, showtimes: Array|null }>`
- **Comportamiento**: Retorna la ficha técnica desde caché. En caso de cache-miss, delega en `fetchMovieDataWithCache(filmId)` para aprovechar la deduplicación y poblado unificado.

### `fetchMovieImageWithCache(filmId)`
- **Firma**: `async fetchMovieImageWithCache(filmId: string): Promise<string|null>`
- **Comportamiento**: Retorna la URL del póster oficial o fallback desde caché. En caso de cache-miss, delega en `fetchMovieDataWithCache(filmId)`.

### `fetchMovieTrailerWithCache(filmId)`
- **Firma**: `async fetchMovieTrailerWithCache(filmId: string): Promise<string|null>`
- **Comportamiento**: Retorna la URL del tráiler de YouTube o `null` si la película no dispone de él (registrado en caché). En caso de cache-miss, delega en `fetchMovieDataWithCache(filmId)`.

### `clearAPICache()`
- **Firma**: `clearAPICache(): void`
- **Comportamiento**: Vacía todos los mapas de caché en memoria (`movieDetailsCache`, `movieImageCache`, `movieTrailerCache`) y cancela referencias en `inFlightRequests`. Se invoca automáticamente en `dataLoader.js` cuando el usuario cambia de fecha.
