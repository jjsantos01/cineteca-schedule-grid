# Componente: Carrusel de Pósters (`js/carousel.js`)

## 📌 Propósito y Resumen
Muestra un carrusel sticky horizontal con los pósters únicos de todas las películas programadas en el día para las sedes seleccionadas. Permite al usuario filtrar la cuadrícula haciendo clic sobre una tarjeta, ver horarios por sede en un popover flotante y alternar el panel inline de información.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `utils.js` (`timeToMinutes`), `filterLock.js` (`FILTER_LOCKS`, `setFilterLock`, `updateFilterLockUI`), `config.js` (`SEDES`, `POSTER_BASE_URL`).
- **Consumido por**: `grid.js` (`renderPosterCarousel`), `app.js` (`selectFilmInCarousel`, `clearCarouselSelection`), `inlineInfo.js`, `tooltip.js`.

---

## ⚙️ API Exportada

### `renderPosterCarousel(movieData, options)`
- **Firma**: `renderPosterCarousel(movieData: Object, options?: { isLoading?: boolean }): void`
- **Comportamiento**:
  - Extrae y deduplica películas por `filmId` ordenadas alfabéticamente en español con `Intl.Collator`.
  - Si no hay datos, renderiza un mensaje informativo (`poster-carousel-empty`).
  - Si hay películas, crea la pista `.poster-carousel-track` con tarjetas `.poster-card` individuales.
  - Asigna badges con colores de las sedes donde se proyecta y enlaces de compra rápida en el popover.

### `selectFilmInCarousel(filmId, fallbackTitle)`
- **Firma**: `selectFilmInCarousel(filmId: string, fallbackTitle?: string): void`
- **Comportamiento**:
  - Actualiza `state.carouselFilterFilmId = filmId`.
  - Establece el bloqueo `setFilterLock(FILTER_LOCKS.CAROUSEL)`.
  - Dispara el evento `document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', { detail: { filmId, title } }))`.
  - Actualiza el resaltado visual del carrusel.

### `clearCarouselSelection()`
- **Firma**: `clearCarouselSelection(): void`
- **Comportamiento**:
  - Limpia `state.carouselFilterFilmId = null`.
  - Restablece el bloqueo `setFilterLock(FILTER_LOCKS.NONE)`.
  - Dispara el evento `posterCarousel:clearFilter`.

---

## 🎯 Interacciones Clave en las Tarjetas de Póster
- **Clic simple**: Alterna la selección de la película como filtro único en la cuadrícula.
- **Hover en badge de sede**: Muestra el popover flotante (`#posterShowtimesPopover`) con el listado de salas y horarios con enlace directo a taquilla para esa sede.
- **Tecla Escape**: Cancela la selección del carrusel si no hay modales o tours abiertos.
