# Módulo: Agregación de Funciones (`js/showtimes.js`)

## 📌 Propósito y Resumen
Recopila, deduplica y agrupa todas las funciones de una película tanto del día actual (a través de múltiples sedes/salas) como de fechas futuras para presentarlas organizadas en tablas de horarios dentro de tooltips y modales.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `config.js` (`SEDES`), `utils.js` (`timeToMinutes`, `formatDateForAPI`).
- **Consumido por**: `tooltip.js` (`findAllShowtimesForMovie`), `modal.js` (`getFutureShowtimesForMovie`, `groupShowtimesByDay`, `buildMovieNavigationArray`).

---

## ⚙️ API Exportada

### `findAllShowtimesForMovie(movieTitle, currentSedeId, currentSala, currentHorario)`
- **Firma**: `findAllShowtimesForMovie(movieTitle: string, currentSedeId: string, currentSala: string, currentHorario: string): Array<Object>`
- **Descripción**: Busca en todas las sedes activas del estado (`state.movieData`) otras funciones del día para el mismo título, excluyendo la función actual.
- **Retorno**: Arreglo ordenado cronológicamente con `{ sede, sala, horario, sedeId, salaCompleta, ticketUrl, href }`.

### `getFutureShowtimesForMovie(movie, explicitFilmId, minDate)`
- **Firma**: `getFutureShowtimesForMovie(movie: Object, explicitFilmId?: string, minDate?: Date): Array<Object>`
- **Descripción**: Consolida todas las sesiones disponibles de la película a partir de `movie.allShowtimes`, `state.movieData` y `state.cachedData`.
- **Deduplicación**: Agrupa por clave `${date}_${time}_${sedeId}_${sessionId/ticketUrl}` y ordena cronológicamente por fecha y hora.

### `groupShowtimesByDay(showtimes)`
- **Firma**: `groupShowtimesByDay(showtimes: Array<Object>): Array<Object>`
- **Descripción**: Transforma la lista plana de funciones en una estructura jerárquica lista para renderizar en el modal:
  - Agrupa por fecha (etiquetando con 'Hoy' o 'Mañana' si aplica).
  - Dentro de cada día, agrupa por sede con sus colores corporativos (`SEDES[sedeId].color`).

### `buildMovieNavigationArray(currentMovieData)`
- **Firma**: `buildMovieNavigationArray(currentMovieData: Object): Array<Object>`
- **Descripción**: Genera una lista de películas únicas presentes en la vista actual para permitir la navegación secuencial con flechas (anterior/siguiente) en el modal de información.
