# Componente: Chip de Filtro de Carrusel y Navegación de Funciones (`js/carouselFilterChip.js`)

## 📌 Propósito y Resumen
Gestiona el widget flotante/sticky (`#carouselFilterChip`) que aparece cuando el usuario selecciona una película en el carrusel de pósters, así como la fila inferior de 3 chips de navegación (`#carouselNavChips`: `<<`, `n de N`, `>>`) que permite desplazarse directamente entre cada `.movie-block` visible de la película filtrada.

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
    - `posterCarousel:applyFilter`: Guarda el título de la película seleccionada, reinicia el índice de navegación si cambió la película, hace visibles `#carouselFilterChip` y `#carouselNavChips` y calcula el total `N` de funciones visibles.
    - `posterCarousel:clearFilter`: Limpia el título, remueve el resaltado `.movie-block--nav-active` y oculta tanto el chip principal como los 3 chips de navegación.
    - `filters:updated` y `filterLock:changed`: Revalida la visibilidad de los chips y recalcula la lista ordenada de `.movie-block:not(.filtered-out)` cuando cambian las sedes, fechas o vista (Día / Semana).
  - Asigna el listener de clic al chip principal (`#carouselFilterChip`) para invocar `clearCarouselSelection()`.
  - Gestiona los 3 chips inferiores (`#carouselNavPrev`, `#carouselNavCounter`, `#carouselNavNext`):
    - Ordena los bloques visibles de arriba hacia abajo (por fila `.room-row` o carril `.movies-lane`) y de izquierda a derecha (por posición temporal `style.left`).
    - Muestra la posición actual (`n de N`, o `0 de 0` si no hay funciones en las sedes activas).
    - Al presionar `<<`, `n de N` o `>>`, aplica la clase `.movie-block--nav-active` al bloque destino y realiza scroll suave tanto vertical (`window.scrollTo` con margen superior) como horizontal (centrando el bloque en `.schedule-grid` / `.schedule-container` cuando hay overflow en pantallas móviles).
  - Ajusta dinámicamente la posición del botón de ayuda `#helpBtn` (`help-btn--shifted`) para evitar solapamientos visuales en dispositivos móviles.
