# Componente: Tooltip Interactivo de Función (`js/tooltip.js`)

## 📌 Propósito y Resumen
Gestiona el tooltip flotante interactivo (`#tooltip`) que se despliega cuando el usuario hace clic sobre un bloque de función en la cuadrícula. Muestra horarios, sala, duración, tabla de otras funciones del día y botones de acción rápida: Selección de Itinerario, Agregar al Calendario, Abrir Ficha de Información e Ir a Comprar Boletos.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `visited.js` (`markMovieAsVisited`), `filters.js` (`hasActiveFilters`), `selection.js` (`toggleMovieSelection`), `utils.js` (`formatDuration`, `getMovieUniqueId`, `doMoviesOverlap`), `showtimes.js` (`findAllShowtimesForMovie`), `calendar.js` (`generateCalendarLink`), `modal.js` (`showMovieInfoModal`), `inlineInfo.js` (`destroyInlineInfo`, `updatePosterInfoActions`), `movieUtils.js` (`getEnrichedShowtime`, `formatMovieTitle`), `carousel.js` (`selectFilmInCarousel`), `config.js` (`SEDES`), `posterTooltip.js` (`hidePosterTooltip`).
- **Consumido por**: `app.js` (inicialización en arranque), `grid.js`.

---

## ⚙️ API Exportada

### `initTooltip()`
- **Firma**: `initTooltip(): void`
- **Descripción**: Crea el elemento `.tooltip-overlay`, registra listeners de scroll/resize con recálculo por `requestAnimationFrame`, detecta clics fuera para cerrar el tooltip y escucha clics sobre `.movie-block` (incluyendo detección de doble clic para filtrar por carrusel en < 800ms).

### `showInteractiveTooltip(element, movie, horario)`
- **Firma**: `showInteractiveTooltip(element: HTMLElement, movie: Object, horario: string): void`
- **Comportamiento**:
  - Oculta el tooltip de hover de póster.
  - Marca la función como visitada (`markMovieAsVisited`).
  - Obtiene datos enriquecidos (`getEnrichedShowtime`) y consulta otros horarios del día (`findAllShowtimesForMovie`).
  - Construye la botonera:
    - **Seleccionar / Deseleccionar**: Habilitado si no hay filtros activos y no existe conflicto de horario.
    - **Agregar al calendario**: Abre Google Calendar preconfigurado.
    - **Información**: Abre el modal completo de la película.
    - **Ir a comprar**: Enlace directo a taquilla de Cineteca.
  - Calcula la posición en viewport evitando desbordamientos de pantalla.

### `positionTooltip(tooltip, element)`
- **Firma**: `positionTooltip(tooltip: HTMLElement, element: HTMLElement): void`
- **Algoritmo de Posicionamiento**:
  - Calcula el espacio disponible arriba y abajo del bloque respecto a la ventana visible.
  - Posiciona verticalmente en la zona con mayor espacio y centra horizontalmente con clamping para no salirse de los bordes laterales del viewport.

### `closeTooltip()`
- **Firma**: `closeTooltip(): void`
- **Descripción**: Oculta el tooltip interactivo y remueve el overlay de fondo.

### `toggleFromTooltip()`
- **Firma**: `toggleFromTooltip(): void`
- **Descripción**: Alterna la selección de itinerario para la película en contexto actual y cierra el tooltip.
