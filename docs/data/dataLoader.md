# Módulo: Orquestador de Carga de Datos (`js/dataLoader.js`)

## 📌 Propósito y Resumen
Orquesta la descarga del feed consolidado semanal desde el Cloudflare Worker (`/feed`) y realiza la hidratación completa en memoria de las carteleras para todas las sedes y fechas (7-8 días). Alimenta `state.cachedData`, `state.multiDayData` y precarga el catálogo de `apiCache.js` (sinopsis, pósters y tráilers) garantizando interactividad instantánea (0 ms) en cambios de fecha, alternancia de sedes y apertura de modales.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `config.js` (`SEDES`, `SELECTED_SEDES_KEY`), `utils.js` (`formatDateForAPI`, `showError`, `showLoading`), `api.js` (`fetchConsolidatedFeed`), `parser.js` (`hydrateMovieItem`), `grid.js` (`renderSchedule`), `moviesGrid.js` (`renderMoviesSchedule`), `loadingIndicator.js` (`showLoadingIndicator`, `hideLoadingIndicator`), `cache.js` (`getCachedData`, `setCachedData`), `apiCache.js` (`primeMovieCatalog`).
- **Consumido por**: `app.js` (`loadAndRenderMovies`, `toggleSedeSelection`).

---

## ⚙️ API Exportada

### `ensureFeedLoaded(forceRefresh = false)`
- **Firma**: `async ensureFeedLoaded(forceRefresh?: boolean): Promise<void>`
- **Descripción**: Descarga una única vez el feed consolidado semanal (`GET /feed`).
- **Flujo de Ejecución**:
  1. Si los datos ya están hidratados en memoria y no se fuerza refresco, retorna de inmediato.
  2. Si ya hay una petición en vuelo, reutiliza la misma promesa concurrente.
  3. Descarga el feed con `fetchConsolidatedFeed()`.
  4. **Precarga de Multimedia**: Invoca `primeMovieCatalog(feed.movies)` para que el modal y los carruseles tengan sinopsis, créditos, stills y trailers precargados sin spinners.
  5. **Precomputación Global de allShowtimes**: Recorre las funciones de la semana y agrupa cronológicamente todos los horarios de cada película en todas las sedes.
  6. **Hidratación en Memoria**: Puebla `state.cachedData[dateKey][sedeId]` y `state.multiDayData[dateKey][sedeId]` con objetos `Movie` completos mediante `hydrateMovieItem()`.

### `renderCurrentView()`
- **Firma**: `renderCurrentView(): void`
- **Descripción**: Función distribuidora central de renderizado de la cartelera a 0 ms de latencia.
- **Flujo de Ejecución**:
  1. Asegura que el carrusel de pósters permanezca visible (`#posterCarousel.style.display = ''`).
  2. Si `state.viewMode === 'movies'`: invoca `renderMoviesSchedule(state.multiDayData)`.
  3. Si `state.viewMode === 'day'`: invoca `renderSchedule(getCurrentMovieData())`.

### `loadAndRenderMovies()`
- **Firma**: `async loadAndRenderMovies(): Promise<void>`
- **Descripción**: Carga la cartelera de la fecha seleccionada en modo diario.
- **Flujo de Ejecución**:
  1. Si `state.viewMode === 'movies'`: delega en `loadAndRenderMultiDayMovies()`.
  2. Si el feed no ha sido descargado, muestra el indicador de carga y espera a `ensureFeedLoaded()`.
  3. Lee directamente de memoria `getCachedData(dateKey, sedeId)` para cada sede activa en `state.activeSedes`.
  4. Renderiza de inmediato con `renderCurrentView()`.

### `loadAndRenderMultiDayMovies()`
- **Firma**: `async loadAndRenderMultiDayMovies(): Promise<void>`
- **Descripción**: Despliega la cartelera continua de 7-8 días.
- **Flujo de Ejecución**:
  1. Si el feed no ha sido descargado, espera a `ensureFeedLoaded()`.
  2. Renderiza de inmediato con `renderCurrentView()` consumiendo `state.multiDayData` (0 llamadas de red).

### `toggleSedeSelection(sedeId, isChecked)`
- **Firma**: `async toggleSedeSelection(sedeId: string, isChecked: boolean): Promise<void>`
- **Descripción**: Añade o elimina una sede activa y actualiza la vista de inmediato desde memoria sin peticiones de red.
- **Flujo de Ejecución**:
  1. Actualiza `state.activeSedes`.
  2. Persiste la selección en `localStorage` (`SELECTED_SEDES_KEY`).
  3. Refresca `state.movieData` y renderiza inmediatamente con `renderCurrentView()`.

