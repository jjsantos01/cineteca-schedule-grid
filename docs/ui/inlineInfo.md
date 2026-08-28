# Componente: Panel Inline de Película (`js/inlineInfo.js`)

## 📌 Propósito y Resumen
Permite desplegar la ficha técnica de una película seleccionada directamente en la página (justo debajo del carrusel de pósters en `#inlineMovieInfoPanel`), sin abrir el modal de pantalla completa. Incluye botones de navegación anterior/siguiente integrados y botones de acción rápida en `#posterInfoActions`.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `modal.js` (`buildMovieInfoContent`, `wireMovieInfoInteractions`), `carousel.js` (`selectFilmInCarousel`, `clearCarouselSelection`).
- **Consumido por**: `app.js`, `carousel.js`, `tooltip.js`.

---

## ⚙️ API Exportada

### `updatePosterInfoActions()`
- **Firma**: `updatePosterInfoActions(): void`
- **Descripción**: Actualiza el contenedor `#posterInfoActions`. Si hay una película filtrada desde el carrusel, muestra los botones "Información" (u "Ocultar") y "Limpiar selección".

### `openInlineInfo(filmId)`
- **Firma**: `async openInlineInfo(filmId: string): Promise<void>`
- **Comportamiento**:
  - Obtiene el orden de películas del carrusel (`getCarouselOrder`).
  - Construye la estructura del panel con cabecera de navegación (`#inlinePrevMovieBtn`, `#inlineNextMovieBtn`) y cuerpo.
  - Invoca `buildMovieInfoContent` pasando el prefijo de IDs `'inline-'`.
  - Al navegar con los botones de flechas, actualiza en sincronía el póster seleccionado en el carrusel sin causar bucles reactivos (`state.inlineSelectionChange = true`).

### `destroyInlineInfo(options)`
- **Firma**: `destroyInlineInfo(options?: { keepActions?: boolean }): void`
- **Descripción**: Limpia el contenido del panel `#inlineMovieInfoPanel` y opcionalmente los botones de acción en `#posterInfoActions`.
