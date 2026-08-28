# Componente: Modal de Ayuda y Guía (`js/helpModal.js`)

## 📌 Propósito y Resumen
Gestiona el modal accesible de ayuda (`#helpModal`) que contiene la guía explicativa de todas las herramientas de la aplicación (selector de fechas, multi-sede, filtros, itinerario, carrusel, enlaces a calendarios, atajos de teclado) y el botón para lanzar el tour guiado interactivo.

---

## 📦 Dependencias e Interacciones
- **Importa**: `tour.js` (`startTour`).
- **Consumido por**: `app.js` (inicialización, atajos de teclado).

---

## ⚙️ API Exportada

### `initHelpModal()`
- **Firma**: `initHelpModal(): void`
- **Descripción**: Asigna eventos de clic para abrir (`#helpBtn`), cerrar (`#helpModalClose`, clic fuera) e iniciar el tour (`#startTourFromModalBtn`). Escucha las teclas `?` o `F1` para abrir la ayuda y `Escape` para cerrarla.

### `openHelpModal()`
- **Firma**: `openHelpModal(): void`
- **Descripción**: Muestra el modal (`display: flex`), bloquea el scroll del cuerpo de la página (`body.style.overflow = 'hidden'`) y enfoca el botón de acción principal para accesibilidad.

### `closeHelpModal()`
- **Firma**: `closeHelpModal(): void`
- **Descripción**: Oculta el modal y restaura el scroll.

### `isHelpModalOpen()`
- **Firma**: `isHelpModalOpen(): boolean`
- **Descripción**: Retorna `true` si el modal de ayuda está visible actualmente.
