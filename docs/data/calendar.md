# Módulo: Integración con Calendario (`js/calendar.js`)

## 📌 Propósito y Resumen
Genera enlaces URL de Google Calendar preconfigurados para que los usuarios puedan agendar la función cinematográfica con un solo clic, incluyendo fecha, hora de inicio, hora de fin calculada, sala, sede y zona horaria de la Ciudad de México.

---

## 📦 Dependencias e Interacciones
- **Importado por**: `tooltip.js` (botón "Agregar al calendario").
- **Dependencias externas**: Ninguna.

---

## ⚙️ API Exportada

### `generateCalendarLink(movie, horario, date)`
- **Firma**: `generateCalendarLink(movie: Object, horario: string, date: Date): string`
- **Parámetros**:
  - `movie`: Objeto de película con `titulo`, `tipoVersion`, `duracion`, `salaCompleta` y `sede`.
  - `horario`: Hora de inicio en formato `'HH:MM'`.
  - `date`: Objeto `Date` con el día de la función.
- **Formato del Evento Generado**:
  - **Título**: `Cineteca: {titulo} {tipoVersion}`
  - **Fechas**: Formato ISO compacto `YYYYMMDDTHHmmss/YYYYMMDDTHHmmss`. La hora de fin se calcula sumando `movie.duracion` en minutos.
  - **Descripción**: Datos de sala y duración.
  - **Ubicación**: `Cineteca Nacional - {sede}`
  - **Zona Horaria (`ctz`)**: `America/Mexico_City`
- **Retorno**: URL completa de Google Calendar (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`).
