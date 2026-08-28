# Arquitectura de Estilos CSS (`css/`)

## 📌 Propósito y Resumen
Describe la organización modular de los estilos CSS de la aplicación. Todo el sistema utiliza CSS nativo puro sin preprocesadores (Sass/Less), orquestado a través del archivo central `css/styles.css`.

---

## 📂 Organización de Archivos CSS

```
css/
├── styles.css        # Hoja principal que importa todos los módulos (@import)
├── variables.css     # Variables personalizadas CSS (colores institucionales de sedes)
├── base.css          # Reset, tipografía, cabecera, selector de fecha, checkboxes y footer
├── filters.css       # Controles de búsqueda, filtros de horario, estados de bloqueo y chip activo
├── grid.css          # Timeline horizontal, filas de salas, bloques de función y estados visuales
├── carousel.css      # Carrusel sticky horizontal de pósters, tarjetas y popover de sedes
├── tooltip.css       # Tooltips flotantes (interactivo al clic y preview de póster al hover)
├── modal.css         # Modal de ficha técnica, reproductor de video, chips y acordeón de funciones
├── help.css          # Modal de ayuda, tarjetas informativas y tabla de atajos de teclado
└── tour.css          # Spotlight animado, popovers y controles de navegación del tour
```

---

## 🎨 Variables Globales (`css/variables.css`)

```css
:root {
    --chapultepec-color: #28714f; /* Verde Cineteca Chapultepec */
    --cenart-color: #642f90;      /* Morado Cineteca de las Artes */
    --xoco-color: #eb1c23;        /* Rojo Cineteca Nacional México Xoco */
}
```

---

## 🎯 Clases de Estado Visuales Clave

| Clase CSS | Elemento Objetivo | Efecto Visual |
|---|---|---|
| `.movie-block.selected` | Bloques del grid | Borde dorado destacado, mayor elevación y brillo para indicar función en el itinerario. |
| `.movie-block.visited` | Bloques del grid | Indicador sutil para distinguir películas ya exploradas. |
| `.movie-block.filtered-out` | Bloques del grid | Opacidad reducida (`0.25`) y eventos de puntero desactivados. |
| `.room-row.has-visible-movies` | Filas de sala | Resaltado de fondo suave para ubicar salas con coincidencias de filtro. |
| `.filter-input--locked` | Input de búsqueda | Fondo deshabilitado e icono de candado cuando el carrusel tiene el foco. |
| `.poster-carousel--inputs-locked`| Carrusel de pósters | Opacidad reducida para indicar que los filtros de formulario están activos. |
| `.carousel-chip--visible` | `#carouselFilterChip` | Hace visible el chip flotante sticky de la película filtrada. |
| `.help-btn--shifted` | `#helpBtn` | Desplaza el botón flotante de ayuda hacia arriba para no tapar el chip de filtro. |
