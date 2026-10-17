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
  4. Evalúa filtro de ciclos mediante `passesCicloFilter(movie)`:
     - Si `state.selectedCiclos === null`: pasa la película (todos los ciclos activos).
     - Si `state.selectedCiclos.size === 0`: se descarta la película (ningún ciclo seleccionado).
     - Si contiene IDs: verifica si al menos uno de los ciclos asociados a la película (`movie.ciclos`) pertenece a `state.selectedCiclos`.
  5. Agrega o remueve la clase `.filtered-out` según corresponda.
  6. Actualiza los contadores textuales en `#filterResults` y `#timeFilterResults`.
  7. Resalta las filas o carriles con funciones visibles: `highlightRoomsWithVisibleMovies()` busca el contenedor padre `.room-row` (en modo día) o `.movies-lane` (en modo multi-día) y aplica la clase `.has-visible-movies`.
  8. Ejecuta `updateSedeResultCounts()`:
     - **En modo multi-día (`state.viewMode === 'week'` o `'movies'`)**: delega en `updateDayResultCounts()`, actualizando la insignia `.day-count-badge` de cada `.day-container` con el total de funciones coincidentes (`"X funciones coincidentes"`) o `"Sin resultados"` (con la clase `.sede-filter-count--empty`). Si no hay filtros activos, restaura el conteo total del día (`"X películas, Y funciones"`).
     - **En modo día (`state.viewMode === 'day'`)**: añade etiquetas con número de funciones encontradas y sus horarios específicos en las cabeceras de sede (`h2.sede-header`), y reordena los contenedores `.sede-container` de mayor a menor número de coincidencias.
  9. Dispara el evento `document.dispatchEvent(new CustomEvent('filters:updated'))`.

### `passesCicloFilter(movie)`
- **Firma**: `passesCicloFilter(movie: Object): boolean`
- **Descripción**: Determina si un objeto de película pasa el filtro de ciclos y festivales configurado en `state.selectedCiclos`.

### `isCicloFilterActive()`
- **Firma**: `isCicloFilterActive(): boolean`
- **Descripción**: Retorna `true` si `state.selectedCiclos` no es `null` (es decir, el usuario ha restringido o seleccionado ciclos específicos).

### `updateSedeResultCounts()`
- **Firma**: `updateSedeResultCounts(): void`
- **Descripción**: Si `state.viewMode === 'week'` o `'movies'`, invoca `updateDayResultCounts()`. En modo día, actualiza los subtítulos `.sede-filter-count` en cada cabecera de sede (`h2.sede-header`) con los resultados filtrados o el conteo total disponible (`X películas, Y funciones`) y reordena las sedes en el DOM.

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
- **Descripción**: Retorna `true` si existe algún filtro activo (texto, tiempo, carrusel o ciclos con `isCicloFilterActive()`).

### `clearAllFilters()`
- **Firma**: `clearAllFilters(): void`
- **Descripción**: Restablece simultáneamente todos los filtros de contenido activos: vacía la búsqueda por texto (`state.movieFilter = ''`), limpia los horarios (`state.timeFilterStart = ''`, `state.timeFilterEnd = ''`), restaura todos los ciclos temáticos (`selectAllCiclos()`), deselecciona la película del carrusel (`state.carouselFilterFilmId = null`) y libera el bloqueo de controles (`setFilterLock(FILTER_LOCKS.NONE)`).
- **Regla Crítica**: **Preserva intacta la selección de sedes** (`state.activeSedes` no se modifica ni se reinicia).
- **Efectos colaterales**: Restablece visualmente el autocompletado y oculta su botón `(x)` (`syncAutocompleteUI()`), reposiciona los selectores del slider de horas en sus límites dinámicos (`resetTimeSlider()`), actualiza la cuadrícula (`applyFilters()`), sincroniza la URL (`updateStateInURL()`) y auto-oculta el botón `#clearAllFilters`.

### `updateClearAllFiltersVisibility()`
- **Firma**: `updateClearAllFiltersVisibility(): void`
- **Descripción**: Conmuta reactivamente la visibilidad del botón global `#clearAllFilters` (`.clear-all-filters-btn`), mostrándolo dinámicamente si `hasActiveFilters()` es verdadero o si hay texto en el input de búsqueda, y ocultándolo cuando no hay filtros de contenido activos.

---

## 🔍 Autocompletado y Borrado Rápido (`js/autocomplete.js`)

Complementa al input `#movieFilter` envuelto en un contenedor relativo `.filter-input-wrapper`:
- **Botón (x) de borrado rápido (`#clearMovieFilterBtn` / `.clear-input-btn`)**:
  - Visible únicamente cuando el input contiene texto (`input.value.length > 0`) y no está bloqueado por el carrusel.
  - Al hacer clic, vacía el input, ejecuta `handleMovieFilterChange('')`, actualiza la URL y devuelve el foco al input.
- **Dropdown flotante (`#movieAutocompleteList` / `.autocomplete-dropdown`)**:
  - Extrae dinámicamente títulos únicos deduplicados desde `state.movieData` (en modo día) o `state.multiDayData` (en modo multi-día/semana).
  - Búsqueda insensible a mayúsculas y diacríticos/acentos con jerarquía de relevancia (prefijo > palabra > subcadena).
  - Resalta la porción coincidente con `<mark class="autocomplete-match">`.
  - Navegación completa por teclado accesible WAI-ARIA (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`, `Tab`).
  - Cierre seguro ante clic fuera (*click outside*) o pérdida de foco (*blur*).

---

## ⏰ Dual Range Slider de Horas (`js/timeSlider.js`)

Implementa un selector de rango horario interactivo mediante dos controles deslizantes `<input type="range">` superpuestos en Vanilla JS puro:
- **Límites Dinámicos Calculados (`floor` y `ceil`)**:
  - En lugar de límites estáticos fijos, los límites mínimo y máximo se calculan dinámicamente con `syncTimeSliderWithShowtimes()` a partir de los horarios de las funciones (`movie.horarios`) en las sedes activas (`state.activeSedes`).
  - **Hora Mínima (Floor)**: Redondeada hacia abajo al inicio de la hora: `Math.floor(minShowtime / 60) * 60`.
  - **Hora Máxima (Ceil)**: Redondeada hacia arriba al término de la hora: `Math.ceil(maxShowtime / 60) * 60`.
  - **Fallback**: Si no hay funciones disponibles, preserva el rango por defecto `10:00` (600 min) - `24:00` (1440 min). Garantiza al menos 1 hora de rango y delimita entre 00:00 y 24:00.
  - **Sincronización Continua**: Se invoca automáticamente desde `renderCurrentView()` en `js/dataLoader.js` ante cambios de fecha, sedes activas o modo de vista.
- **Regeneración de Marcas Horarias (`.time-slider-ticks`)**:
  - `updateTicks(minMinutes, maxMinutes)` genera dinámicamente etiquetas de referencia (`.tick-label`) proporcionales con `left: %` desde el inicio (0%) hasta el fin (100%), calculando pasos óptimos de 1h a 4h según la duración de la cartelera.
- **Indicador Visual en Tiempo Real**: Etiqueta `#timeRangeDisplay` con badge de alto contraste (ej. `"13:40 - 19:20"`) y pista activa con degradado (`#timeSliderTrackHighlight`).
- **Prevención de Cruce y Dynamic Z-Index**: Impide que el extremo inicial supere al final (`min <= max`) y ajusta dinámicamente el `z-index` según la proximidad del cursor para evitar que los thumbs se bloqueen al coincidir en una misma hora. Soporta clics directos sobre la pista para desplazar el thumb más cercano.
- **Botón Limpiar Condicional (`#clearTimeFilter`)**: Oculto por defecto cuando el rango abarca todos los horarios disponibles del día. Se muestra únicamente cuando al menos uno de los extremos difiere de los límites dinámicos calculados. Al pulsarlo, restablece el slider a dichos extremos, limpia los filtros en `state`, actualiza la URL y vuelve a ocultarse.
- **Sincronización Bidireccional y URL**: Sincronizado en tiempo real con `state.timeFilterStart`, `state.timeFilterEnd`, `updateStateInURL()` y con la navegación histórica (`popstate` / parámetros `timeStart` o `start` y `timeEnd` o `end`).
- **Bloqueo Mutuo**: Deshabilitado visual y funcionalmente (`.time-slider--locked`) cuando `FILTER_LOCKS.CAROUSEL` está activo.


