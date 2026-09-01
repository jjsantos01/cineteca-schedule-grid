# Componente: Cuadrícula de Horarios (`js/grid.js`)

## 📌 Propósito y Resumen
Es el componente central de visualización de la cartelera. Renderiza la matriz visual de tiempo continuo (timeline) dividida por sedes y salas, calculando la posición horizontal (`left`) y ancho (`width`) de cada bloque de función en proporción a su duración real.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `carousel.js` (`renderPosterCarousel`, `selectFilmInCarousel`), `tooltip.js` (`closeTooltip`), `config.js` (`SEDES`, `HOUR_WIDTH`), `utils.js` (`calculateTimeRange`, `minutesToPosition`, `getMovieUniqueId`), `filters.js` (`applyFilters`, `hasActiveFilters`), `visited.js` (`isMovieVisited`), `movieUtils.js` (`getEnrichedShowtime`).
- **Consumido por**: `dataLoader.js` (llamada principal `renderSchedule`).

---

## 📐 Matemáticas del Grid y Timeline

- **Escala de tiempo**: `1 hora = HOUR_WIDTH (120px)`.
- **Posicionamiento**:
  $$\text{Posición X (left)} = \frac{\text{startMinutes} - (\text{startHour} \times 60)}{60} \times 120$$
- **Ancho del bloque (width)**:
  $$\text{Ancho (width)} = \frac{\text{duracion}}{60} \times 120$$
- **Límites dinámicos**: `calculateTimeRange` examina todas las películas activas para definir `startHour` y `endHour` en `state.js`, dibujando marcadores cada 30 minutos (líneas punteadas) y cada hora (líneas continuas).

---

## ⚙️ API Exportada

### `renderSchedule(movieData)`
- **Firma**: `renderSchedule(movieData: Object): void`
- **Flujo de Renderizado**:
  1. Invoca `renderPosterCarousel(movieData)` para actualizar el carrusel de pósters superior.
  2. Si no hay películas cargadas, inserta el mensaje de estado correspondiente en `#scheduleContainer`.
  3. Calcula y fija el rango de horas (`startHour`, `endHour`).
  4. Agrupa películas por sede y sala (`groupMoviesBySede`).
  5. Ordena las salas numéricamente (ubicando foros al aire libre al final).
  6. Genera el DOM con la estructura `.sede-container > .sede-block > (.time-axis + .rooms-container)`.
  7. Cada bloque de película (`.movie-block`) renderiza el título (`.movie-name`) y horario (`.movie-time`) con diseño de tarjeta ligera y acento lateral de sede.
  8. Registra listeners de doble clic en bloques para filtrar directamente la película en el carrusel (`setupMovieBlockInteractions`).
  9. Si hay filtros activos en el estado, aplica `applyFilters()`; de lo contrario, ejecuta `updateSedeResultCounts()` para mostrar los conteos disponibles por sede.

---

## 🎨 Clases CSS Aplicadas a los Bloques (`.movie-block`)
- `.chapultepec`, `.cenart`, `.xoco`: Colores temáticos por sede (fondo ligero con tinte, borde suave y borde izquierdo sólido de 4px).
- `.selected`: Función añadida al itinerario del usuario (resalte dorado/ámbar).
- `.visited`: Función abierta o inspeccionada previamente.
- `.filtered-out`: Bloque atenuado/oculto cuando no coincide con filtros o entra en traslape temporal.
