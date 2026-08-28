# Módulo: Bloqueo Mutuo de Filtros (`js/filterLock.js`)

## 📌 Propósito y Resumen
Implementa la lógica de **exclusión mutua** entre dos modalidades de filtrado que compiten entre sí: el filtro derivado del **Carrusel de Pósters** y los filtros derivados de los **Inputs de Formulario** (caja de texto y selectores de hora). Asegura coherencia visual y previene estados contradictorios.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`.
- **Consumido por**: `app.js`, `carousel.js`, `carouselFilterChip.js`, `filters.js`.

---

## 🔒 Estados de Bloqueo (`FILTER_LOCKS`)

```javascript
export const FILTER_LOCKS = {
    NONE: null,          // Sin bloqueos: todos los controles interactivos están habilitados
    CAROUSEL: 'carousel',// Filtrado por póster: deshabilita campos de texto/tiempo
    INPUTS: 'inputs'     // Filtrado por inputs: atenúa el carrusel de pósters
};
```

---

## ⚙️ API Exportada

### `setFilterLock(lock)`
- **Firma**: `setFilterLock(lock: 'carousel' | 'inputs' | null): void`
- **Descripción**: Si el estado cambia, actualiza `state.filterLock`, invoca `updateFilterLockUI()` y dispara el evento `document.dispatchEvent(new CustomEvent('filterLock:changed', { detail: { lock } }))`.

### `updateFilterLockUI()`
- **Firma**: `updateFilterLockUI(): void`
- **Efectos en el DOM**:
  - **Si `lock === CAROUSEL`**:
    - `#movieFilter`: `disabled = true`, vacía el valor y añade `.filter-input--locked`.
    - `#startTimeFilter`, `#endTimeFilter`, `#clearTimeFilter`: `disabled = true` y añade `.clear-time-btn--locked`.
    - `#posterCarousel`: añade `.poster-carousel--carousel-active`.
  - **Si `lock === INPUTS`**:
    - `#posterCarousel`: añade `.poster-carousel--inputs-locked` (reduce la opacidad visual del carrusel para enfocar la cuadrícula).
  - **Si `lock === NONE`**:
    - Remueve todas las clases de bloqueo y reactiva todos los inputs.
