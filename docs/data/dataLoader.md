# Módulo: Orquestador de Carga de Datos (`js/dataLoader.js`)

## 📌 Propósito y Resumen
Orquesta la descarga paralela y renderizado progresivo de las carteleras de cine para todas las sedes activas (`state.activeSedes`). Maneja indicadores de carga, resolución de caché y actualización de persistencia de sedes seleccionadas.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `config.js` (`SEDES`, `SELECTED_SEDES_KEY`), `utils.js` (`formatDateForAPI`, `showError`, `showLoading`), `api.js` (`fetchMoviesForSede`), `grid.js` (`renderSchedule`), `loadingIndicator.js` (`showLoadingIndicator`, `hideLoadingIndicator`), `cache.js`, `apiCache.js` (`clearAPICache`).
- **Consumido por**: `app.js` (`loadAndRenderMovies`, `toggleSedeSelection`).

---

## ⚙️ API Exportada

### `loadAndRenderMovies()`
- **Firma**: `async loadAndRenderMovies(): Promise<void>`
- **Flujo de Ejecución**:
  1. Si `state.isLoading` ya está activo, descarta ejecuciones redundantes.
  2. Limpia la caché de detalles multimedia con `clearAPICache()`.
  3. Revisa si alguna sede activa ya tiene datos en caché (`getCachedData`); si es así, realiza un renderizado preliminar inmediato para evitar pantallas en blanco.
  4. Para las sedes faltantes, lanza llamadas paralelas asíncronas con `Promise.all(loadSedeData(sedeId))`.
  5. Conforme finaliza cada sede, actualiza la cuadrícula de forma incremental.

### `toggleSedeSelection(sedeId, isChecked)`
- **Firma**: `async toggleSedeSelection(sedeId: string, isChecked: boolean): Promise<void>`
- **Flujo de Ejecución**:
  1. Si `isChecked` es `true`: añade la sede a `state.activeSedes`. Si sus datos no están en memoria, los descarga asíncronamente; si ya existen, re-renderiza la cuadrícula.
  2. Si `isChecked` es `false`: elimina la sede de `state.activeSedes` y re-renderiza la cuadrícula de inmediato.
  3. Guarda la selección actual de sedes en `localStorage` bajo `SELECTED_SEDES_KEY`.

---

## 🔄 Manejo de Estados de Carga (`updateLoadingState`)
- Si hay sedes descargándose y ya hay datos previos en pantalla, muestra un badge flotante no intrusivo (`showLoadingIndicator("Cargando datos de: ...")`).
- Si la cuadrícula está completamente vacía, muestra el mensaje principal de carga en `#scheduleContainer`.
- Cuando concluyen todas las descargas, oculta el badge; si ninguna sede tiene funciones disponibles, muestra un mensaje amigable al usuario.
