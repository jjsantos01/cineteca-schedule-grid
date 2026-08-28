# Módulo: Selección e Itinerario (`js/selection.js`)

## 📌 Propósito y Resumen
Permite al usuario seleccionar múltiples funciones para **armar su itinerario del día**. Detecta automáticamente **traslapes de horario (conflictos)** entre películas seleccionadas y otras funciones de la cartelera, atenuando en tiempo real las funciones incompatibles y mostrando un panel resumen con la lista de funciones elegidas.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js` (`resetSelectionState`), `utils.js` (`doMoviesOverlap`), `filters.js` (`hasActiveFilters`), `urlState.js` (`updateStateInURL`), `movieUtils.js` (`getEnrichedShowtime`).
- **Consumido por**: `app.js` (`clearSelection`), `tooltip.js` (`toggleMovieSelection`), `tour.js`.

---

## ⚙️ API Exportada

### `toggleMovieSelection(movieData, horario)`
- **Firma**: `toggleMovieSelection(movieData: Object, horario: string): { changed: boolean, selected: boolean }`
- **Reglas de Negocio**:
  1. Si hay filtros activos (`hasActiveFilters() === true`), no se permite seleccionar y retorna `{ changed: false, selected: false }`.
  2. Si la función ya estaba seleccionada, la remueve de `state.selectedMovies`.
  3. Si es una función nueva: verifica con `doMoviesOverlap` si se empalma con alguna película ya seleccionada. Si hay traslape, **rechaza la selección**; si no hay traslape, la añade a `state.selectedMovies`.
  4. Actualiza la UI de selección, los bloques en el grid y la URL.

### `updateMovieBlocksVisuals()`
- **Firma**: `updateMovieBlocksVisuals(): void`
- **Descripción**: Recorre los bloques `.movie-block`. Asigna la clase `.selected` a las funciones elegidas. Si hay al menos una película seleccionada (y ningún filtro de búsqueda activo), asigna la clase `.filtered-out` a cualquier otra función de la cartelera que se traslape con las seleccionadas.

### `updateSelectionDisplay()`
- **Firma**: `updateSelectionDisplay(): void`
- **Descripción**: Muestra u oculta el banner `#selectionInfo` en la parte superior de la cuadrícula con el resumen de títulos elegidos y el botón "Borrar selección".

### `clearSelection()`
- **Firma**: `clearSelection(): void`
- **Descripción**: Vacía `state.selectedMovies`, elimina el banner de itinerario y restablece la visibilidad de todos los bloques en el grid.
