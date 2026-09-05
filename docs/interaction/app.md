# Módulo: Punto de Entrada (`js/app.js`)

## 📌 Propósito y Resumen
Es el **entry point** principal de la aplicación. Se ejecuta al dispararse el evento `DOMContentLoaded`, inicializa todos los subsistemas, enlaza los controladores de eventos de la interfaz (navegación de fechas, checkboxes de sede, debouncing de búsqueda, botón de compartir y atajos de teclado) y orquesta la sincronización entre el estado y la vista.

---

## 📦 Dependencias e Interacciones
- **Importa**: Todos los módulos principales (`state.js`, `config.js`, `utils.js`, `urlState.js`, `dataLoader.js`, `filters.js`, `selection.js`, `tooltip.js`, `modal.js`, `inlineInfo.js`, `visited.js`, `cache.js`, `filterLock.js`, `carouselFilterChip.js`, `helpModal.js`, `tour.js`, `posterTooltip.js`).
- **Consumido por**: `index.html` mediante `<script type="module" src="js/app.js"></script>`.

---

## ⚙️ Funcionalidades Principales

### 1. Inicialización (`DOMContentLoaded`)
- Carga el historial de funciones visitadas (`initializeVisitedMovies`).
- Inicializa tooltips interactivos y hover de pósters (`initTooltip`, `initPosterTooltip`).
- Prepara modales de información y ayuda (`initModal`, `initHelpModal`).
- Inicializa el chip flotante de filtro (`initCarouselFilterChip`).
- Registra intervalos periódicos:
  - Actualización del selector de fechas cada 1 minuto (`updateDateDisplay`).
  - Purga de caché antigua cada 1 hora (`cleanOldCache`).

### 2. Inicialización de Estado (`initializeState`)
- Revisa si la URL contiene parámetros de búsqueda (`getURLParams`).
- Si no hay parámetros, fija fecha actual, `state.viewMode = 'day'`, carga sedes guardadas en `localStorage` o activa las `DEFAULT_SEDES`.
- Si hay parámetros en la URL, los aplica mediante `loadStateFromURL()`. Si cambió la fecha o el modo (`result.dateChanged || result.viewModeChanged`), limpia la selección previa con `clearSelection()`.
- Sincroniza los controles visuales con el estado (`syncUIWithState`).
- Fija el bloqueo de filtros (`computeInputLock`) y dispara `loadAndRenderMovies()`.

### 3. Registro de Eventos (`setupEventListeners`)
- **Selector de modo de visualización**: Botones `#viewModeDay` y `#viewModeMovies` ejecutan `handleViewModeChange('day')` y `handleViewModeChange('movies')`.
- **Navegación de fechas**: Botones `#prevDay`, `#nextDay` y selector `#datePicker` (con ventana de hoy a +7 días).
- **Selector de sedes**: Checkboxes `#cenart`, `#xoco`, `#chapultepec`.
- **Filtro de búsqueda**: Input `#movieFilter` con debounce de **300 ms**.
- **Filtro de horas**: Inputs `#startTimeFilter`, `#endTimeFilter` y botón `#clearTimeFilter`.
- **Compartir cartelera**: Botón `#shareButton` copia la URL completa al portapapeles con feedback temporal.
- **Navegación de historial**: Listener de `popstate` (`handlePopState`) que recarga el estado desde la URL, limpia selecciones si cambió la fecha o vista y re-renderiza.
- **Atajos de teclado**:
  - `Escape`: Cierra modales, tooltips o limpia la selección de itinerario.

### 4. Control de Vistas (`handleViewModeChange` y `syncUIWithState`)

#### `handleViewModeChange(mode)`
- Si el modo solicitado ya es el activo (`state.viewMode === mode`), descarta la acción.
- Modifica el estado con `setViewMode(mode)`.
- Limpia cualquier selección de funciones previa con `clearSelection()` para evitar conflictos entre vistas.
- Sincroniza la interfaz gráfica invocando `syncUIWithState()`.
- Actualiza los parámetros en la URL mediante `updateStateInURL()`.
- Invoca `loadAndRenderMovies()` para descargar o renderizar los datos correspondientes.

#### Sincronización Visual (`syncUIWithState`)
- **Botones de Modo**: Aplica la clase `.active` al botón correspondiente (`#viewModeMovies` si `viewMode === 'movies'`, `#viewModeDay` en caso contrario).
- **Selector de Fecha (`#dateSelector`)**: Se oculta (`display: none`) cuando `viewMode === 'movies'` (ya que la vista multi-día presenta los 8 días completos en pantalla) y se muestra (`display: flex`) en modo `'day'`.
- **Campos y Checkboxes**: Actualiza el texto de `#currentDate`, valor de `#datePicker`, estado `checked` de los checkboxes de sede y valores de los filtros de texto y horas.

---

## 🌐 Funciones Expuestas en `window`
Para compatibilidad con handlers en línea en el HTML y accesibilidad:
`window.closeTooltip`, `window.showMovieInfoModal`, `window.navigateToPrevMovie`, `window.navigateToNextMovie`, `window.closeMovieInfoModal`, `window.playTrailer`, `window.openHelpModal`, `window.closeHelpModal`, `window.startTour`, `window.stopTour`.
