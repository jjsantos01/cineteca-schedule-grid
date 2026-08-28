# Componente: Chip de Filtro de Carrusel (`js/carouselFilterChip.js`)

## 📌 Propósito y Resumen
Gestiona el widget flotante/sticky (`#carouselFilterChip`) que aparece cuando el usuario selecciona una película en el carrusel de pósters. Muestra el título del filme filtrado y permite quitar el filtro rápidamente con un clic.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `filterLock.js` (`FILTER_LOCKS`), `carousel.js` (`clearCarouselSelection`).
- **Consumido por**: `app.js` (inicializado en `DOMContentLoaded`).

---

## ⚙️ API Exportada

### `initCarouselFilterChip()`
- **Firma**: `initCarouselFilterChip(): void`
- **Comportamiento**:
  - Escucha eventos del sistema:
    - `posterCarousel:applyFilter`: Guarda el título de la película seleccionada y hace visible el chip.
    - `posterCarousel:clearFilter`: Limpia el título y oculta el chip.
    - `filters:updated` y `filterLock:changed`: Revalida la visibilidad del chip en el DOM.
  - Asigna el listener de clic al botón de cierre del chip (`#carouselFilterChip`) para invocar `clearCarouselSelection()`.
  - Ajusta dinámicamente la posición del botón de ayuda `#helpBtn` (`help-btn--shifted`) para evitar solapamientos visuales en dispositivos móviles y de escritorio.
