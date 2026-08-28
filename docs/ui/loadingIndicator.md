# Componente: Indicador Flotante de Carga (`js/loadingIndicator.js`)

## 📌 Propósito y Resumen
Crea y gestiona un badge flotante y no intrusivo (`#loadingIndicator`) en la esquina de la pantalla que informa al usuario cuando una o más sedes secundarias se están descargando en segundo plano mientras el resto de la cartelera ya está visible.

---

## 📦 Dependencias e Interacciones
- **Importado por**: `dataLoader.js` (`showLoadingIndicator`, `hideLoadingIndicator`).
- **Dependencias externas**: Ninguna.

---

## ⚙️ API Exportada

### `showLoadingIndicator(message)`
- **Firma**: `showLoadingIndicator(message: string): void`
- **Descripción**: Crea el elemento `#loadingIndicator` si aún no existe en el DOM, actualiza su texto (ej. `"Cargando datos de: CHAPULTEPEC"`) y lo hace visible (`display: block`).

### `hideLoadingIndicator()`
- **Firma**: `hideLoadingIndicator(): void`
- **Descripción**: Oculta el badge (`display: none`) cuando todas las descargas de sedes han finalizado.
