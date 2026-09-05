# Componente: Cuadrícula Multi-Día de Películas (`js/moviesGrid.js`)

## 📌 Propósito y Resumen
Es el componente de visualización para el modo **"Ver películas"** (Multi-día). Presenta la cartelera completa a lo largo de una ventana de **8 días** (fecha actual y los 7 días posteriores) para las sedes seleccionadas.

A diferencia del modo tradicional por día ([`grid.js`](grid.md)), que organiza las funciones en filas por sala de cada sede para una fecha específica, este componente:
1. Agrupa la cartelera en bloques cronológicos por día (`.day-container`).
2. Organiza las funciones del día en **carriles estructurados por sede y sala** (`.movies-lane`), con etiquetas identificadoras en el lateral y una línea divisoria sutil (`.sede-divider`) entre bloques de sedes.
3. Utiliza **bloques de película compactos** (`.movie-block--compact`) con altura reducida al 40% (16px) y estilo condensado, maximizando la densidad de información sin generar solapamientos visuales.

---

## 📦 Dependencias e Interacciones
- **Importa**:
  - [`state.js`](../state/state.md): `state`, `setStartEndHours`.
  - [`config.js`](../state/config.md): `SEDES`, `HOUR_WIDTH`.
  - [`utils.js`](../interaction/utils.md): `minutesToPosition`.
  - [`filters.js`](../interaction/filters.md): `applyFilters`, `hasActiveFilters`, `countSedeMoviesAndShowtimes`, `formatMovieAndShowtimeCounts`.
  - [`visited.js`](../state/visited.md): `isMovieVisited`.
  - [`movieUtils.js`](../data/movieUtils.md): `getEnrichedShowtime`.
  - [`carousel.js`](carousel.md): `renderPosterCarousel`, `selectFilmInCarousel`.
  - [`tooltip.js`](tooltip.md): `closeTooltip`.
- **Consumido por**: [`dataLoader.js`](../data/dataLoader.md) a través de la función de renderizado condicional `renderCurrentView()`.

---

## 🏛️ Organización de Carriles por Sede y Sala

Cada día organiza sus funciones de manera ordenada y estructurada dividida por complejo y sala:

1. **Orden de Sedes**: Respeta el orden natural de sedes activas en `state.activeSedes`.
2. **Ordenación de Salas (`sortSalas`)**: Dentro de cada sede, las salas numéricas se ordenan de forma ascendente (Sala 1, Sala 2, Sala 10), ubicando foros al aire libre y salas especiales al final.
3. **Etiqueta Lateral (`formatLaneLabel`)**: Cada carril (`.movies-lane`) representa una sala individual con su identificador en `.lane-label` fijado a la izquierda (ej. `SALA 1 XOCO`, `SALA 2 CNA`, `FORO AL AIRE LIBRE`), sincronizado a un ancho de 100px.
4. **Divisor entre Sedes (`.sede-divider`)**: Entre sedes distintas dentro de una misma fecha se renderiza una línea horizontal ligeramente más gruesa que las líneas normales de carril pero de estilo sutil (`border-top: 2px solid #cbd5e1`), delimitando claramente cada recinto.

---

## ⏱️ Eje Temporal y Escala Unificada

A fin de que todos los días compartan una cuadrícula horizontal perfectamente alineada:
- **`calculateGlobalTimeRange(multiDayData)`**: Itera sobre todas las funciones de todas las fechas y sedes cargadas para determinar la hora mínima (`minMinutes`) y máxima (`maxMinutes`).
- **Límites globales**: Establece `startHour = Math.floor(minMinutes / 60)` y `endHour = Math.ceil(maxMinutes / 60)`. Si no hay funciones, utiliza el rango predeterminado `12:00` a `23:00`.
- **Sincronización de estado**: Invoca `setStartEndHours(startHour, endHour)` en [`state.js`](../state/state.md).
- **Marcadores de tiempo (`renderTimeAxis`)**:
  - Dibuja etiquetas horarias (`.time-label`) con intervalo de 1 hora (o 2 horas si el rango excede las 12 horas).
  - Genera líneas de cuadrícula verticales cada 30 minutos (`.time-grid-line.half-hour`) y cada hora (`.time-grid-line.hour`).

---

## ⚙️ Funciones Exportadas e Internas

### Funciones Exportadas

#### `renderMoviesSchedule(multiDayData)`
- **Firma**: `renderMoviesSchedule(multiDayData: Object): void`
- **Flujo de Ejecución**:
  1. Extrae y unifica en `combinedMoviesBySede` todas las películas de las sedes activas a través de los 8 días para alimentar el carrusel de pósters superior con `renderPosterCarousel(combinedMoviesBySede)`.
  2. Filtra los días que contienen funciones para sedes activas (`daysWithMovies`).
  3. Si no hay películas para mostrar, presenta un mensaje de estado amigable en `#scheduleContainer`.
  4. Calcula el rango horario global con `calculateGlobalTimeRange()` y fija las horas en `state.js`.
  5. Genera la estructura HTML iterando por cada fecha disponible, ordenando carriles por sede y sala con `sortSalas()` y `formatLaneLabel()`, e insertando `.sede-divider` entre sedes.
  6. Inserta el marcado en `#scheduleContainer` y configura listeners de interacción mediante `setupCompactBlockInteractions()`.
  7. Si existen filtros activos en el estado (`hasActiveFilters()`), ejecuta `applyFilters()`.

#### `formatDayHeaderDate(dateKey)`
- **Firma**: `formatDayHeaderDate(dateKey: string): string`
- **Descripción**: Convierte una clave de fecha `YYYY-MM-DD` en un encabezado textual en español.
- **Ejemplo**: `'2026-09-01'` $\rightarrow$ `'Martes, 1 de septiembre de 2026'`.

#### `calculateGlobalTimeRange(multiDayData)`
- **Firma**: `calculateGlobalTimeRange(multiDayData: Object): { startHour: number, endHour: number }`
- **Descripción**: Determina el intervalo horario mínimo y máximo que abarca todas las funciones programadas en el conjunto de datos multi-día.

#### `sortSalas(salaKeys)`
- **Firma**: `sortSalas(salaKeys: Array<string>): Array<string>`
- **Descripción**: Ordena las claves de salas de una sede: salas numéricas primero en orden ascendente y foros/especiales al final.

#### `formatLaneLabel(sala, sede)`
- **Firma**: `formatLaneLabel(sala: string, sede: Object): string`
- **Descripción**: Formatea la etiqueta de sala para el lateral del carril incluyendo el código de sede (ej. `'SALA 1 XOCO'`) o respetando nombres especiales (ej. `'FORO AL AIRE LIBRE'`).

#### `packMoviesIntoLanes(showtimesList)`
- **Firma**: `packMoviesIntoLanes(showtimesList: Array<Object>): Array<{ lastEndMinutes: number, items: Array<Object> }>`
- **Descripción**: Algoritmo de empaquetado voraz histórico mantenido para compatibilidad.

### Funciones Internas

#### `renderTimeAxis(startHour, endHour)`
- **Firma**: `renderTimeAxis(startHour: number, endHour: number): string`
- **Descripción**: Genera el marcado HTML para el eje horizontal de horas (`.time-axis`) y las líneas divisorias de cuadrícula (`.time-grid-lines`).

#### `renderCompactMovieBlock(item, startHour)`
- **Firma**: `renderCompactMovieBlock(item: Object, startHour: number): string`
- **Descripción**: Genera el HTML de un bloque compacto de función (`.movie-block--compact`).
- **Inyección de fecha**: Asegura que el objeto `movie` serializado en el atributo `data-movie` y en `data-date` contenga la fecha específica del bloque (`dateKey`), lo que garantiza que los tooltips, la navegación de fichas y la exportación al calendario apunten a la fecha correcta.
- **Clases dinámicas**: Asigna la clase de sede (`.cenart`, `.xoco`, `.chapultepec`), `.selected` si la función está en el itinerario y `.visited` si ya fue consultada.

#### `setupCompactBlockInteractions()`
- **Firma**: `setupCompactBlockInteractions(): void`
- **Descripción**: Vincula el evento `dblclick` a cada `.movie-block--compact`. Al hacer doble clic, cierra cualquier tooltip abierto e invoca `selectFilmInCarousel(movie.filmId, movie.displayTitle)` para aislar la película en el carrusel y filtrar la vista.

---

## 🏗️ Estructura del DOM Generado

```html
<div class="schedule-wrapper">
    <div class="schedule-grid movies-view-grid">
        <!-- Contenedor por día -->
        <div class="day-container" data-date="2026-09-01">
            <div class="day-header-wrapper">
                <h2 class="day-header">Martes, 1 de septiembre de 2026</h2>
                <span class="day-count-badge">12 películas, 18 funciones</span>
            </div>
            <div class="day-block">
                <!-- Eje y líneas de tiempo -->
                <div class="time-axis" style="width: 1320px;">...</div>
                <div class="time-grid-lines" style="width: 1320px;">...</div>

                <!-- Contenedor de carriles -->
                <div class="lanes-container">
                    <div class="movies-lane cenart" data-lane-index="0" data-sede-id="002" data-sala="1">
                        <div class="lane-label" title="SALA 1 CNA">SALA 1 CNA</div>
                        <div class="lane-timeline">
                            <div class="movie-block movie-block--compact cenart"
                                 style="left: 120px; width: 180px;"
                                 data-movie="{...}"
                                 data-horario="14:00"
                                 data-date="2026-09-01"
                                 title="...">
                                <div class="movie-title">
                                    <span class="movie-name">Título de la Película</span>
                                    <span class="movie-time">14:00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Línea divisoria sutil entre sedes -->
                    <div class="sede-divider" data-sede-id="003"></div>
                    <div class="movies-lane xoco" data-lane-index="1" data-sede-id="003" data-sala="1">
                        <div class="lane-label" title="SALA 1 XOCO">SALA 1 XOCO</div>
                        <div class="lane-timeline">
                            <!-- Funciones de Sala 1 Xoco -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Contenedores de días posteriores -->
    </div>
</div>
```

---

## 🎨 Hoja de Estilos (`css/moviesGrid.css`)

El archivo `css/moviesGrid.css` implementa las reglas visuales exclusivas de la vista multi-día:

| Selector | Propósito / Comportamiento |
|---|---|
| `.view-switch` | Contenedor segmentado estilo *pill* en la cabecera superior para alternar entre "Ver por día" y "Ver películas". |
| `.view-switch-btn` | Botón individual del interruptor. La variante `.active` adquiere fondo blanco, texto oscuro y sombra sutil. |
| `.movies-view-grid` | Disposición en columna con espaciado vertical (`gap: 25px`) entre días consecutivos. |
| `.day-container` | Tarjeta del día. Incluye un separador horizontal `::before` entre días consecutivos. |
| `.day-header-wrapper` | Cabecera del día con barra lateral de acento azul (`border-left: 4px solid #3b82f6`) y disposición alineada de título y badge de conteo. |
| `.day-count-badge` | Etiqueta con conteo de películas y funciones disponibles o resultados filtrados. |
| `.movies-lane` | Carril horizontal de altura reducida a 22px con borde inferior sutil y hover suave. |
| `.lane-label` | Identificador de sala (ej. `SALA 1 XOCO`) fijado horizontalmente con `position: sticky; left: 0; z-index: 30; width: 100px`. |
| `.sede-divider` | Línea horizontal divisoria sutil (`2px solid #cbd5e1`) entre bloques de distintas sedes en un mismo día. |
| `.movie-block--compact` | Bloque de película de 16px de altura (40% respecto a los 40px estándar), tipografía a 10px y borde de sede de 3px. |
| `@media (pointer: coarse)` | Extiende el área virtual de toque del bloque en dispositivos táctiles (`top: -6px`, `bottom: -6px`) mediante un pseudo-elemento `::after`. |
| `@media (max-width: 768px)` | Ajustes responsivos: el interruptor ocupa el ancho completo y los encabezados de día se adaptan en columna. |

---

## 🔄 Interacción con Otros Subsistemas

### 1. Carrusel de Pósters ([`carousel.js`](carousel.md))
Al generarse la vista multi-día, se extraen todas las películas programadas para los 8 días y se agrupan en `combinedMoviesBySede`. Esto permite que el carrusel muestre pósters representativos de toda la semana y no únicamente del día en curso. El doble clic en un bloque compacto selecciona la película en el carrusel y aplica el filtrado exclusivo (`state.carouselFilterFilmId`).

### 2. Tooltips e Itinerario ([`tooltip.js`](tooltip.md) y [`selection.js`](../interaction/selection.md))
- Al hacer clic en un `.movie-block--compact`, el tooltip interactivo consulta otros horarios de esa película en ese día exacto mediante `findAllShowtimesForMovie(..., movieDateKey)`.
- La exportación a calendario genera el evento con la fecha específica del bloque (`movie.date` o `block.dataset.date`).
- Al seleccionar una función para el itinerario, la detección de solapamientos (`doMoviesOverlap`) compara tanto el rango en minutos como la fecha de la función, asegurando que funciones en días distintos a la misma hora no se marquen erróneamente como traslapes.

### 3. Filtros y Resaltado ([`filters.js`](../interaction/filters.md))
- Los filtros de búsqueda por texto y rango de horarios se aplican de manera uniforme sobre los bloques compactos (`.movie-block--compact`).
- La función `highlightRoomsWithVisibleMovies()` detecta y resalta carriles activos añadiendo `.movies-lane.has-visible-movies`.
- `updateDayResultCounts()` actualiza dinámicamente cada `.day-count-badge` indicando cuántas funciones coinciden con los filtros aplicados en cada fecha.
