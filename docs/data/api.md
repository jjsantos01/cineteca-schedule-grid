# Módulo: Cliente API (`js/api.js`)

## 📌 Propósito y Resumen
Encapsula la comunicación de red con el proxy Cloudflare Worker de la Cineteca Nacional (`cinetkv2`). Descarga la cartelera del día para una sede específica y canaliza la respuesta hacia el parser.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`API_BASE_URL`, `getAPIVersion`), `utils.js` (`formatDateForAPI`), `parser.js` (`parseMovieData`).
- **Consumido por**: `dataLoader.js:loadSedeData`.

---

## 🌐 Endpoint del Proxy

```
GET https://cinetkv2.jjsantosochoa.workers.dev/{version}?cinemaId={cinemaId}&dia={fecha}
```
- `{version}`: `v1` o `v2` (obtenido con `getAPIVersion()`).
- `{cinemaId}`: ID de sede (`001`, `002`, `003`).
- `{fecha}`: Formato `YYYY-MM-DD`.

*Para detalles de arquitectura, CORS, endpoints completos y despliegue del worker con Wrangler, consulta [Cloudflare Worker (`cinetkv2`)](../infrastructure/worker.md).*

---

## ⚙️ API Exportada

### `fetchMoviesForSede(sedeId, date)`
- **Firma**: `async fetchMoviesForSede(sedeId: string, date: Date): Promise<Array<Movie>>`
- **Flujo de Ejecución**:
  1. Formatea la fecha a `YYYY-MM-DD`.
  2. Construye la URL del proxy reemplazando `{version}`, `{cinemaId}` y `{fecha}`.
  3. Realiza la petición con `fetch()`.
  4. Extrae `data.data` del JSON recibido.
  5. Itera sobre cada elemento y lo procesa mediante `parseMovieData(item, sedeId, item.href, item.ticketUrls)`.
  6. Retorna la lista de películas normalizadas.
- **Manejo de Errores**: En caso de error de red o respuesta inválida, captura la excepción, registra el error en consola y retorna un arreglo vacío `[]` para no bloquear otras sedes.
