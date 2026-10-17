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
├── tour.css          # Spotlight animado, popovers y controles de navegación del tour
└── moviesGrid.css    # Vista multi-día: selector de modo, tarjetas de día, carriles y bloques compactos
```

---

## 🎨 Variables Globales (`css/variables.css`)

```css
:root {
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --radius-1: 4px;
    --radius-2: 8px;
    --bp-md: 768px;

    /* Sede Brand Colors */
    --color-cenart: #642f90;
    --color-xoco: #eb1c23;
    --color-chapultepec: #28714f;
    --chapultepec-color: #28714f; /* Legado */
    --cenart-color: #642f90;      /* Legado */
    --xoco-color: #eb1c23;        /* Legado */
}
```

---

## 🎯 Clases de Estado Visuales Clave

| Clase CSS | Elemento Objetivo | Efecto Visual |
|---|---|---|
| `.movie-block.selected` | Bloques del grid | Borde dorado destacado, mayor elevación y brillo para indicar función en el itinerario. |
| `.movie-block.visited` | Bloques del grid | Indicador sutil para distinguir películas ya exploradas. |
| `.movie-block.filtered-out` | Bloques del grid | Opacidad reducida (`0.25`) y eventos de puntero desactivados. |
| `.movie-block--compact` | Bloques de vista multi-día | Altura compacta de 16px (40% del bloque regular) y tipografía a 10px para alta densidad. |
| `.room-row.has-visible-movies` | Filas de sala | Resaltado de fondo suave para ubicar salas con coincidencias de filtro. |
| `.movies-lane.has-visible-movies` | Carriles multi-día | Resaltado de fondo suave para ubicar carriles con coincidencias de filtro. |
| `.view-switch-btn.active` | Botón del selector de vista | Fondo blanco elevado con sombra suave para indicar el modo activo ("Ver por día" o "Ver por semana"). |
| `.day-count-badge` | Cabecera del día | Badge redondeado con resumen de funciones disponibles o funciones coincidentes. |
| `.filter-input--locked` | Input de búsqueda | Fondo deshabilitado e icono de candado cuando el carrusel tiene el foco. |
| `.time-slider--locked` | Dual range slider | Deshabilita los thumbs y reduce la opacidad cuando el carrusel tiene el foco. |
| `.clear-all-filters-btn.visible` | `#clearAllFilters` | Despliega reactivamente el botón "Quitar filtros" con micro-animación pop. |
| `.clear-input-btn.visible` | `#clearMovieFilterBtn` | Muestra el botón de borrado rápido (x) en el input de búsqueda. |
| `.clear-time-btn.visible` | `#clearTimeFilter` | Muestra el botón condicional para reiniciar el filtro de horario. |
| `.poster-carousel--inputs-locked`| Carrusel de pósters | Opacidad reducida para indicar que los filtros de formulario están activos. |
| `.carousel-chip--visible` | `#carouselFilterChip` | Hace visible el chip flotante sticky de la película filtrada. |
| `.carousel-nav-chips--visible` | `#carouselNavChips` | Hace visibles los 3 chips flotantes (`<<`, `n de N`, `>>`) debajo de `#carouselFilterChip`. |
| `.movie-block--nav-active` | Bloques del grid | Contorno destacado y animación de pulso al navegar hacia una función con los chips `<<` / `>>`. |
| `.room-row--nav-active` / `.movies-lane--nav-active` | Filas / Carriles | Resaltado opaco de la etiqueta de sala/carril correspondiente a la función activa. |
| `.help-btn--shifted` | `#helpBtn` | Desplaza el botón flotante de ayuda en móvil para no solaparse con los chips de filtro y navegación. |
