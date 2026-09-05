# Módulo: Sistema de Filtros (`js/filters.js`)

## 📌 Propósito y Resumen
Aplica los filtros de búsqueda por texto (`state.movieFilter`), rango de horas (`state.timeFilterStart`, `state.timeFilterEnd`) o selección de póster (`state.carouselFilterFilmId`) sobre todos los bloques de funciones en el DOM. Actualiza los contadores de coincidencias, resalta las salas con películas coincidentes y **reordena dinámicamente las sedes** para colocar al principio aquellas con mayor número de resultados.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `utils.js` (`timeToMinutes`), `movieUtils.js` (`getEnrichedShowtime`), `filterLock.js` (`FILTER_LOCKS`).
- **Consumido por**: `app.js` (`setMovieFilter`, `setTimeFilter`, `clearTimeFilter`, `applyFilters`), `grid.js` (`applyFilters`, `hasActiveFilters`), `selection.js` (`hasActiveFilters`).

---

## ⚙️ API Exportada

### `applyFilters()`
- **Firma**: `applyFilters(): void`
- **Flujo de Ejecución**:
  1. Itera sobre cada `.movie-block` en el DOM (incluyendo los bloques `.movie-block--compact` de la vista multi-día).
  2. Evalúa coincidencia de título (`displayTitle` o `titulo` contra `state.movieFilter` o `state.carouselFilterFilmId`).
  3. Evalúa ventana horaria (`enriched.startMinutes >= filterStartMinutes && <= filterEndMinutes`).
  4. Agrega o remueve la clase `.filtered-out` según corresponda.
  5. Actualiza los contadores textuales en `#filterResults` y `#timeFilterResults`.
  6. Resalta las filas o carriles con funciones visibles: `highlightRoomsWithVisibleMovies()` busca el contenedor padre `.room-row` (en modo día) o `.movies-lane` (en modo multi-día) y aplica la clase `.has-visible-movies`.
  7. Ejecuta `updateSedeResultCounts()`:
     - **En modo multi-día (`state.viewMode === 'movies'`)**: delega en `updateDayResultCounts()`, actualizando la insignia `.day-count-badge` de cada `.day-container` con el total de funciones coincidentes (`"X funciones coincidentes"`) o `"Sin resultados"` (con la clase `.sede-filter-count--empty`). Si no hay filtros activos, restaura el conteo total del día (`"X películas, Y funciones"`).
     - **En modo día (`state.viewMode === 'day'`)**: añade etiquetas con número de funciones encontradas y sus horarios específicos en las cabeceras de sede (`h2.sede-header`), y reordena los contenedores `.sede-container` de mayor a menor número de coincidencias.
  8. Dispara el evento `document.dispatchEvent(new CustomEvent('filters:updated'))`.

### `updateSedeResultCounts()`
- **Firma**: `updateSedeResultCounts(): void`
- **Descripción**: Si `state.viewMode === 'movies'`, invoca `updateDayResultCounts()`. En modo día, actualiza los subtítulos `.sede-filter-count` en cada cabecera de sede (`h2.sede-header`) con los resultados filtrados o el conteo total disponible (`X películas, Y funciones`) y reordena las sedes en el DOM.

### `updateDayResultCounts()`
- **Firma**: `updateDayResultCounts(): void` (función interna)
- **Descripción**: Recorre los contenedores `.day-container` y actualiza la insignia `.day-count-badge`. Si hay filtros activos, reporta el número de funciones visibles en esa fecha o marca la insignia con `.sede-filter-count--empty` cuando no hay coincidencias; si no hay filtros, muestra la suma global de películas únicas y funciones para ese día.

### `countSedeMoviesAndShowtimes(movies)`
- **Firma**: `countSedeMoviesAndShowtimes(movies: Array): { movieCount: number, showtimeCount: number }`
- **Descripción**: Calcula el conteo de películas únicas (`filmId` / título) y funciones para una sede dada.

### `setMovieFilter(filterText)`
- **Firma**: `setMovieFilter(filterText: string): string`
- **Descripción**: Convierte el texto a minúsculas, lo asigna a `state.movieFilter` y ejecuta `applyFilters()`.

### `setTimeFilter(start, end)`
- **Firma**: `setTimeFilter(start: string, end: string): { start: string, end: string }`
- **Descripción**: Actualiza `state.timeFilterStart` y `state.timeFilterEnd` y aplica filtros.

### `clearTimeFilter()`
- **Firma**: `clearTimeFilter(): void`
- **Descripción**: Restablece ambos filtros de tiempo a `''` y aplica filtros.

### `hasActiveFilters()`
- **Firma**: `hasActiveFilters(): boolean`
- **Descripción**: Retorna `true` si existe algún filtro activo (texto, tiempo o carrusel).

