# Componente: Filtro de Ciclos y Festivales (`js/ciclosFilter.js`)

## 📌 Propósito y Resumen
Permite explorar y filtrar la cartelera por ciclos temáticos, retrospectivas y festivales de la Cineteca Nacional (e.g. *Tour de Cine Francés*, *Muestra Internacional de Cine*, *Talento Emergente*). Proporciona un botón de acceso con badge dinámico en la barra de filtros, un drawer colapsable con carrusel horizontal de tarjetas enriquecidas, acciones rápidas y sincronización bidireccional con sedes y URL.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js` (`selectedCiclos`, `ciclos`, `setSelectedCiclos`, `toggleCiclo`, `selectAllCiclos`, `deselectAllCiclos`, `setSoloCiclo`), `filters.js` (`applyFilters`), `urlState.js` (`updateURL`), `carousel.js` (`renderPosterCarousel`, `clearCarouselSelection`), `config.js` (`POSTER_BASE_URL`).
- **Consumido por**: `app.js` (inicialización `initCiclosFilter`, actualización en `popstate`), `modal.js` y `inlineInfo.js` (clic en badges de ciclo).
- **Estilos asociados**: `css/ciclos.css` (importado en `css/styles.css`).

---

## 🖥️ Estructura del DOM y Componentes

### 1. Botón de Apertura en Barra de Filtros (`#btnCiclosFilter`)
- Ubicado en el header de filtros principales.
- Contiene el badge reactivo `#ciclosCountBadge`, que muestra el estado actual de selección:
  - `"Todos"`: Cuando no hay restricción por ciclo (`selectedCiclos === null`).
  - `"X de N"`: Cuando hay un subconjunto de ciclos seleccionados.
  - `"Ninguno"`: Cuando todos los ciclos están desmarcados.
- Se resalta visualmente con la clase `.ciclos-filter-btn--active` cuando el filtro está activo (`selectedCiclos !== null`).

### 2. Drawer Colapsable (`#ciclosDrawer`)
- Contenedor animado que se expande debajo de los filtros.
- Incluye:
  - **Buscador de ciclos (`#ciclosSearchInput`)**: Filtra en tiempo real las tarjetas del carrusel por título o descripción.
  - **Botones de acción rápida**:
    - **"Todos" (`#btnCiclosAll`)**: Selecciona todos los ciclos (`selectAllCiclos()`).
    - **"Ninguno` (#btnCiclosNone)`**: Deselecciona todos los ciclos (`deselectAllCiclos()`), vaciando la cartelera.
    - **"Solo Festivales" (`#btnCiclosTours`)**: Selecciona exclusivamente ciclos destacados marcados como tours o festivales internacionales.
  - **Pista horizontal (`.ciclos-track`)**: Carrusel deslizante de tarjetas de ciclo con scroll suave y botones de flecha anterior/siguiente.

### 3. Tarjeta de Ciclo (`.ciclo-card`)
- Representa un ciclo o festival individual.
- **Collage de pósters (`.ciclo-card-posters`)**: Muestra miniaturas de hasta 3 películas pertenecientes al ciclo.
- **Información y badges**: Título del ciclo, contador de películas (`.ciclo-pill--count`) y etiqueta de festival (`.ciclo-pill--tour`).
- **Estados**:
  - `.ciclo-card--selected`: Ciclo marcado como activo.
  - `.ciclo-card--dimmed`: Ciclo desmarcado.
- **Acciones**:
  - Clic en tarjeta: Alterna (`toggle`) la inclusión del ciclo en `state.selectedCiclos`.
  - Clic en botón "Solo este": Aplica filtro exclusivo al ciclo seleccionado.

---

## 🔄 Sincronización Inteligente con Sedes y Carrusel

1. **Activación Automática de Sedes**:
   - Muchos festivales se proyectan exclusivamente en una sede específica (por ejemplo, funciones exclusivas en Chapultepec `001`).
   - Al activar un ciclo, `ciclosFilter.js` analiza las sedes que albergan películas de dicho ciclo. Si alguna sede anfitriona no está en `state.activeSedes`, se agrega automáticamente, sincronizando el checkbox correspondiente en el DOM (`#chapultepec`, `#cenart`, `#xoco`) y refrescando los datos en memoria.

2. **Sincronización con el Carrusel de Pósters**:
   - Al filtrar por ciclos, el carrusel superior agrega todas las películas pertenecientes al ciclo a través de las sedes activas y fechas disponibles (`state.multiDayData`), garantizando que todas las películas del festival sean accesibles.
   - Si una película seleccionada en el carrusel deja de pertenecer a los ciclos activos, el carrusel libera el bloqueo de forma segura (`clearCarouselSelection()`).

---

## ⚙️ API Exportada

| Función | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `initCiclosFilter()` | — | `void` | Inicializa el drawer, inyecta escuchadores de eventos y renderiza las tarjetas de ciclos. |
| `updateCiclosUI()` | — | `void` | Sincroniza el badge del botón y las clases visuales de selección en las tarjetas. |
| `renderCiclosCards()` | — | `void` | Construye y renderiza en el DOM la lista de tarjetas en `.ciclos-track`. |
| `filterByCiclo(cicloId)` | `cicloId: string` | `void` | Selecciona exclusivamente el ciclo dado, abre el drawer y actualiza la cartelera. |
