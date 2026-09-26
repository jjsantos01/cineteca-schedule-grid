# Componente: Tour Interactivo Onboarding (`js/tour.js`)

## 📌 Propósito y Resumen
Implementa un motor de tour guiado interactivo de **cero dependencias**. Utiliza un elemento de spotlight animado (`.tour-spotlight`), backdrop protector (`.tour-backdrop-overlay`) y popovers flotantes inteligentes (`.tour-popover`) para explicar las funcionalidades del sitio paso a paso.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `selection.js` (`toggleMovieSelection`, `clearSelection`).
- **Consumido por**: `app.js` (atajos de teclado), `helpModal.js` (botón de lanzamiento).

---

## 🗺️ Pasos del Tour (`TOUR_STEPS`)

1. `.view-switch`: Selector de Vista (Día o Semana) para elegir cómo explorar la cartelera.
2. `.date-selector`: Navegación de días y selector de fecha.
3. `.sedes-selector`: Activación multi-sede (CENART, XOCO, CHAPULTEPEC).
4. `#movieFilter`: Buscador en tiempo real por título.
5. `.filter-group (horas)`: Filtro por ventana de horario.
6. `#shareButton`: Copiar enlace compartible con estado actual.
7. `#posterCarousel`: Exploración y filtrado por pósters.
8. `.sede-container`: Explicación de la cuadrícula, salas y duración.
9. `.movie-block`: Demo interactiva del planificador de itinerario y detección de traslapes.
10. `#helpBtn`: Recordatorio de acceso a la guía y repetición del tour.

---

## 🔄 Transición Automática a Modo Día
Cuando el usuario inicia el tour en modo semanal (`state.viewMode !== 'day'`), el primer paso destaca `.view-switch` en su posición actual. Al continuar hacia los siguientes pasos (`index > 0`) correspondientes a la ruta diaria, la función `ensureDayMode()` conmuta automáticamente la aplicación al modo diario (`document.getElementById('viewModeDay')?.click()`). Esto garantiza que `#dateSelector`, `.sede-container` y los bloques de película estén visibles, montados en el DOM y listos para ser resaltados por el tour sin fallar ni romperse.

---

## ⚙️ API Exportada

### `startTour(options)`
- **Firma**: `startTour(options?: { onComplete?: Function }): void`
- **Descripción**: Inicia el tour en el paso 0, construye el DOM necesario (`createTourDOM`), añade listeners de resize, scroll y teclado (`←`, `→`, `Escape`) y posiciona el spotlight en el primer objetivo (`.view-switch`).

### `stopTour()`
- **Firma**: `stopTour(): void`
- **Descripción**: Limpia cualquier selección de demostración creada durante el paso 8, remueve el DOM del tour y llama al callback `onComplete` si fue provisto.

### `nextStep()` / `prevStep()`
- **Firma**: `nextStep(): void`, `prevStep(): void`
- **Descripción**: Avanza o retrocede al paso adyacente recalculando dinámicamente las coordenadas del elemento objetivo.

### `ensureDayMode()`
- **Firma**: `ensureDayMode(): void`
- **Descripción**: Conmuta la aplicación a la vista por día si actualmente se encuentra en modo semanal u otro modo.

### `isTourActive()`
- **Firma**: `isTourActive(): boolean`
- **Descripción**: Indica si el tour se encuentra en ejecución.

### `TOUR_STEPS`
- **Firma**: `const TOUR_STEPS: Array<TourStep>`
- **Descripción**: Arreglo ordenado con la definición de pasos, objetivos DOM, textos y posicionamiento.
