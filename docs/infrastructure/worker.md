# Infraestructura: Cloudflare Workers (`cinetkv2` & `cinetk` R2)

## 📌 Propósito y Rol del Worker
Dado que el sitio web de **Cineteca Schedule Grid** es una aplicación estática (Single Page Application sin backend propio alojada en GitHub Pages / servidor estático), no puede consultar directamente los servidores de la Cineteca Nacional debido a restricciones de **CORS (Cross-Origin Resource Sharing)** y diferencias en el formato de datos.

El ecosistema de Cloudflare Workers del proyecto se compone de dos variantes:
1. **`cinetkv2` (Live Scraping Proxy - Producción Legacy)**: Consulta y extrae datos en vivo de la Cineteca en cada petición (o con 10 min de caché en el Edge).
2. **`cinetk` (Persistent R2 & Cron Trigger Pipeline - Nueva Arquitectura Ultrarrápida)**: Precalcula todas las carteleras de los próximos 7 días y persiste fichas técnicas y funciones en **Cloudflare R2**, ejecutando un Cron Trigger cada hora entre 8:00 AM y 9:00 PM CDMX. Reduce la latencia a **10 - 25 ms**.

---

## 🌐 Endpoints Provistos por los Workers

URL Base de producción actual (`cinetkv2`): `https://cinetkv2.jjsantosochoa.workers.dev`  
URL Base nueva (`cinetk`): `https://cinetk.jjsantosochoa.workers.dev`

### 1. Cartelera por Sede y Fecha
- **Ruta Estándar**: `GET /v2?cinemaId={cinemaId}&dia={fecha}`
- **Rutas de Compatibilidad**: `GET /v1`, `GET /` (sirven internamente los datos de `v2`).
- **Parámetros**:
  - `cinemaId`: `001` (Chapultepec), `002` (CENART), `003` (XOCO).
  - `dia`: Fecha en formato `YYYY-MM-DD`.
- **En `cinetk`**: Lee directamente de `schedules/v2/{cinemaId}/{dia}.json` en R2. Las salas físicas se resuelven con 100% de exactitud mediante el caché inmutable de sesiones (`meta/session-rooms.json`, Opción C). Si no existe, realiza scraping on-demand y guarda en R2 en segundo plano.

### 2. Ficha Técnica y Multimedia de Película
- **Ruta**: `GET /movie-details?filmId={filmId}`
- **Parámetros**:
  - `filmId`: Identificador único de la película en el sistema de Cineteca (ej. `HO00009798`).
- **En `cinetk`**: Lee de `movies/{filmId}.json` en R2. Si no existe, lo descarga una sola vez y lo persiste.

### 3. Estado del Servicio y Sincronización
- **Ruta**: `GET /health`
- **Respuesta en `cinetk`**:
  ```json
  {
    "status": "ok",
    "worker": "cinetk",
    "architecture": "r2_persisted_cron_cache",
    "storage": "connected",
    "lastSync": "2026-09-03T18:00:00.000Z",
    "durationMs": 3420,
    "activeMoviesCount": 58,
    "activeDates": ["2026-09-03", "2026-09-04", ...],
    "totalSessionRooms": 412,
    "versions": ["v2"],
    "defaultVersion": "v2"
  }
  ```

### 4. Sincronización Manual (Admin)
- **Ruta**: `GET /admin/sync?token={ADMIN_TOKEN}` o `POST /admin/sync`
- Ejecuta el pipeline completo de sincronización de forma manual sin esperar al cron trigger.

### 5. Prueba de Notificaciones por Telegram (Admin)
- **Ruta**: `GET /admin/test-telegram?token={ADMIN_TOKEN}`
- Envía un mensaje de prueba al chat de Telegram configurado mediante los secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

---


## 🛠️ Gestión y Despliegue con Wrangler (Cloudflare CLI)

### 1. Requisitos Previos e Instalación
- **Node.js** (v18 o superior) y **npm**.
- Una cuenta en **Cloudflare** con permisos de Workers y R2.
```bash
# Autenticar Wrangler con Cloudflare
npx wrangler login
```

### 2. Creación del Bucket R2 (Solo una vez)
Antes de desplegar `cinetk`, crea el bucket de almacenamiento en tu cuenta de Cloudflare:
```bash
npx wrangler r2 bucket create cinetk-storage
npx wrangler r2 bucket create cinetk-storage-preview
```

---

## ⚙️ Configuración en `wrangler.toml`

Configuración recomendada para `cinetk` (`worker/wrangler.toml`):

```toml
name = "cinetk"
main = "cinetk.js"
compatibility_date = "2026-08-22"

[observability]
enabled = true

# Cloudflare R2 Storage Binding
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "cinetk-storage"
preview_bucket_name = "cinetk-storage-preview"

# Cron Trigger: Ejecuta cada hora en punto entre 8:00 AM y 9:00 PM CDMX (UTC-6 -> 14:00 a 03:00 UTC)
[triggers]
crons = ["0 14-23,0-3 * * *"]
```

---

## 💻 Desarrollo y Pruebas Locales

Para levantar el worker localmente con simulación de R2 (Miniflare) y soporte de cron triggers:

```bash
# Iniciar servidor local en http://localhost:8787
npx wrangler dev --test-scheduled
```

### Pruebas de Endpoints y Cron Trigger:
```bash
# 1. Disparar ejecución manual del Cron Trigger en local
curl "http://localhost:8787/__scheduled?cron=0+14+*+*+*"

# 2. Consultar cartelera (servida desde R2 simulado)
curl "http://localhost:8787/v2?cinemaId=003&dia=2026-08-31"

# 3. Consultar ficha técnica
curl "http://localhost:8787/movie-details?filmId=HO00009798"

# 4. Verificar estado de sincronización
curl "http://localhost:8787/health"
```

---

## 🚀 Despliegue a Producción

Para publicar el nuevo worker `cinetk` a la red global de Cloudflare:

```bash
npx wrangler deploy
```

El worker quedará disponible en:
`https://cinetk.<tu-subdominio>.workers.dev`

### Monitoreo de Logs en Vivo
Para inspeccionar ejecuciones del cron trigger y peticiones de usuarios en tiempo real:
```bash
npx wrangler tail
```

