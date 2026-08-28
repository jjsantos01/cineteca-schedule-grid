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
  1. Itera sobre cada `.movie-block` en el DOM.
  2. Evalúa coincidencia de título (`displayTitle` o `titulo` contra `state.movieFilter` o `state.carouselFilterFilmId`).
  3. Evalúa ventana horaria (`enriched.startMinutes >= filterStartMinutes && <= filterEndMinutes`).
  4. Agrega o remueve la clase `.filtered-out` según corresponda.
  5. Actualiza los contadores textuales en `#filterResults` y `#timeFilterResults`.
  6. Resalta las salas con funciones visibles (`.room-row.has-visible-movies`).
  7. Ejecuta `updateSedeResultCounts()`: añade etiquetas con número de funciones encontradas y sus horarios específicos en las cabeceras de sede, y reordena los contenedores `.sede-container` de mayor a menor número de coincidencias.
  8. Dispara el evento `document.dispatchEvent(new CustomEvent('filters:updated'))`.

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
