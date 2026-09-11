# Componente: Modal de Ficha Técnica (`js/modal.js`)

## 📌 Propósito y Resumen
Controla el modal de pantalla completa (`#movieInfoModal`) que despliega la ficha técnica completa de una película: póster oficial, reproductor de tráiler de YouTube embebido, créditos, sinopsis, botones de búsqueda externa (IMDb, Letterboxd, YouTube), acordeón de funciones futuras agrupadas por día y navegación secuencial (`prev`/`next`).

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `utils.js` (`minutesToTime`, `extractFilmId`, `getYouTubeEmbedUrl`, `doMoviesOverlap`), `showtimes.js` (`getFutureShowtimesForMovie`, `groupShowtimesByDay`, `buildMovieNavigationArray`), `movieUtils.js` (`decodeHTMLEntities`, `extractMovieMetadata`, `generateSearchURLs`), `apiCache.js` (`fetchMovieDataWithCache`, `fetchMovieDetailsWithCache`, `fetchMovieImageWithCache`, `fetchMovieTrailerWithCache`), `selection.js` (`toggleMovieSelection`), `calendar.js` (`generateCalendarLink`), `filters.js` (`hasActiveFilters`).
- **Consumido por**: `app.js` (inicialización, atajos de teclado), `grid.js` y `moviesGrid.js` (apertura al hacer clic en bloque de función), `inlineInfo.js` (reutiliza `buildMovieInfoContent` y `wireMovieInfoInteractions`).

---

## ⚙️ API Exportada

### `buildMovieInfoContent(movie, options, horario, date)`
- **Firma**: `async buildMovieInfoContent(movie: Object, options?: { idPrefix?: string, filmId?: string }, horario?: string, date?: string): Promise<string>`
- **Descripción**: Generador HTML reutilizable (tanto para el modal como para el panel inline).
  - Consume directamente las propiedades ya hidratadas en el objeto `movie` (`movie.sinopsis`, `movie.poster`, `movie.trailer`, `movie.creditos`) provenientes del feed consolidado, o consulta `fetchMovieDataWithCache` en `apiCache.js` como respaldo.
  - Si se proporciona un `horario`, construye la barra de acciones de la función (`.modal-screening-actions`):
    - **Botón Seleccionar / Deseleccionar**: alterna la selección en el itinerario y cierra de inmediato el modal.
    - **Botón Agregar al calendario**: genera enlace para Google Calendar.
    - **Botón Ir a comprar**: enlace directo a venta de boletos.
  - Construye el overlay de video interactivo para YouTube con contenedor 16:9 (`aspect-ratio: 16 / 9`) e iframe optimizado con `playsinline=1` y permisos modernos (`allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`).
  - Incluye barra de herramientas de reproducción (`.trailer-toolbar`) con botones para pausar/reanudar vía `postMessage`, cerrar el video y volver a la imagen fija, y enlace directo a YouTube.
  - Formatea los párrafos de información técnica y sinopsis.
  - Inserta los botones de búsqueda en `.search-buttons`: **Cineteca** en primera posición con estilo consistente, seguido de IMDb, Letterboxd y YouTube.
  - Renderiza el listado colapsable de próximas funciones con enlaces directos de compra.

### `wireMovieInfoInteractions(container, options)`
- **Firma**: `wireMovieInfoInteractions(container: HTMLElement, options?: { idPrefix?: string }): void`
- **Descripción**: Asocia los listeners para el botón de reproducción del tráiler de YouTube, la barra de herramientas externa de control de video (`postMessage` para play/pause, restauración de imagen), y el toggle del acordeón de funciones futuras.

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
- **Descripción**: Oculta el modal, limpia el reproductor iframe para detener el audio del video, oculta la barra de herramientas del tráiler y reactiva el scroll del `body` (`body.style.overflow = ''`).

