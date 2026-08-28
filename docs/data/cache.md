# Módulo: Caché de Carteleras (`js/cache.js`)

## 📌 Propósito y Resumen
Administra el almacenamiento temporal y la retención de las carteleras completas descargadas por fecha y sede en `state.cachedData`. Reduce el consumo de red al alternar entre sedes o regresar a fechas ya consultadas durante la sesión.

---

## 📦 Dependencias e Interacciones
- **Importa**: `state.js`, `config.js` (`MAX_CACHE_DAYS`).
- **Consumido por**: `dataLoader.js` (verificar y escribir datos), `app.js` (limpieza periódica cada hora).

---

## 🗄️ Estructura de Datos en `state.cachedData`

```javascript
state.cachedData = {
    "2026-08-28": {
        "003": {
            data: [ /* Array de objetos Movie */ ],
            date: Date // Timestamp de inserción
        },
        "002": { ... }
    }
};
```

---

## ⚙️ API Exportada

### `hasCachedData(dateKey, sedeId)`
- **Firma**: `hasCachedData(dateKey: string, sedeId: string): boolean`
- **Descripción**: Verifica si existe una entrada no nula para la combinación de fecha (`YYYY-MM-DD`) y sede.

### `getCachedData(dateKey, sedeId)`
- **Firma**: `getCachedData(dateKey: string, sedeId: string): Array<Movie> | null`
- **Descripción**: Retorna el arreglo de películas en caché o `null` si no existe.

### `setCachedData(dateKey, sedeId, data)`
- **Firma**: `setCachedData(dateKey: string, sedeId: string, data: Array<Movie>): void`
- **Descripción**: Almacena las películas descargadas asignando la fecha y hora actual como timestamp de guardado.

### `cleanOldCache()`
- **Firma**: `cleanOldCache(): void`
- **Descripción**: Itera sobre todas las claves de fecha y entradas de sede en `state.cachedData`. Elimina cualquier entrada cuya fecha de registro tenga más de `MAX_CACHE_DAYS` (7 días). Se ejecuta en un intervalo periódico en `app.js`.
