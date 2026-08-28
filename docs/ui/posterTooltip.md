# Componente: Tooltip Hover de Póster (`js/posterTooltip.js`)

## 📌 Propósito y Resumen
Muestra una vista previa flotante y ligera del póster oficial de la película (`#moviePosterTooltip`) al pasar el cursor del mouse (`mouseover`) sobre cualquier bloque de función en la cuadrícula de horarios, sin bloquear la interacción del usuario.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`POSTER_BASE_URL`, `SEDES`), `utils.js` (`extractFilmId`).
- **Consumido por**: `app.js` (inicializado en `DOMContentLoaded`), `tooltip.js` (`hidePosterTooltip`).

---

## ⚙️ API Exportada

### `initPosterTooltip()`
- **Firma**: `initPosterTooltip(): void`
- **Descripción**: Inicializa la delegación de eventos en `document.body` para `mouseover` y `mouseout` sobre elementos `.movie-block`, y sincroniza su reposicionamiento continuo en eventos de `scroll` y `resize` optimizados con `requestAnimationFrame`.

### `showPosterTooltip(block)`
- **Firma**: `showPosterTooltip(block: HTMLElement): void`
- **Condiciones de Cancelación**:
  - No se muestra si el modal de película, el tooltip interactivo al clic o el tour de onboarding están activos.
- **Comportamiento**:
  - Extrae el `filmId` del bloque y carga la imagen desde `POSTER_BASE_URL`.
  - Muestra badge con color de la sede, horario y duración.
  - Posiciona la tarjeta flotante con preferencia arriba del bloque (con fallback abajo).

### `hidePosterTooltip()`
- **Firma**: `hidePosterTooltip(): void`
- **Descripción**: Oculta la vista previa y cancela frames de animación pendientes.

### `positionPosterTooltip(tooltip, block)`
- **Firma**: `positionPosterTooltip(tooltip: HTMLElement, block: HTMLElement): void`
- **Descripción**: Calcula coordenadas `top` y `left` en píxeles ajustadas a los límites de la ventana visual (`window.visualViewport`).
