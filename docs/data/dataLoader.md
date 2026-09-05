# Módulo: Orquestador de Carga de Datos (`js/dataLoader.js`)

## 📌 Propósito y Resumen
Orquesta la descarga paralela y renderizado progresivo de las carteleras de cine para todas las sedes activas (`state.activeSedes`). Maneja indicadores de carga, resolución de caché y actualización de persistencia de sedes seleccionadas.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `config.js` (`SEDES`, `SELECTED_SEDES_KEY`), `utils.js` (`formatDateForAPI`, `showError`, `showLoading`), `api.js` (`fetchMoviesForSede`), `grid.js` (`renderSchedule`), `moviesGrid.js` (`renderMoviesSchedule`), `loadingIndicator.js` (`showLoadingIndicator`, `hideLoadingIndicator`), `cache.js`, `apiCache.js` (`clearAPICache`).
- **Consumido por**: `app.js` (`loadAndRenderMovies`, `toggleSedeSelection`).

---

## ⚙️ API Exportada

### `renderCurrentView()`
- **Firma**: `renderCurrentView(): void`
- **Descripción**: Función distribuidora central de renderizado de la cartelera.
- **Flujo de Ejecución**:
  1. Asegura que el carrusel de pósters permanezca visible (`#posterCarousel.style.display = ''`).
  2. Si `state.viewMode === 'movies'`: invoca `renderMoviesSchedule(state.multiDayData)`.
  3. Si `state.viewMode === 'day'`: invoca `renderSchedule(getCurrentMovieData())`.

### `loadAndRenderMovies()`
- **Firma**: `async loadAndRenderMovies(): Promise<void>`
- **Flujo de Ejecución**:
  1. Si `state.viewMode === 'movies'`: delega de inmediato en `loadAndRenderMultiDayMovies()` y finaliza.
  2. Si `state.isLoading` ya está activo, descarta ejecuciones redundantes.
  3. Limpia la caché de detalles multimedia con `clearAPICache()`.
  4. Revisa si alguna sede activa ya tiene datos en caché (`getCachedData`); si es así, realiza un renderizado preliminar inmediato con `renderCurrentView()` para evitar pantallas en blanco.
  5. Para las sedes faltantes, lanza llamadas paralelas asíncronas con `Promise.all(loadSedeData(sedeId))`.
  6. Conforme finaliza cada sede, actualiza la cuadrícula de forma incremental invocando `renderCurrentView()`.

### `loadAndRenderMultiDayMovies()`
- **Firma**: `async loadAndRenderMultiDayMovies(): Promise<void>`
- **Descripción**: Descarga y orquesta en paralelo la cartelera de todas las sedes activas para una ventana continua de **8 días** (hoy y los 7 días siguientes).
- **Flujo de Ejecución**:
  1. Si `state.isLoading` está activo, aborta la ejecución para evitar condiciones de carrera.
  2. Activa `state.isLoading = true` y muestra el indicador `showLoadingIndicator('Cargando programación de todos los días...')`.
  3. Construye un array de 8 objetos `Date` continuos (`today` a `today + 7 días`).
  4. Reinicializa `state.multiDayData = {}`.
  5. **Resolución de Caché Inmediata**: Revisa `cache.js` mediante `getCachedData(dateKey, sedeId)` para cada día y sede activa. Si encuentra datos previos en memoria, los asigna a `state.multiDayData` y renderiza de inmediato con `renderCurrentView()` para dar respuesta instantánea. Si no hay ningún dato previo, muestra el indicador general con `showLoading()`.
  6. **Identificación de Peticiones Pendientes**: Recopila en `fetchTasks` todas las combinaciones `{ date, dateKey, sedeId }` no presentes en caché (`!hasCachedData(dateKey, sedeId)`).
  7. **Descarga Concurrente Resiliente**:
     - Si hay tareas pendientes, registra las sedes en `state.loadingSedes` y ejecuta `Promise.allSettled(fetchTasks.map(...))`.
     - Cada petición descarga los datos con `fetchMoviesForSede(task.sedeId, task.date)`, almacena el resultado en `cache.js` con `setCachedData()` e indexa en `state.multiDayData[dateKey][sedeId]`.
     - El uso de `allSettled` previene que un fallo de red en un día o sede aislada interrumpa la carga del resto de los días.
  8. En el bloque `finally`: limpia `state.loadingSedes`, oculta el badge con `hideLoadingIndicator()`, restablece `state.isLoading = false` y efectúa el renderizado consolidado final con `renderCurrentView()`.

### `toggleSedeSelection(sedeId, isChecked)`
- **Firma**: `async toggleSedeSelection(sedeId: string, isChecked: boolean): Promise<void>`
- **Flujo de Ejecución**:
  1. Si `isChecked` es `true`: añade la sede a `state.activeSedes`.
  2. Si `isChecked` es `false`: elimina la sede de `state.activeSedes`.
  3. Guarda la selección actual de sedes en `localStorage` bajo `SELECTED_SEDES_KEY`.
  4. **Bifurcación por modo**:
     - Si `state.viewMode === 'movies'`: ejecuta `await loadAndRenderMultiDayMovies()` para refrescar la ventana de 8 días.
     - Si `state.viewMode === 'day'`: si la sede se activó y no está en caché/memoria, invoca `loadSedeData(sedeId)`; si ya estaba disponible o se desactivó, refresca la vista con `renderCurrentView()`.

---

## 🔄 Manejo de Estados de Carga (`updateLoadingState`)
- **Modo Día (`day`)**:
  - Si hay sedes descargándose y ya hay datos previos en pantalla, invoca `renderCurrentView()` y muestra el badge flotante (`showLoadingIndicator("Cargando datos de: ...")`).
  - Si la cuadrícula está completamente vacía, muestra el mensaje principal de carga en `#scheduleContainer`.
  - Al concluir todas las descargas, oculta el badge; si ninguna sede tiene funciones disponibles, muestra un mensaje de aviso amigable.
- **Modo Películas (`movies`)**:
  - Muestra el badge flotante `showLoadingIndicator("Cargando cartelera completa de: ...")` mientras haya sedes pendientes de resolución.
  - Al finalizar, oculta el badge mediante `hideLoadingIndicator()`.
