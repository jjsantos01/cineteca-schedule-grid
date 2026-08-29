# Componente: Modal de Ficha Técnica (`js/modal.js`)

## 📌 Propósito y Resumen
Controla el modal de pantalla completa (`#movieInfoModal`) que despliega la ficha técnica completa de una película: póster oficial, reproductor de tráiler de YouTube embebido, créditos, sinopsis, botones de búsqueda externa (IMDb, Letterboxd, YouTube), acordeón de funciones futuras agrupadas por día y navegación secuencial (`prev`/`next`).

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `utils.js` (`minutesToTime`, `extractFilmId`, `getYouTubeEmbedUrl`), `showtimes.js` (`getFutureShowtimesForMovie`, `groupShowtimesByDay`, `buildMovieNavigationArray`), `movieUtils.js` (`decodeHTMLEntities`, `extractMovieMetadata`, `generateSearchURLs`), `apiCache.js` (`fetchMovieDetailsWithCache`, `fetchMovieImageWithCache`, `fetchMovieTrailerWithCache`).
- **Consumido por**: `app.js` (inicialización, atajos de teclado), `tooltip.js` (botón "Información"), `inlineInfo.js` (reutiliza `buildMovieInfoContent` y `wireMovieInfoInteractions`).

---

## ⚙️ API Exportada

### `buildMovieInfoContent(movie, options)`
- **Firma**: `async buildMovieInfoContent(movie: Object, options?: { idPrefix?: string, filmId?: string }): Promise<string>`
- **Descripción**: Generador HTML reutilizable (tanto para el modal como para el panel inline).
  - Consulta concurrentemente los detalles, imagen y tráiler mediante `Promise.all` y `apiCache.js`.
  - Construye el overlay de video interactivo para YouTube.
  - Formatea los párrafos de información técnica y sinopsis.
  - Inserta el botón de enlace directo a la ficha en el sitio web oficial de Cineteca Nacional.
  - Inserta los botones de búsqueda en IMDb, Letterboxd y YouTube.
  - Renderiza el listado colapsable de próximas funciones con enlaces directos de compra.

### `wireMovieInfoInteractions(container, options)`
- **Firma**: `wireMovieInfoInteractions(container: HTMLElement, options?: { idPrefix?: string }): void`
- **Descripción**: Asocia los listeners para el botón de reproducción del tráiler de YouTube y el toggle del acordeón de funciones futuras.

### `initModal()`
- **Firma**: `initModal(): void`
- **Descripción**: Registra listeners globales para cerrar el modal al hacer clic en el backdrop o presionar `Escape`, y navegar con las teclas de flecha `←` y `→`.

### `showMovieInfoModal(movie, horario)`
- **Firma**: `async showMovieInfoModal(movie: Object, horario?: string): Promise<void>`
- **Descripción**: Cierra tooltips activos, prepara el arreglo de navegación de películas para flechas `prev`/`next`, bloquea el scroll del cuerpo de la página (`body.style.overflow = 'hidden'`), muestra el modal y renderiza la ficha.

### `navigateToPrevMovie()` / `navigateToNextMovie()`
- **Firma**: `navigateToPrevMovie(): void`, `navigateToNextMovie(): void`
- **Descripción**: Cambia la ficha a la película anterior o siguiente dentro del arreglo de películas de la vista actual.

### `closeMovieInfoModal()`
- **Firma**: `closeMovieInfoModal(): void`
- **Descripción**: Oculta el modal, limpia el reproductor iframe para detener el audio del video y reactiva el scroll del `body` (`body.style.overflow = ''`).
