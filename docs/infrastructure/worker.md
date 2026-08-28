# Infraestructura: Cloudflare Worker (`cinetkv2`)

## 📌 Propósito y Rol del Worker
Dado que el sitio web de **Cineteca Schedule Grid** es una aplicación estática (Single Page Application sin backend propio alojada en GitHub Pages / servidor estático), no puede consultar directamente los servidores de la Cineteca Nacional debido a restricciones de **CORS (Cross-Origin Resource Sharing)** y diferencias en el formato de datos.

El **Cloudflare Worker** actúa como un proxy/API intermedio serverless que:
1. Resuelve las cabeceras CORS (`Access-Control-Allow-Origin: *`).
2. Consume y normaliza las respuestas y páginas HTML/JSON de la Cineteca Nacional.
3. Entrega una estructura de datos JSON estandarizada y limpia (`v1` y `v2`) para la cuadrícula y fichas técnicas.

---

## 🌐 Endpoints Provistos por el Worker

URL Base de producción: `https://cinetkv2.jjsantosochoa.workers.dev`

### 1. Cartelera por Sede y Fecha
- **Ruta**: `GET /{version}?cinemaId={cinemaId}&dia={fecha}`
- **Parámetros**:
  - `{version}`: `v1` (formato base) o `v2` (incluye sesiones y enriquecimiento `allShowtimes`).
  - `cinemaId`: `001` (Chapultepec), `002` (CENART), `003` (XOCO).
  - `dia`: Fecha en formato `YYYY-MM-DD`.
- **Respuesta típica**:
  ```json
  {
    "data": [
      {
        "titulo": "Dune: Part Two",
        "duracion": 166,
        "sala": "1",
        "sede": "XOCO",
        "sedeId": "003",
        "sedeCodigo": "XOCO",
        "horarios": ["16:00", "20:00"],
        "ticketUrls": {
          "16:00": "https://..."
        },
        "filmId": "12345",
        "posterUrl": "https://...",
        "tipoVersion": "SUB"
      }
    ]
  }
  ```

### 2. Ficha Técnica y Multimedia de Película
- **Ruta**: `GET /movie-details?filmId={filmId}`
- **Parámetros**:
  - `filmId`: Identificador único de la película en el sistema de Cineteca.
- **Respuesta típica**:
  ```json
  {
    "info": [
      "Francia, 2023, 151 mins. Dir. Justine Triet",
      "Guión: Justine Triet, Arthur Harari. Fotografía: Simon Beaufils. Con: Sandra Hüller...",
      "Sinopsis: Samuel es encontrado muerto en la nieve afuera del chalet aislado donde vivía..."
    ],
    "posterUrl": "https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic/12345...",
    "trailerUrl": "https://www.youtube.com/watch?v=...",
    "showtimes": [ ... ]
  }
  ```

---

## 🛠️ Gestión y Despliegue con Wrangler (Cloudflare CLI)

Aunque el código fuente del Worker vive en su propio repositorio o módulo privado, su administración y despliegue se realiza mediante la herramienta oficial **Wrangler**.

### 1. Requisitos Previos
- **Node.js** (v18 o superior) y **npm**.
- Una cuenta en **Cloudflare** con permisos de Workers.

### 2. Instalación de Wrangler
Puedes instalarlo globalmente o ejecutarlo mediante `npx`:
```bash
# Instalación global (opcional)
npm install -g wrangler

# Verificar instalación
npx wrangler --version
```

### 3. Autenticación con Cloudflare
Para conectar tu terminal a tu cuenta de Cloudflare:
```bash
npx wrangler login
```
*Esto abrirá una pestaña del navegador para autorizar la sesión en Cloudflare.*

Si se ejecuta en entornos de CI/CD (GitHub Actions), se debe configurar la variable de entorno:
```bash
export CLOUDFLARE_API_TOKEN="tu_token_de_cloudflare"
```

---

## ⚙️ Estructura del Proyecto Worker y `wrangler.toml`

Un worker típico para este proxy utiliza la siguiente configuración base en `wrangler.toml`:

```toml
name = "cinetkv2"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Opcional: Configuración de límites o variables de entorno
[vars]
ENVIRONMENT = "production"
UPSTREAM_CINETECA_BASE = "https://www.cinetecanacional.net"
```

---

## 💻 Desarrollo y Pruebas Locales

Para levantar el worker en un entorno local que simule la red perimetral de Cloudflare:

```bash
# Iniciar servidor local de desarrollo (por defecto en http://localhost:8787)
npx wrangler dev
```

Puedes probar los endpoints localmente:
```bash
# Probar cartelera Xoco para hoy
curl "http://localhost:8787/v1?cinemaId=003&dia=2026-08-28"

# Probar detalle de película
curl "http://localhost:8787/movie-details?filmId=12345"
```

Para probar el frontend apuntando a tu worker local:
1. En [`js/config.js`](file:///C:/Users/jjsan/.gemini/antigravity/worktrees/cineteca-schedule-grid/create_agent_accessible_docs/js/config.js), cambia temporalmente `API_BASE_URL` a:
   `http://localhost:8787/{version}?cinemaId={cinemaId}&dia={fecha}`
2. Cambia `MOVIE_DETAILS_API_URL` a:
   `http://localhost:8787/movie-details?filmId={filmId}`

---

## 🚀 Despliegue a Producción

Para publicar una nueva versión del worker en la red global de Cloudflare:

```bash
npx wrangler deploy
```

El comando compilará el código y desplegará en la URL asignada:
`https://cinetkv2.<tu-subdominio>.workers.dev`

### Monitoreo y Logs en Vivo
Para inspeccionar peticiones, errores y logs en tiempo real mientras el frontend consulta el worker:
```bash
npx wrangler tail
```

---

## 🛡️ Buenas Prácticas y Políticas de Caché
1. **Cabeceras CORS**: El worker debe responder a peticiones `OPTIONS` (preflight) y añadir siempre:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
   - `Access-Control-Max-Age: 86400`
2. **Caché en el Edge (`Cache-Control`)**:
   - Carteleras del día: `Cache-Control: public, max-age=300` (5 minutos en caché perimetral).
   - Detalles de películas (`/movie-details`): `Cache-Control: public, max-age=3600` (1 hora, ya que sinopsis y directores rara vez cambian durante el día).
3. **Manejo de Errores Upstream**: Si el sitio de la Cineteca presenta lentitud o caídas, el worker debe responder con código `502` o retornar un payload vacío estructurado `{ data: [] }` para evitar que el frontend colapse.
