# Módulo: Sincronización con URL (`js/urlState.js`)

## 📌 Propósito y Resumen
Gestiona la **sincronización bidireccional** entre los parámetros de búsqueda de la URL (`window.location.search`) y el estado central de la aplicación (`state.js`). Permite compartir carteleras configuradas (fecha, sedes activas, filtros de texto y horarios) y soporta la navegación del historial del navegador (`back`/`forward`).

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js` (`setCurrentDate`, `getMaxSelectableDate`), `config.js` (`DEFAULT_SEDES`), `utils.js` (`formatDateForAPI`, `getURLParams`, `updateURLParams`, `isSameDate`).
- **Consumido por**: `app.js` (en arranque y eventos `popstate`), `selection.js`, `filters.js`, `dataLoader.js`.

---

## 🔗 Estructura de Parámetros URL

| Parámetro | Tipo / Formato | Ejemplo | Descripción |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | `date=2026-08-28` | Fecha consultada (validada: entre hoy y la fecha máxima disponible `getMaxSelectableDate()`). |
| `sedes` | CSV de IDs de sede | `sedes=003,002` | Sedes activas (solo acepta `001`, `002`, `003`). |
| `filter` | String URL-encoded | `filter=godard` | Búsqueda por título. |
| `timeStart`| `HH:MM` | `timeStart=16:00` | Hora mínima de inicio de funciones. |
| `timeEnd`  | `HH:MM` | `timeEnd=21:30` | Hora máxima de inicio de funciones. |
| `view`     | `string` ('week', 'movies' o null) | `view=week` | Modo de visualización activo ('week' para cartelera semanal multi-día; retrocompatible con 'movies'; se omite si es 'day'). |
| `ciclos`   | ID de ciclo | `ciclos=0000000260` | Ciclo elegido (selección única). Se omite si no hay selección. |
| `ciclosMode` | `exclude` | `ciclos=0000000260&ciclosMode=exclude` | Solo se serializa cuando el modo es `exclude` y hay un ciclo elegido; su ausencia equivale a `include`. |

---

## ⚙️ API Exportada

### `updateStateInURL()` (alias: `updateURL()`)
- **Firma**: `updateStateInURL(): void`
- **Descripción**: Lee el estado actual (`state.currentDate`, `state.activeSedes`, `state.movieFilter`, `state.timeFilterStart`, `state.timeFilterEnd`, `state.viewMode`, `state.selectedCiclos`) y actualiza la URL mediante `window.history.replaceState` (a través de `utils.js:updateURLParams`).
- **Sincronización de ciclos**: Si `state.selectedCiclos === null` (sin selección), elimina los parámetros `ciclos` y `ciclosMode`. Si hay un ciclo elegido, serializa su ID en `ciclos` y, solo cuando `state.ciclosMode === 'exclude'`, agrega `ciclosMode=exclude`.
- **Sincronización de vista**: Si `state.viewMode === 'week'` (o `'movies'`), serializa `view: 'week'`; de lo contrario, envía `view: null` para mantener la URL limpia en el modo predeterminado de un solo día.
- **Comportamiento especial**: Si `state.isInitializing === true`, la función aborta inmediatamente para evitar sobreescrituras accidentales durante el boot.

### `loadStateFromURL()` (alias: `restoreStateFromURL()`)
- **Firma**: `loadStateFromURL(): { dateChanged: boolean, sedesChanged: boolean, movieFilterChanged: boolean, timeFilterChanged: boolean, viewModeChanged: boolean, ciclosChanged: boolean }`
- **Descripción**: Lee los parámetros de la URL actual, valida los valores y actualiza las propiedades correspondientes en `state.js`.
- **Detección de ciclos (`ciclos`, `ciclosMode`)**: Toma solo el primer ID de `params.ciclos` (selección única) y lo asigna a `state.selectedCiclos`; si el parámetro no está presente, restablece `state.selectedCiclos = null`. `state.ciclosMode` es `'exclude'` únicamente si `params.ciclosMode === 'exclude'` y hay un ciclo; en cualquier otro caso es `'include'`. `ciclosChanged` es `true` si cambió la selección o el modo.
- **Detección de modo (`viewMode`)**: Examina `params.view`. Si es `'week'` o `'movies'` y el modo actual difiere, conmuta a `'week'` y marca `result.viewModeChanged = true`. Si el parámetro no está presente pero el estado estaba en `'week'` (o `'movies'`), conmuta a `'day'` y también marca `result.viewModeChanged = true`.
- **Retorno**: Objeto indicador de qué valores cambiaron con respecto al estado previo (clave para decidir si se debe limpiar la selección de itinerario).

---

## ⚠️ Reglas y Casos Borde
1. **Validación de fechas**: Solo se aceptan fechas en la ventana válida (desde el día de hoy hasta la fecha máxima disponible `getMaxSelectableDate()`, que usa la última fecha cargada en `state.availableDates` o una ventana de +14 días antes de que cargue el feed). Si la fecha está fuera del rango, se descarta y se mantiene la fecha actual.
2. **Validación de sedes**: Cualquier valor distinto de `001` (CNCH), `002` (CNA) o `003` (XOCO) es filtrado y descartado. Si no hay sedes válidas en la URL, se utilizan las `DEFAULT_SEDES`.
3. **Preservación de sedes al rehidratar ciclos**: Al rehidratar un ciclo específico mediante URL (ej. `?ciclos=0000000260`), si dicho ciclo sólo se proyecta en una sede no activa por defecto (como Chapultepec `001`), el componente `ciclosFilter.js` asegura que dicha sede sea activada automáticamente en `state.activeSedes` para evitar carteleras vacías.
4. **Limpieza de selección**: Si `dateChanged` o `viewModeChanged` son verdaderos, `app.js` limpia automáticamente cualquier selección de itinerario previa (`clearSelection()`) para evitar conflictos entre fechas distintas o transiciones de vista.
