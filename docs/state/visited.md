# Módulo: Historial de Funciones Visitadas (`js/visited.js`)

## 📌 Propósito y Resumen
Rastrea y persiste en `localStorage` cuáles bloques de función han sido consultados o abiertos por el usuario, permitiendo aplicar un estilo visual diferenciado (`.visited`) en el grid para identificar fácilmente qué películas ya fueron exploradas.

---

## 📦 Dependencias e Interacciones
- **Importa**: `config.js` (`VISITED_MOVIES_KEY`), `utils.js` (`getMovieUniqueId`).
- **Consumido por**: `app.js` (inicialización en arranque), `tooltip.js` (marcar al hacer clic), `grid.js` (asignar clase CSS al renderizar).

---

## ⚙️ API Exportada

### `initializeVisitedMovies()`
- **Firma**: `initializeVisitedMovies(): void`
- **Descripción**: Lee la clave `cinetkVisitedMovies` de `localStorage`, parsea el JSON y carga un `Set<string>` en memoria. Maneja excepciones en caso de almacenamiento no disponible.

### `markMovieAsVisited(movie, horario)`
- **Firma**: `markMovieAsVisited(movie: Object, horario: string): void`
- **Descripción**: Genera el identificador único de la función (`sedeId-sala-horario-titulo`), lo añade al `Set` interno y guarda la versión actualizada en `localStorage`.

### `isMovieVisited(movieId)`
- **Firma**: `isMovieVisited(movieId: string): boolean`
- **Descripción**: Retorna `true` si el `movieId` ya fue marcado como visitado, permitiendo a `grid.js` añadir la clase `.visited` al bloque DOM.

---

## ⚠️ Invariantes y Persistencia
- **Formato del ID único**: Proviene de `utils.js:getMovieUniqueId(movie, horario)`: `${movie.sedeId}-${movie.sala}-${horario}-${movie.titulo}`.
- **Tolerancia a fallos**: Todas las lecturas y escrituras en `localStorage` están envueltas en bloques `try...catch` para evitar fallos si el usuario navega en modo privado o con almacenamiento bloqueado.
