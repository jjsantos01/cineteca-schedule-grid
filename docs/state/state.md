# Módulo: Estado Global (`js/state.js`)

## 📌 Propósito y Resumen
Es la **única fuente de la verdad** (`single source of truth`) de la aplicación. Centraliza todas las variables reactivas del sistema: fecha actual, sedes seleccionadas, películas cargadas, filtros, selección de itinerario, contexto de tooltips y estado de navegación.

---

## 📦 Dependencias e Interacciones
- **Importado por**: Prácticamente todos los módulos de la aplicación (`app.js`, `dataLoader.js`, `grid.js`, `filters.js`, `selection.js`, `carousel.js`, `modal.js`, `tooltip.js`, etc.).
- **Dependencias externas**: Ninguna (módulo base).

---

## 🗄️ Esquema del Objeto `state`

```javascript
const state = {
    currentDate: Date,               // Fecha actualmente seleccionada
    activeSedes: Set<string>,        // IDs de sedes activas (e.g. Set(['003', '002']))
    movieData: Object,               // Carteleras cargadas por sede { [sedeId]: Array<Movie> }
    cachedData: Object,              // Caché de carteleras { [dateKey]: { [sedeId]: { data, date } } }
    isLoading: boolean,              // Estado global de carga
    loadingSedes: Set<string>,       // Sedes que se están descargando actualmente
    movieFilter: string,             // Texto de búsqueda en minúsculas
    timeFilterStart: string,         // Hora inicial de filtro 'HH:MM'
    timeFilterEnd: string,           // Hora final de filtro 'HH:MM'
    isInitializing: boolean,         // Flag para silenciar sincronización durante el boot
    selectedMovies: Array<Object>,   // Lista de funciones seleccionadas en el itinerario
    carouselFilterFilmId: string|null, // ID de película filtrada desde el carrusel
    filterLock: string|null,         // 'carousel' | 'inputs' | null
    currentTooltipMovie: Object|null,// Película en foco del tooltip interactivo
    currentTooltipHorario: string|null, // Horario en foco del tooltip interactivo
    tooltipOverlay: HTMLElement|null,// Elemento backdrop del tooltip
    currentMovieIndex: number,       // Índice para navegación secuencial en modal
    allMoviesForNavigation: Array,   // Lista ordenada de películas para modal prev/next
    isNavigating: boolean,           // Flag de transición activa en modal
    inlineSelectionChange: boolean,  // Flag para evitar bucles al navegar desde el panel inline
    startHour: number,               // Hora mínima del eje temporal en el grid (ej. 12)
    endHour: number                  // Hora máxima del eje temporal en el grid (ej. 23)
};
```

---

## ⚙️ API Exportada y Funciones de Mutación

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `default state` | — | `Object` | Objeto `state` singleton. |
| `setCurrentDate(date)` | `date: Date` | `void` | Actualiza la fecha actual. |
| `getCurrentMovieData()` | — | `Object` | Retorna un objeto `{ [sedeId]: Array<Movie> }` solo con las sedes activas en `activeSedes`. |
| `setStartEndHours(startHour, endHour)` | `startHour: number, endHour: number` | `void` | Configura los límites en horas del timeline del grid. |
| `resetSelectionState()` | — | `void` | Vacía el arreglo de películas seleccionadas en el itinerario. |
| `setTooltipOverlay(overlay)` | `overlay: HTMLElement` | `void` | Guarda la referencia al overlay de fondo del tooltip. |
| `setTooltipContext(movie, horario)` | `movie: Object, horario: string` | `void` | Registra la función sobre la que está abierto el tooltip. |
| `resetTooltipContext()` | — | `void` | Limpia el contexto del tooltip activo. |
| `setNavigationData(movies, index)` | `movies: Array, index: number` | `void` | Configura el arreglo y posición para la navegación entre fichas de películas. |
| `setNavigating(isNavigating)` | `isNavigating: boolean` | `void` | Bloquea o desbloquea acciones durante transiciones del modal. |
| `setLoading(isLoading)` | `isLoading: boolean` | `void` | Modifica el indicador general de carga. |

---

## ⚠️ Invariantes y Reglas Críticas
1. **No clonar ni recrear**: Nunca crees copias locales desacopladas de `state`. Si necesitas datos derivados, impórtalo directamente o usa `getCurrentMovieData()`.
2. **`isInitializing`**: Se activa durante el arranque inicial o cambios por `popstate` para prevenir que `urlState.js` sobreescriba parámetros antes de que la UI termine de sincronizarse.
3. **`activeSedes`**: Es un `Set` nativo de JavaScript para permitir operaciones eficientes (`has`, `add`, `delete`).
