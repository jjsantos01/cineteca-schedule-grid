# Cineteca Schedule Grid — Documentación para Agentes de IA

Bienvenido a la documentación técnica de **Cineteca Schedule Grid**. Esta carpeta está diseñada para que agentes y desarrolladores puedan comprender la arquitectura y planificar cambios en módulos específicos **sin necesidad de inspeccionar todo el código fuente**.

---

## 🗺️ Mapa de Enrutamiento Rápido para Agentes

Usa esta tabla para saber exactamente qué documentación leer según la tarea que necesitas resolver:

| Si necesitas... | Lee estos documentos | Archivos de código clave |
|---|---|---|
| **Comprender el flujo global y ciclo de vida** | [Arquitectura y Flujo Global](architecture.md) | `js/app.js`, `js/state.js` |
| **Consultar o modificar la estructura del estado global** | [Estado Global](state/state.md), [Sincronización con URL](state/urlState.md) | `js/state.js`, `js/urlState.js` |
| **Agregar o editar sedes, colores o constantes** | [Configuración y Constantes](state/config.md), [Estilos CSS](styles/styles.md) | `js/config.js`, `css/variables.css` |
| **Modificar consultas al proxy o llamadas a la API** | [API Proxy](data/api.md), [Caché de API](data/apiCache.md), [DataLoader](data/dataLoader.md) | `js/api.js`, `js/apiCache.js`, `js/dataLoader.js` |
| **Ajustar el parseo de datos de Cineteca (texto o JSON)** | [Parser de Películas](data/parser.md), [Utilidades de Películas](data/movieUtils.md) | `js/parser.js`, `js/movieUtils.js` |
| **Trabajar con el carrusel de pósters superior** | [Carrusel de Pósters](ui/carousel.md), [Chip de Filtro Activo](ui/carouselFilterChip.md), [Caché de API](data/apiCache.md) | `js/carousel.js`, `js/carouselFilterChip.js` |
| **Modificar filtros (búsqueda de texto o rango de horas)** | [Filtros](interaction/filters.md), [Sistema de Bloqueo Mutuo](interaction/filterLock.md) | `js/filters.js`, `js/filterLock.js` |
| **Modificar la cuadrícula de horarios (Grid / Timeline)** | [Cuadrícula de Horarios](ui/grid.md), [Utilidades de Tiempo](interaction/utils.md), [Estilos](styles/styles.md) | `js/grid.js`, `js/utils.js`, `css/grid.css` |
| **Modificar selección de itinerario o detección de traslapes** | [Selección e Itinerario](interaction/selection.md), [Utilidades de Películas](data/movieUtils.md) | `js/selection.js`, `js/movieUtils.js` |
| **Ajustar el modal de ficha técnica o panel inline** | [Modal de Película](ui/modal.md), [Panel Inline](ui/inlineInfo.md), [Funciones Futuras](data/showtimes.md) | `js/modal.js`, `js/inlineInfo.js`, `js/showtimes.js` |
| **Ajustar tooltips al clic o hover de póster** | [Tooltip Interactivo](ui/tooltip.md), [Tooltip Hover Póster](ui/posterTooltip.md) | `js/tooltip.js`, `js/posterTooltip.js` |
| **Modificar el tour guiado o el modal de ayuda** | [Tour Onboarding](ui/tour.md), [Modal de Ayuda](ui/helpModal.md) | `js/tour.js`, `js/helpModal.js` |
| **Exportar a Google Calendar** | [Integración Calendario](data/calendar.md) | `js/calendar.js` |
| **Rastreo de funciones visitadas** | [Historial de Visitas](state/visited.md) | `js/visited.js` |
| **Administración y despliegue del Cloudflare Worker** | [Cloudflare Worker & Wrangler](infrastructure/worker.md) | `wrangler.toml`, `js/config.js` |

---

## 📂 Índice de Módulos por Categoría

### 1. Estado y Configuración (`docs/state/`)
- [state.md](state/state.md) — Objeto de estado único, esquema de datos y setters controlados.
- [urlState.md](state/urlState.md) — Serialización/deserialización bidireccional entre estado y parámetros URL.
- [config.md](state/config.md) — Definición de sedes (XOCO, CNA, CNCH), endpoints y claves de almacenamiento.
- [visited.md](state/visited.md) — Persistencia en LocalStorage de funciones consultadas por el usuario.

### 2. Capa de Datos y Caché (`docs/data/`)
- [api.md](data/api.md) — Llamadas HTTP asíncronas hacia el proxy de Cloudflare Workers (`cinetkv2`).
- [apiCache.md](data/apiCache.md) — Caché en memoria con TTL de 1 hora para sinopsis, imágenes y tráilers.
- [cache.md](data/cache.md) — Caché en memoria para carteleras por fecha/sede con purga a 7 días.
- [dataLoader.md](data/dataLoader.md) — Orquestación de carga en paralelo para múltiples sedes.
- [parser.md](data/parser.md) — Normalización de objetos JSON y cadenas legadas en estructuras estándar de película.
- [showtimes.md](data/showtimes.md) — Agrupador de funciones del día y futuras para la misma película.
- [movieUtils.md](data/movieUtils.md) — Extracción de metadatos (año, título original), generación de enlaces de búsqueda y caché perezoso de horarios (`_enrichedShowtimes`).
- [calendar.md](data/calendar.md) — Construcción de URLs de Google Calendar con zona horaria de México.

### 3. Infraestructura y Backend (`docs/infrastructure/`)
- [worker.md](infrastructure/worker.md) — Proxy Cloudflare Worker (`cinetkv2`), endpoints, gestión y despliegue con Wrangler.

### 4. Componentes de Interfaz (`docs/ui/`)
- [grid.md](ui/grid.md) — Renderizado del timeline continuo de horas y bloques de funciones por sala.
- [carousel.md](ui/carousel.md) — Carrusel horizontal con pósters únicos, popover de horarios y selección de película.
- [carouselFilterChip.md](ui/carouselFilterChip.md) — Chip flotante para indicar y remover el filtro de carrusel activo.
- [modal.md](ui/modal.md) — Modal de ficha completa con tráiler de YouTube integrado y navegación secuencial.
- [inlineInfo.md](ui/inlineInfo.md) — Panel colapsable de ficha técnica ubicado debajo del carrusel.
- [tooltip.md](ui/tooltip.md) — Tooltip interactivo flotante anclado al bloque de película con acciones directas.
- [posterTooltip.md](ui/posterTooltip.md) — Preview flotante del póster al pasar el mouse por un bloque de función.
- [loadingIndicator.md](ui/loadingIndicator.md) — Badge flotante con estado de carga de sedes secundarias.
- [helpModal.md](ui/helpModal.md) — Modal con catálogo de funciones y atajos de teclado.
- [tour.md](ui/tour.md) — Motor nativo de onboarding con spotlight SVG y navegación paso a paso.

### 5. Interacción y Lógica de Negocio (`docs/interaction/`)
- [filters.md](interaction/filters.md) — Aplicación de filtros combinados (texto + tiempo), ordenamiento dinámico de sedes y conteos.
- [filterLock.md](interaction/filterLock.md) — Máquina de estados para la exclusión mutua entre filtros de carrusel y de formulario.
- [selection.md](interaction/selection.md) — Gestión del itinerario del usuario y cálculo de solapamiento temporal.
- [utils.md](interaction/utils.md) — Utilidades matemáticas de tiempo (minutos ↔ píxeles) y formateo de fechas en español.
- [app.md](interaction/app.md) — Punto de entrada de la aplicación, inicialización y registro de eventos.

### 6. Estilos (`docs/styles/`)
- [styles.md](styles/styles.md) — Organización de hojas de estilo CSS modulares y variables.

---

## ⚡ Reglas Globales de la Arquitectura

1. **Vanilla JavaScript (ES Modules)**: No existen frameworks, transpiladores ni bundlers (`node_modules`, `webpack`, `vite`). Todo se ejecuta directamente en el navegador.
2. **Estado Centralizado (`state.js`)**: Los módulos leen el estado desde `state.js`. No se deben duplicar copias locales permanentes de estado fuera de `state.js`.
3. **Cero Dependencias**: Todas las interacciones (spotlight del tour, tooltips, modales) están implementadas con APIs nativas del navegador.
4. **Idioma**: La interfaz de usuario (`UI`) está en **español**. El código, identificadores y comentarios técnicos están en inglés/español.
