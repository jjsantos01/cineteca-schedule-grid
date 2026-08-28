# Componente: Tour Interactivo Onboarding (`js/tour.js`)

## 📌 Propósito y Resumen
Implementa un motor de tour guiado interactivo de **cero dependencias**. Utiliza un elemento de spotlight animado (`.tour-spotlight`), backdrop protector (`.tour-backdrop-overlay`) y popovers flotantes inteligentes (`.tour-popover`) para explicar las funcionalidades del sitio paso a paso.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `selection.js` (`toggleMovieSelection`, `clearSelection`).
- **Consumido por**: `app.js` (atajos de teclado), `helpModal.js` (botón de lanzamiento).

---

## 🗺️ Pasos del Tour (`TOUR_STEPS`)

1. `.date-selector`: Navegación de días y selector de fecha.
2. `.sedes-selector`: Activación multi-sede (CENART, XOCO, CHAPULTEPEC).
3. `#movieFilter`: Buscador en tiempo real por título.
4. `.filter-group (horas)`: Filtro por ventana de horario.
5. `#shareButton`: Copiar enlace compartible con estado actual.
6. `#posterCarousel`: Exploración y filtrado por pósters.
7. `.sede-container`: Explicación de la cuadrícula, salas y duración.
8. `.movie-block`: Demo interactiva del planificador de itinerario y detección de traslapes.
9. `#helpBtn`: Recordatorio de acceso a la guía y repetición del tour.

---

## ⚙️ API Exportada

### `startTour(options)`
- **Firma**: `startTour(options?: { onComplete?: Function }): void`
- **Descripción**: Inicia el tour en el paso 0, construye el DOM necesario (`createTourDOM`), añade listeners de resize, scroll y teclado (`←`, `→`, `Escape`) y posiciona el spotlight en el primer objetivo.

### `stopTour()`
- **Firma**: `stopTour(): void`
- **Descripción**: Limpia cualquier selección de demostración creada durante el paso 8, remueve el DOM del tour y llama al callback `onComplete` si fue provisto.

### `nextStep()` / `prevStep()`
- **Firma**: `nextStep(): void`, `prevStep(): void`
- **Descripción**: Avanza o retrocede al paso adyacente recalculando dinámicamente las coordenadas del elemento objetivo.

### `isTourActive()`
- **Firma**: `isTourActive(): boolean`
- **Descripción**: Indica si el tour se encuentra en ejecución.
