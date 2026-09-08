# Módulo: Caché de Detalles y Multimedia (`js/apiCache.js`)

## 📌 Propósito y Resumen
Provee una capa de **almacenamiento en memoria ultrarrápido (0 ms de latencia)** para fichas técnicas, sinopsis, imágenes (stills/pósters) y tráilers. Con la arquitectura de **Feed Consolidado (`/feed`)**, los datos de todo el catálogo de películas se precargan directamente en este módulo al iniciar la aplicación mediante `primeMovieCatalog(moviesMap)`, eliminando por completo las peticiones HTTP individuales a la red al abrir modales o navegar entre películas.

---

## 📦 Dependencias e Interacciones
- **Importa**: Ninguna dependencia de red directa (los datos provienen del feed cargado por `dataLoader.js`).
- **Consumido por**:
  - `dataLoader.js`: Invoca `primeMovieCatalog(feed.movies)` durante la carga inicial del feed unificado.
  - `modal.js`: Invoca `fetchMovieDataWithCache(filmId)` para poblar la ficha técnica, póster y tráiler del modal de manera instantánea.

---

## 🧠 Estructuras de Almacenamiento en Memoria

- `movieDetailsCache`: `Map<filmId, { data: { info: Array<string>, showtimes: Array|null, generalInfo: string, credits: string, synopsis: string, title: string }, timestamp: number }>`
- `movieImageCache`: `Map<filmId, { data: string, timestamp: number }>`
- `movieTrailerCache`: `Map<filmId, { data: string|null, timestamp: number }>`
  - **Soporte de valores nulos**: Utiliza `getCachedEntry` para distinguir entre un cache-miss y un resultado en caché cuyo valor es `null` (por ejemplo, películas sin tráiler).
- `inFlightRequests`: `Map<filmId, Promise<Object|null>>`
- **TTL**: 3,600,000 ms (1 hora).

---

## ⚙️ API Exportada

### `primeMovieCatalog(moviesMap)`
- **Firma**: `primeMovieCatalog(moviesMap: Object): void`
- **Comportamiento**: Itera sobre el diccionario global `feed.movies` precálculado por el Worker y puebla de forma atómica los tres mapas en memoria (`movieDetailsCache`, `movieImageCache`, `movieTrailerCache`). Garantiza que cualquier apertura subsecuente de modales responda de inmediato en 0 ms.

### `fetchMovieDataWithCache(filmId)`
- **Firma**: `async fetchMovieDataWithCache(filmId: string): Promise<{ movieDetails: { info: Array<string>, showtimes: Array|null }, imageUrl: string, trailerUrl: string|null }>`
- **Comportamiento**: Función coordinadora principal consumida por `modal.js`. Lee directamente de los mapas en memoria precargados por `primeMovieCatalog`. Si no existe información (caso atípico), retorna fallbacks estables sin bloquear la interfaz.

### `fetchMovieDetailsWithCache(filmId)`
- **Firma**: `async fetchMovieDetailsWithCache(filmId: string): Promise<{ info: Array<string>, showtimes: Array|null }>`
- **Comportamiento**: Retorna la ficha técnica desde memoria. Si falta, delega en `fetchMovieDataWithCache(filmId)`.

### `fetchMovieImageWithCache(filmId)`
- **Firma**: `async fetchMovieImageWithCache(filmId: string): Promise<string|null>`
- **Comportamiento**: Retorna la URL del póster oficial o fallback desde memoria.

### `fetchMovieTrailerWithCache(filmId)`
- **Firma**: `async fetchMovieTrailerWithCache(filmId: string): Promise<string|null>`
- **Comportamiento**: Retorna la URL del tráiler de YouTube o `null` si la película no dispone de él.

### `clearAPICache()`
- **Firma**: `clearAPICache(): void`
- **Comportamiento**: Vacía todos los mapas de caché en memoria (`movieDetailsCache`, `movieImageCache`, `movieTrailerCache`) y cancela referencias en `inFlightRequests`.
