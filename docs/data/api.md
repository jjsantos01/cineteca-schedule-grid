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

---

## ⚙️ API Exportada

### `fetchConsolidatedFeed(forceRefresh = false)`
- **Firma**: `async fetchConsolidatedFeed(forceRefresh?: boolean): Promise<Object>`
- **Flujo de Ejecución**:
  1. Si existe una promesa en vuelo o el feed ya fue solicitado (y `forceRefresh` es `false`), reutiliza la promesa en curso.
  2. Realiza la petición con `fetch(API_FEED_URL)`.
  3. Deserializa el JSON con `activeDates`, `sedes`, `movies` y `schedules`.
  4. Retorna el objeto del feed consolidado.
- **Manejo de Errores**: En caso de error de red o respuesta HTTP no exitosa, limpia la referencia de la promesa en vuelo, registra el error en consola y propaga la excepción hacia `dataLoader.js` para manejo de errores en la UI.

