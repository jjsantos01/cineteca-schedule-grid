# Cloudflare Worker: `cinetk` — Guía de Arquitectura Modular y Navegación para Agentes

El worker **`cinetk`** implementa la arquitectura asíncrona de persistencia en **Cloudflare R2** para la aplicación **Cineteca Schedule Grid**. Precalcula y enriquece las carteleras de 7 días de todas las sedes mediante un Cron Trigger cada hora y sirve las peticiones con latencia ultra baja (< 25 ms) mediante Read-Through Cache.

---

## 🗺️ Mapa de Navegación Rápida para Agentes de IA

Si eres un agente de IA buscando modificar o inspeccionar una funcionalidad, consulta esta tabla para saber exactamente qué archivo abrir sin consumir contexto innecesario:

| Si tu tarea consiste en... | Módulo a consultar | Ubicación | Funciones Clave |
|---|---|---|---|
| **Añadir o modificar rutas HTTP o headers CORS** | `handlers.js` / `cinetk.js` | [`src/handlers.js`](src/handlers.js) | `handleHealth`, `handleScheduleRequest`, `handleMovieDetails`, `handleAdminSync`, `handleTestTelegram` |
| **Ajustar el flujo o fases del Cron Trigger** | `pipeline.js` | [`src/pipeline.js`](src/pipeline.js) | `runSyncPipeline` (Fases 1 a 5) |
| **Modificar lectura/escritura en R2 o Garbage Collector** | `storage.js` | [`src/storage.js`](src/storage.js) | `getStoredJson`, `putStoredJson`, `getSessionRoomsMap`, `saveSessionRoomsMap`, `purgeObsoleteMovies`, `purgeExpiredSchedules`, `purgeExpiredSessions` |
| **Modificar scraping de cartelera, sesiones o boletos** | `scrapers.js` | [`src/scrapers.js`](src/scrapers.js) | `fetchVistaCinemasDetails`, `fetchCarteleraDurationsMap`, `fetchSingleSessionRoom`, `fetchMissingSessionRooms`, `scrapeMovieDetails`, `getSchedule` |
| **Ajustar expresiones regulares o extracción HTML** | `parsers.js` | [`src/parsers.js`](src/parsers.js) | `parseVistaSessions`, `parseCarteleraDurations`, `parseMovieDetailsHtml` |
| **Modificar constantes de sedes o configuración** | `config.js` | [`src/config.js`](src/config.js) | `CORS_HEADERS`, `SEDE_CODES`, `SEDE_NAMES`, `ALL_SEDES`, `SYNC_DAYS_AHEAD` |
| **Ajustar alertas o notificaciones de fallos** | `notifications.js` | [`src/notifications.js`](src/notifications.js) | `sendTelegramNotification` |
| **Ajustar lógica de fechas CDMX, orden o carriles de Foro** | `utils.js` | [`src/utils.js`](src/utils.js) | `getCdmxDate`, `getTodayDateString`, `getNextDatesList`, `assignOutdoorOrSpecialLanes`, `sortMoviesBySala`, `jsonResponse` |
| **Consultar diccionario de datos y esquemas de persistencia** | `DATA.md` | [`DATA.md`](DATA.md) | Diagrama Mermaid, contratos JSON y prefijos R2 |

---

## 🏗️ Estructura del Código

```
worker/
├── wrangler.toml              # Configuración de Wrangler y bindings (R2, Cron)
├── DATA.md                    # Diccionario de datos y especificación de endpoints
├── README.md                  # Este archivo (Guía para agentes y desarrolladores)
├── cinetk.js                  # Punto de entrada (~85 líneas): dispatchers fetch y scheduled
└── src/
    ├── config.js              # Constantes (sedes, CORS, TTL, días sync)
    ├── handlers.js            # Handlers HTTP (/v2, /movie-details, /health, /admin)
    ├── pipeline.js            # Orquestador del Cron Trigger (Fases 1 a 5)
    ├── storage.js             # Operaciones R2 y Garbage Collector
    ├── scrapers.js            # Peticiones upstream a Cineteca y Vista Ticketing
    ├── parsers.js             # Parsers de HTML, RegEx y normalización
    ├── notifications.js       # Integración de alertas Telegram
    └── utils.js               # Fechas CDMX, ordenamiento de salas, JSON helper
```

---

## 🛠️ Comandos de Desarrollo y Verificación

Wrangler empaqueta todos los módulos ES (`import`/`export`) automáticamente con `esbuild`:

```bash
# 1. Validar empaquetado sin publicar
npx wrangler deploy --dry-run

# 2. Iniciar entorno local con simulación de R2 y Cron
npx wrangler dev --test-scheduled

# 3. Publicar a producción en Cloudflare
npx wrangler deploy

# 4. Inspeccionar logs en vivo
npx wrangler tail
```
