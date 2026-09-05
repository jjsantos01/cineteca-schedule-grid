# Módulo: Sincronización con URL (`js/urlState.js`)

## 📌 Propósito y Resumen
Gestiona la **sincronización bidireccional** entre los parámetros de búsqueda de la URL (`window.location.search`) y el estado central de la aplicación (`state.js`). Permite compartir carteleras configuradas (fecha, sedes activas, filtros de texto y horarios) y soporta la navegación del historial del navegador (`back`/`forward`).

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js` (`setCurrentDate`), `config.js` (`DEFAULT_SEDES`), `utils.js` (`formatDateForAPI`, `getURLParams`, `updateURLParams`, `isSameDate`).
- **Consumido por**: `app.js` (en arranque y eventos `popstate`), `selection.js`, `filters.js`, `dataLoader.js`.

---

## 🔗 Estructura de Parámetros URL

| Parámetro | Tipo / Formato | Ejemplo | Descripción |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | `date=2026-08-28` | Fecha consultada (validada: entre hoy y hoy + 7 días). |
| `sedes` | CSV de IDs de sede | `sedes=003,002` | Sedes activas (solo acepta `001`, `002`, `003`). |
| `filter` | String URL-encoded | `filter=godard` | Búsqueda por título. |
| `timeStart`| `HH:MM` | `timeStart=16:00` | Hora mínima de inicio de funciones. |
| `timeEnd`  | `HH:MM` | `timeEnd=21:30` | Hora máxima de inicio de funciones. |
| `view`     | `string` ('movies' o null) | `view=movies` | Modo de visualización activo ('movies' para multi-día; se omite si es 'day'). |

---

## ⚙️ API Exportada

### `updateStateInURL()`
- **Firma**: `updateStateInURL(): void`
- **Descripción**: Lee el estado actual (`state.currentDate`, `state.activeSedes`, `state.movieFilter`, `state.timeFilterStart`, `state.timeFilterEnd`, `state.viewMode`) y actualiza la URL mediante `window.history.replaceState` (a través de `utils.js:updateURLParams`).
- **Sincronización de vista**: Si `state.viewMode === 'movies'`, serializa `view: 'movies'`; de lo contrario, envía `view: null` para mantener la URL limpia en el modo predeterminado de un solo día.
- **Comportamiento especial**: Si `state.isInitializing === true`, la función aborta inmediatamente para evitar sobreescrituras accidentales durante el boot.

### `loadStateFromURL()`
- **Firma**: `loadStateFromURL(): { dateChanged: boolean, sedesChanged: boolean, movieFilterChanged: boolean, timeFilterChanged: boolean, viewModeChanged: boolean }`
- **Descripción**: Lee los parámetros de la URL actual, valida los valores y actualiza las propiedades correspondientes en `state.js`.
- **Detección de modo (`viewMode`)**: Examina `params.view`. Si es `'movies'` y el modo actual difiere, conmuta a `'movies'` y marca `result.viewModeChanged = true`. Si el parámetro no está presente pero el estado estaba en `'movies'`, conmuta a `'day'` y también marca `result.viewModeChanged = true`.
- **Retorno**: Objeto indicador de qué valores cambiaron con respecto al estado previo (clave para decidir si se debe limpiar la selección de itinerario).

---

## ⚠️ Reglas y Casos Borde
1. **Validación de fechas**: Solo se aceptan fechas en la ventana válida (desde el día de hoy hasta +7 días). Si la fecha es pasada o mayor a 7 días, se descarta y se mantiene la fecha actual.
2. **Validación de sedes**: Cualquier valor distinto de `001` (CNCH), `002` (CNA) o `003` (XOCO) es filtrado y descartado. Si no hay sedes válidas en la URL, se utilizan las `DEFAULT_SEDES`.
3. **Limpieza de selección**: Si `dateChanged` o `viewModeChanged` son verdaderos, `app.js` limpia automáticamente cualquier selección de itinerario previa (`clearSelection()`) para evitar conflictos entre fechas distintas o transiciones de vista.
