# Módulo: Cliente API (`js/api.js`)

## 📌 Propósito y Resumen
Encapsula la comunicación de red con el Worker `cinetk`. Descarga en una sola llamada HTTP el feed consolidado semanal que contiene toda la programación de las 3 sedes para 7-8 días y el catálogo completo de películas con sus fichas técnicas.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`API_FEED_URL`).
- **Consumido por**: `dataLoader.js:ensureFeedLoaded`.

---

## 🌐 Endpoint del Feed

```
GET https://cinetk.jjsantosochoa.workers.dev/feed
```
- Devuelve el JSON consolidado semanal con cabeceras `Cache-Control: public, max-age=300, s-maxage=3600`.
- Para detalles de arquitectura, CORS y despliegue del worker con Wrangler, consulta [Cloudflare Worker (`cinetk`)](../infrastructure/worker.md).
- Para el desglose exhaustivo de las fuentes upstream de Cineteca (usadas vs. no usadas/reserva) y contratos JSON completos, consulta [Diccionario de Datos y Fuentes](../../worker/DATA.md).

### 📡 Resumen de Fuentes Upstream que Alimentan el Feed
- **🟢 Usadas en Producción:**
  - `obtener_cartelera.php`: **Fuente primaria única** que consolida en **1 sola llamada HTTP** el catálogo semanal completo, horarios de las 3 sedes, `clasificacion`, `event_code` y el mapeo completo de ciclos/eventos con pósters deterministas en Vista CDN (`EventPosterGraphic/${id}`).
  - `detallePelicula.php?FilmId={id}&cinemaId=000`: Ficha técnica completa, sinopsis, trailers y **todas las salas físicas de la semana** en 1 sola llamada por película (hidratación inmutable).
  - `data/cartelera.php`: Duraciones oficiales en minutos y país/año (1 llamada diaria).
  - Vista CDN: Pósters y stills en alta resolución.
- **🟡 Fallback de Emergencia / Reserva:**
  - `Browsing/Cinemas/Details/{cinemaId}`: Preservado como **fallback de emergencia** si `obtener_cartelera.php` llegara a fallar o devolver un catálogo vacío.
  - `visSelectTickets.aspx`: Reservada estrictamente como **fallback** de emergencia para sesiones huérfanas (1 req/sesión; no se usa en la rutina horaria para no exceder los límites de subrequests).
  - `QuickTickets/*`: Descartada por requerir sesión de navegación interactiva ASP.NET.

---

## ⚙️ API Exportada

### `fetchConsolidatedFeed(forceRefresh = false)`
- **Firma**: `async fetchConsolidatedFeed(forceRefresh?: boolean): Promise<Object>`
- **Flujo de Ejecución**:
  1. Si existe una promesa en vuelo o el feed ya fue solicitado (y `forceRefresh` es `false`), reutiliza la promesa en curso.
  2. Realiza la petición con `fetch(API_FEED_URL)`.
  3. Deserializa el JSON con `activeDates`, `sedes`, `ciclos`, `movies` (con `clasificacion` y `ciclos: [id, ...]`) y `schedules`.
  4. Retorna el objeto del feed consolidado.
- **Manejo de Errores**: En caso de error de red o respuesta HTTP no exitosa, limpia la referencia de la promesa en vuelo, registra el error en consola y propaga la excepción hacia `dataLoader.js` para manejo de errores en la UI.

