# Módulo: Utilidades Globales (`js/utils.js`)

## 📌 Propósito y Resumen
Colección de funciones puras y utilidades de soporte: conversión y cálculo de horas/minutos, traslapes temporales, formateo de fechas en español, manipulación de query params en la URL, extracción de IDs de video de YouTube y renderizado de mensajes de estado en el DOM.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`HOUR_WIDTH`).
- **Consumido por**: Prácticamente todos los módulos de la aplicación.

---

## ⚙️ API Exportada

### ⏰ Manejo de Horas y Minutos
- `timeToMinutes(time: string): number`
  - Convierte `'14:30'` a `870` minutos desde la medianoche.
- `minutesToTime(minutes: number): string`
  - Convierte `870` a `'14:30'`.
- `minutesToPosition(minutes: number, startHour: number): number`
  - Calcula la coordenada en píxeles: `((minutes - (startHour * 60)) / 60) * HOUR_WIDTH`.
- `formatDuration(durationInMinutes: number): string`
  - Formatea minutos a texto en español: ej. `"1 hora y 45 minutos"`, `"90 minutos"`, `"2 horas"`.
- `calculateTimeRange(movieData: Object): { startHour: number, endHour: number }`
  - Calcula la hora más temprana y más tardía de todas las funciones para definir los límites del timeline.
- `doMoviesOverlap(movie1: Object, movie2: Object): boolean`
  - Comprueba si dos intervalos temporales se solapan: `m1.startMinutes < m2.endMinutes && m2.startMinutes < m1.endMinutes`.

### 📅 Manejo de Fechas
- `formatDate(date: Date): string`
  - Retorna fecha en español: ej. `"viernes 28 de agosto de 2026"`.
- `formatDateForAPI(date: Date): string`
  - Retorna fecha en formato ISO estándar: `'YYYY-MM-DD'`.
- `isSameDate(date1: Date, date2: Date): boolean`
  - Compara si dos objetos `Date` corresponden al mismo día natural.

### 🔗 URLs y Parsing
- `extractFilmId(href: string): string | null`
  - Extrae el ID de la película desde parámetros de consulta (`FilmId=...`).
- `getYouTubeEmbedUrl(youtubeUrl: string): string | null`
  - Transforma enlaces estándar (`youtu.be/xxx`, `youtube.com/watch?v=xxx`) a URLs de embebido de iframe con autoplay (`https://www.youtube.com/embed/xxx?autoplay=1&rel=0`).
- `updateURLParams(params: Object): void`
  - Modifica los parámetros de la URL actual mediante `window.history.replaceState`.
- `getURLParams(): Object`
  - Extrae `{ date, sedes, filter, timeStart, timeEnd }` de la URL actual.

### 🖼️ DOM y Helpers de Estado
- `getMovieUniqueId(movie: Object, horario: string): string`
  - Retorna clave única `${movie.sedeId}-${movie.sala}-${horario}-${movie.titulo}`.
- `showLoading(): void` / `showError(message: string): void`
  - Inserta mensajes de carga o error en `#scheduleContainer`.
