# Componente: Filtro de Ciclos y Festivales (`js/ciclosFilter.js`)

## 📌 Propósito y Resumen
Permite explorar y filtrar la cartelera por ciclos temáticos, retrospectivas y festivales de la Cineteca Nacional (e.g. *Tour de Cine Francés*, *Muestra Internacional de Cine*, *Talento Emergente*). Por defecto se muestran todas las películas. El usuario elige **un solo ciclo** y, según el switch `Seleccionar | Deseleccionar`, la cartelera muestra solo las películas de ese ciclo o las oculta. Incluye un botón de acceso con badge dinámico, un drawer colapsable con carrusel horizontal de tarjetas y sincronización con sedes y URL.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js` (`toggleCiclo`, `clearCiclosSelection`, `setCiclosMode`, `hasCicloSelection`, `movieMatchesCicloFilter`, `getCurrentMovieData`), `filters.js` (`applyFilters`), `urlState.js` (`updateURL`), `carousel.js` (`renderPosterCarousel`, `clearCarouselSelection`), `cache.js`, `dataLoader.js` (`renderCurrentView`), `utils.js`.
- **Consumido por**: `app.js` (inicialización `initCiclosFilter`, `updateCiclosUI` en `popstate`), `filters.js` (`updateCiclosUI` en `clearAllFilters`), `modal.js` e `inlineInfo.js` (clic en badges de ciclo → `setSoloCiclo` + evento `ciclos:changed`).
- **Estilos asociados**: `css/ciclos.css` (importado en `css/styles.css`).

---

## 🧠 Modelo de Selección
- **Selección única**: `state.selectedCiclos` es `null` (sin filtro, valor por defecto) o un `Set` con **un único** ID. Elegir otra tarjeta reemplaza la selección; elegir la tarjeta ya seleccionada la quita (`toggleCiclo`).
- **Modo** (`state.ciclosMode`):
  - `'include'` (switch **Seleccionar**, por defecto): solo se muestran las películas que pertenecen al ciclo.
  - `'exclude'` (switch **Deseleccionar**): se ocultan las películas que pertenecen al ciclo. Las películas sin ciclo siempre se muestran.
- Cambiar el switch con un ciclo elegido conserva la selección e invierte su efecto.
- La regla de filtrado vive en un único helper, `movieMatchesCicloFilter(movie)` (`state.js`), usado por `filters.js`, `carousel.js` y `ciclosFilter.js`.

---

## 🖥️ Estructura del DOM y Componentes

### 1. Botón de Apertura (`#btnCiclosFilter`)
- Ubicado en `.ciclos-section`, una fila propia debajo de `.header-filters` (buscador, horario y compartir) e inmediatamente encima del drawer.
- Badge reactivo `#ciclosCountBadge`:
  - `"Todos"`: sin selección.
  - `"Solo: <nombre>"`: modo `include` con ciclo elegido.
  - `"Sin: <nombre>"`: modo `exclude` con ciclo elegido.
- Clases de estado: `.ciclos-filter-btn--active` (ámbar) cuando hay selección y `.ciclos-filter-btn--exclude` (rosa) cuando además el modo es `exclude`.
- En móvil ocupa todo el ancho.

### 2. Drawer Colapsable (`#ciclosDrawer`)
- Contenedor animado debajo del botón. Recibe las clases `.ciclos-drawer--exclude` (modo `exclude`) y `.ciclos-drawer--has-selection`.
- **Cabecera** (grid `info | actions | close`; en móvil `info close / actions`):
  - Título y resumen `#ciclosSelectionSummary` ("Mostrando todas las películas", "Mostrando solo: …", "Ocultando: …").
  - **Switch `#ciclosModeSwitch`** (`role="radiogroup"`): control segmentado con dos opciones `Seleccionar` (azul) y `Deseleccionar` (rosa) y un thumb animado. Navegable con las flechas del teclado.
  - **Botón `#btnCiclosClear` "Limpiar"**: visible solo con selección; llama a `clearCiclosSelection()`.
  - **Botón `#btnCiclosClose` (✕)**: cierra el drawer.
- **Pista horizontal (`.ciclos-track`)** con tarjetas de ciclo y scroll suave.

### 3. Tarjeta de Ciclo (`.ciclo-card`)
- Póster (con fallback), etiqueta de estado `.ciclo-card-status`, contador de películas (`.ciclo-count-pill`) y nombre.
- Es un `role="button"` enfocable con `aria-pressed`; se activa con clic, `Enter` o `Espacio`. No hay checkbox ni botón "Solo este".
- **Estados**:
  - `.ciclo-card--selected`: ciclo elegido. Borde azul y etiqueta "Mostrando"; en modo `exclude` borde rosa, póster en escala de grises y etiqueta "Oculto".
  - `.ciclo-card--dimmed`: resto de tarjetas atenuadas cuando hay selección en modo `include`.

---

## 🔄 Sincronización Inteligente con Sedes y Carrusel

1. **Activación Automática de Sedes** (solo modo `include` con ciclo elegido):
   - Muchos festivales se proyectan exclusivamente en una sede específica (por ejemplo, Chapultepec `001`).
   - `onCiclosChanged()` detecta las sedes con películas del ciclo y, si alguna no está en `state.activeSedes`, la agrega, sincroniza el checkbox de la sede (`#chapultepec`, `#cenart`, `#xoco`) y refresca los datos en memoria.

2. **Sincronización con el Carrusel de Pósters**:
   - En modo `include` con selección, el carrusel superior reúne las películas del ciclo a través de las sedes activas y fechas disponibles (`state.multiDayData`).
   - En modo `exclude` el carrusel usa los datos normales de la vista y descarta las películas del ciclo.
   - Si una película fijada en el carrusel deja de pasar el filtro de ciclos, se libera el bloqueo (`clearCarouselSelection()`).

3. **Botón "Quitar filtros"**: `clearAllFilters()` limpia la selección y devuelve el modo a `include`.

---

## ⚙️ API Exportada

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `initCiclosFilter()` | — | `void` | Inicializa el botón, los escuchadores de eventos (`feed:loaded`, `ciclos:changed`, `filters:updated`) y renderiza el drawer. |
| `toggleDrawer(forceOpen?)` | `forceOpen: boolean \| null` | `void` | Abre o cierra el drawer. |
| `renderCiclosDrawer()` | — | `void` | Construye el drawer (cabecera, switch y tarjetas) y conecta sus eventos. |
| `updateCiclosUI()` | — | `void` | Sincroniza badge, resumen, switch, botón "Limpiar" y estado de las tarjetas con `state`. |