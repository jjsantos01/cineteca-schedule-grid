# Módulo: Configuración y Constantes (`js/config.js`)

## 📌 Propósito y Resumen
Centraliza las constantes globales de la aplicación: catálogo de sedes de la Cineteca Nacional, dimensiones de renderizado del timeline, URLs base del proxy y endpoints de la API, claves de LocalStorage y límites de retención de caché.

---

## 📦 Dependencias e Interacciones
- **Importado por**: `app.js`, `api.js`, `apiCache.js`, `cache.js`, `dataLoader.js`, `filters.js`, `grid.js`, `posterTooltip.js`, `showtimes.js`, `tooltip.js`, `urlState.js`, `visited.js`.
- **Dependencias externas**: Ninguna.

---

## 🏛️ Catálogo de Sedes (`SEDES`)

Objeto indexado por el ID oficial de la sede (`cinemaId`):

```javascript
export const SEDES = {
    '001': {
        nombre: 'CHAPULTEPEC',
        codigo: 'CNCH',
        color: '#28714f',      // Verde Cineteca Chapultepec
        className: 'chapultepec'
    },
    '002': {
        nombre: 'CENART',
        codigo: 'CNA',
        color: '#642f90',      // Morado Cineteca de las Artes
        className: 'cenart'
    },
    '003': {
        nombre: 'XOCO',
        codigo: 'XOCO',
        color: '#eb1c23',      // Rojo Cineteca México Xoco
        className: 'xoco'
    }
};
```

---

## ⚙️ Constantes y Endpoints Exportados

| Constante / Función | Valor / Tipo | Propósito |
|---|---|---|
| `HOUR_WIDTH` | `120` (px) | Ancho en píxeles que representa una hora (60 minutos) en la cuadrícula del timeline. |
| `POSTER_BASE_URL` | `'https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic'` | URL base para descargar imágenes de pósters oficiales de Cineteca mediante `FilmId`. |
| `DEFAULT_API_VERSION` | `'v1'` | Versión de API por defecto para el proxy. |
| `getAPIVersion()` | Función `() => 'v1' \| 'v2'` | Permite alternar la versión de API vía query param `?api=v2`. |
| `API_BASE_URL` | `'https://cinetkv2.jjsantosochoa.workers.dev/{version}?cinemaId={cinemaId}&dia={fecha}'` | Endpoint del proxy Cloudflare Workers para carteleras. |
| `MOVIE_DETAILS_API_URL` | `'https://cinetkv2.jjsantosochoa.workers.dev/movie-details?filmId={filmId}'` | Endpoint para obtener ficha técnica completa, póster HD y tráiler. |
| `SELECTED_SEDES_KEY` | `'cinetkSelectedSedes'` | Clave de LocalStorage para recordar sedes seleccionadas. |
| `VISITED_MOVIES_KEY` | `'cinetkVisitedMovies'` | Clave de LocalStorage para recordar películas visitadas. |
| `MAX_CACHE_DAYS` | `7` | Días máximos de retención para la caché en memoria/almacenamiento. |
| `DEFAULT_SEDES` | `['003']` | Sedes activadas por defecto si el usuario entra sin preferencias guardadas (XOCO). |

---

## 💡 Guía para Desarrolladores / Agentes
- **Agregar una nueva sede**:
  1. Agregar la entrada en `SEDES` con su ID de 3 dígitos, `nombre`, `codigo`, `color` y `className`.
  2. Agregar el checkbox en `index.html` con su respectivo ID.
  3. Vincular el listener en `app.js:setupEventListeners`.
  4. Agregar el estilo temático en `css/variables.css` y `css/grid.css`.
