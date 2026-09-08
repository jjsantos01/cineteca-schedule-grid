# Infraestructura: Cloudflare Workers (`cinetkv2` & `cinetk` R2)

## 📌 Propósito y Rol del Worker
Dado que el sitio web de **Cineteca Schedule Grid** es una aplicación estática (Single Page Application sin backend propio alojada en GitHub Pages / servidor estático), no puede consultar directamente los servidores de la Cineteca Nacional debido a restricciones de **CORS (Cross-Origin Resource Sharing)** y diferencias en el formato de datos.

El ecosistema de Cloudflare Workers del proyecto se compone de dos variantes:
1. **`cinetkv2` (Live Scraping Proxy - Producción Legacy)**: Consulta y extrae datos en vivo de la Cineteca en cada petición (o con 10 min de caché en el Edge).
2. **`cinetk` (Persistent R2 & Cron Trigger Pipeline - Nueva Arquitectura Ultrarrápida)**: Precalcula todas las carteleras de los próximos 7 días y persiste fichas técnicas y funciones en **Cloudflare R2**, ejecutando un Cron Trigger cada hora entre 8:00 AM y 9:00 PM CDMX. Reduce la latencia a **10 - 25 ms**.

---

## 🌐 Endpoints Provistos por el Worker

URL Base (`cinetk`): `https://cinetk.jjsantosochoa.workers.dev`

### 1. Feed Consolidado de Películas y Funciones
- **Ruta Estándar**: `GET /feed`
- **Ruta Alias**: `GET /`
- **Cabeceras de Respuesta**:
  - `Content-Type: application/json; charset=utf-8`
  - `Cache-Control: public, max-age=300, s-maxage=3600`
- **En `cinetk`**: Lee directamente de `feed/consolidated.json` en R2. Contiene el catálogo completo de películas desduplicadas (`movies`) y los horarios compactos (`schedules[date][sede]`) para los próximos 7 días en las 3 sedes en una sola respuesta de ~35–45 KB comprimida (transferencia en 10–25 ms). Si por alguna razón no existe aún en R2, compila el feed on-demand a partir de los datos existentes y lo persiste.

### 2. Estado del Servicio y Sincronización
- **Ruta**: `GET /health`
- **Respuesta en `cinetk`**:
  ```json
  {
    "status": "ok",
    "worker": "cinetk",
    "architecture": "r2_persisted_cron_cache",
    "storage": "connected",
    "lastSync": "2026-09-07T18:00:00.000Z",
    "durationMs": 3420,
    "activeMoviesCount": 66,
    "activeDates": ["2026-09-07", "2026-09-08", ...],
    "totalSessionRooms": 408,
    "feed": {
      "updatedAt": "2026-09-07T18:00:00.000Z",
      "movieCount": 66,
      "dateCount": 8
    }
  }
  ```

### 3. Sincronización Manual (Admin)
- **Ruta**: `GET /admin/sync?token={ADMIN_TOKEN}` o `POST /admin/sync`
- Ejecuta el pipeline completo de sincronización de forma manual sin esperar al cron trigger (Fases 1 a 5, compilando y persistiendo `feed/consolidated.json`).

### 4. Resolución Autónoma de Salas en Cascada (Admin)
- **Ruta**: `POST /admin/resolve-rooms?token={ADMIN_TOKEN}` o `GET /admin/resolve-rooms`
- **Propósito**: Resuelve las salas físicas faltantes en lotes seguros de 25 sesiones por invocación para mantenerse siempre por debajo del límite de 50 subrequests de Cloudflare Workers.
- **Mecanismo**: Si tras resolver el lote aún quedan sesiones pendientes (típico en cold starts o inicios de semana), se auto-invoca de forma asíncrona (`ctx.waitUntil`) hacia sí mismo. Cada llamada entrante crea una nueva invocación con 50 subrequests frescos. Al completar el 100% de las salas, regenera automáticamente `feed/consolidated.json`.

### 5. Prueba de Notificaciones por Telegram (Admin)
- **Ruta**: `GET /admin/test-telegram?token={ADMIN_TOKEN}`
- Envía un mensaje de prueba al chat de Telegram configurado mediante los secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

---

## 📂 Arquitectura Modular de Código (`worker/src/`)

Para optimizar el mantenimiento y facilitar que agentes de IA descubran y editen funciones específicas sin sobrecargar su contexto, el código de `cinetk` está organizado en módulos ES bajo `worker/src/`:

```
worker/
├── wrangler.toml              # Configuración y bindings (STORAGE, Cron)
├── DATA.md                    # Diccionario de datos y especificación de endpoints
├── README.md                  # Guía de arquitectura y mapa de navegación para agentes
├── cinetk.js                  # Entry point minimalista (~85 líneas): handlers fetch y scheduled
└── src/
    ├── config.js              # Constantes (sedes, CORS, TTL, días sync)
    ├── handlers.js            # Handlers HTTP (/feed, /health, /admin)
    ├── pipeline.js            # Orquestador del Cron Pipeline (Fases 1 a 5)
    ├── storage.js             # Operaciones R2 y Garbage Collector
    ├── scrapers.js            # Peticiones upstream a Cineteca y Vista Ticketing
    ├── parsers.js             # Parsers de HTML, RegEx y normalización
    ├── notifications.js       # Integración de alertas Telegram
    └── utils.js               # Fechas CDMX, ordenamiento de salas, JSON helper
```

| Módulo | Responsabilidad | Funciones Clave |
|---|---|---|
| [`cinetk.js`](../../worker/cinetk.js) | Entry point & dispatcher | `default { fetch, scheduled }` |
| [`src/config.js`](../../worker/src/config.js) | Configuración y constantes | `CORS_HEADERS`, `SEDE_CODES`, `SEDE_NAMES`, `ALL_SEDES` |
| [`src/handlers.js`](../../worker/src/handlers.js) | Manejadores de rutas HTTP | `handleFeed`, `handleHealth`, `handleAdminSync`, `handleResolveRooms`, `handleTestTelegram` |
| [`src/pipeline.js`](../../worker/src/pipeline.js) | Cron Pipeline (Fases 1 a 5) | `runSyncPipeline` |
| [`src/storage.js`](../../worker/src/storage.js) | Persistencia R2 y GC | `getStoredJson`, `putStoredJson`, `getSessionRoomsMap`, `saveSessionRoomsMap`, `purgeObsoleteMovies` |
| [`src/scrapers.js`](../../worker/src/scrapers.js) | Conexión upstream y scraping | `fetchVistaCinemasDetails`, `fetchCarteleraDurationsMap`, `fetchMissingSessionRooms`, `scrapeMovieDetails` |
| [`src/parsers.js`](../../worker/src/parsers.js) | Parsers RegEx y extracción HTML | `parseVistaSessions`, `parseCarteleraDurations`, `parseMovieDetailsHtml` |
| [`src/notifications.js`](../../worker/src/notifications.js) | Alertas Telegram | `sendTelegramNotification` |
| [`src/utils.js`](../../worker/src/utils.js) | Fechas CDMX, salas, JSON helper | `getCdmxDate`, `getTodayDateString`, `assignOutdoorOrSpecialLanes`, `sortMoviesBySala` |

Para más detalles sobre cómo interactúa cada módulo, consulta [`worker/README.md`](../../worker/README.md) y [`worker/DATA.md`](../../worker/DATA.md).

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

# 2. Consultar feed consolidado (servido desde R2 simulado)
curl "http://localhost:8787/feed"

# 3. Verificar estado de sincronización
curl "http://localhost:8787/health"
```

### 4. Inicialización Rápida y Cold-Start CLI (`scripts/seed-rooms.mjs`)
Para pre-poblar o regenerar instantáneamente todas las salas físicas (~300-400 sesiones) sin depender de subrequests del worker:

```bash
# 1. Resolver todas las salas concurrentemente en local (~7 segundos)
node scripts/seed-rooms.mjs

# 2. Subir directamente al bucket de preview (wrangler dev)
node scripts/seed-rooms.mjs --upload-preview

# 3. Subir directamente al bucket de producción (cinetk-storage)
node scripts/seed-rooms.mjs --upload-remote
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

