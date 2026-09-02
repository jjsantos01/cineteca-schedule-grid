import state, { getCurrentMovieData } from './state.js';
import { SELECTED_SEDES_KEY, SEDES } from './config.js';
import { formatDateForAPI, showError, showLoading } from './utils.js';
import { fetchMoviesForSede } from './api.js';
import { renderSchedule } from './grid.js';
import { renderMoviesSchedule } from './moviesGrid.js';
import { showLoadingIndicator, hideLoadingIndicator } from './loadingIndicator.js';
import { hasCachedData, getCachedData, setCachedData } from './cache.js';
import { clearAPICache } from './apiCache.js';

export function renderCurrentView() {
    const posterCarousel = document.getElementById('posterCarousel');
    if (posterCarousel) posterCarousel.style.display = '';

    if (state.viewMode === 'movies') {
        renderMoviesSchedule(state.multiDayData);
    } else {
        renderSchedule(getCurrentMovieData());
    }
}

async function loadSedeData(sedeId) {
    if (state.loadingSedes.has(sedeId)) {
        return;
    }

    const dateKey = formatDateForAPI(state.currentDate);
    const cachedSedeData = getCachedData(dateKey, sedeId);
    if (cachedSedeData) {
        state.movieData[sedeId] = cachedSedeData;
        renderCurrentView();
        return;
    }

    state.loadingSedes.add(sedeId);
    updateLoadingState();

    let movies = null;

    try {
        movies = await fetchMoviesForSede(sedeId, state.currentDate);
        state.movieData[sedeId] = movies;
        setCachedData(dateKey, sedeId, movies);
    } catch (error) {
        console.error(`Error loading sede ${sedeId}:`, error);
        showError(`Error al cargar datos de ${SEDES[sedeId].nombre}`);
    } finally {
        state.loadingSedes.delete(sedeId);
        if (movies !== null) {
            renderCurrentView();
        }
        updateLoadingState();
    }
}

function updateLoadingState() {
    const container = document.getElementById('scheduleContainer');

    if (state.loadingSedes.size === 0) {
        hideLoadingIndicator();
        if (state.viewMode === 'day') {
            const currentData = getCurrentMovieData();
            if (Object.keys(currentData).length === 0 ||
                Object.values(currentData).every(movies => !movies || movies.length === 0)) {
                container.innerHTML = '<div class="error">Todavía no hay películas disponibles para las sedes seleccionadas</div>';
            }
        }
        return;
    }

    const loadingSedeNames = Array.from(state.loadingSedes)
        .map(id => SEDES[id]?.nombre || id)
        .join(', ');

    if (state.viewMode === 'day') {
        const currentData = getCurrentMovieData();
        if (Object.keys(currentData).length > 0 &&
            Object.values(currentData).some(movies => movies && movies.length > 0)) {
            renderCurrentView();
            showLoadingIndicator(`Cargando datos de: ${loadingSedeNames}`);
        } else {
            container.innerHTML = `<div class="loading">Cargando cartelera de ${loadingSedeNames}...</div>`;
        }
    } else {
        showLoadingIndicator(`Cargando cartelera completa de: ${loadingSedeNames}`);
    }
}

/**
 * Carga los datos de todas las sedes activas para hoy y los siguientes 7 días.
 */
export async function loadAndRenderMultiDayMovies() {
    if (state.isLoading) return;

    state.isLoading = true;
    showLoadingIndicator('Cargando programación de todos los días...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [];
    for (let i = 0; i < 8; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d);
    }

    state.multiDayData = {};
    let hasAnyCachedData = false;

    // Poblar con lo que ya tengamos en caché
    for (const d of dates) {
        const dateKey = formatDateForAPI(d);
        state.multiDayData[dateKey] = {};
        for (const sedeId of state.activeSedes) {
            const cached = getCachedData(dateKey, sedeId);
            if (cached) {
                state.multiDayData[dateKey][sedeId] = cached;
                hasAnyCachedData = true;
            }
        }
    }

    if (hasAnyCachedData) {
        renderCurrentView();
    } else {
        showLoading();
    }

    // Identificar llamadas de red pendientes
    const fetchTasks = [];
    for (const d of dates) {
        const dateKey = formatDateForAPI(d);
        for (const sedeId of state.activeSedes) {
            if (!hasCachedData(dateKey, sedeId)) {
                fetchTasks.push({ date: d, dateKey, sedeId });
            }
        }
    }

    if (fetchTasks.length > 0) {
        for (const task of fetchTasks) {
            state.loadingSedes.add(task.sedeId);
        }

        try {
            await Promise.allSettled(fetchTasks.map(async (task) => {
                try {
                    const movies = await fetchMoviesForSede(task.sedeId, task.date);
                    setCachedData(task.dateKey, task.sedeId, movies);
                    if (!state.multiDayData[task.dateKey]) {
                        state.multiDayData[task.dateKey] = {};
                    }
                    state.multiDayData[task.dateKey][task.sedeId] = movies;
                } catch (err) {
                    console.error(`Error fetching multi-day for ${task.sedeId} on ${task.dateKey}:`, err);
                }
            }));
        } finally {
            state.loadingSedes.clear();
            hideLoadingIndicator();
        }
    } else {
        hideLoadingIndicator();
    }

    state.isLoading = false;
    renderCurrentView();
}

export async function loadAndRenderMovies() {
    if (state.viewMode === 'movies') {
        await loadAndRenderMultiDayMovies();
        return;
    }

    if (state.isLoading) return;

    state.isLoading = true;
    const dateKey = formatDateForAPI(state.currentDate);
    state.movieData = {};

    // Limpiar caché de API de detalles al cambiar de fecha
    clearAPICache();

    let hasDataToRender = false;
    for (const sedeId of state.activeSedes) {
        const cachedSedeData = getCachedData(dateKey, sedeId);
        if (cachedSedeData) {
            state.movieData[sedeId] = cachedSedeData;
            hasDataToRender = true;
        }
    }

    if (hasDataToRender) {
        renderCurrentView();
    } else {
        showLoading();
    }

    try {
        const promises = [];
        for (const sedeId of state.activeSedes) {
            if (!hasCachedData(dateKey, sedeId)) {
                promises.push(loadSedeData(sedeId));
            }
        }
        await Promise.all(promises);
    } catch (error) {
        showError('Error al cargar la cartelera');
    } finally {
        state.isLoading = false;
    }
}

export async function toggleSedeSelection(sedeId, isChecked) {
    if (isChecked) {
        state.activeSedes.add(sedeId);
    } else {
        state.activeSedes.delete(sedeId);
    }

    try {
        localStorage.setItem(SELECTED_SEDES_KEY, JSON.stringify(Array.from(state.activeSedes)));
    } catch (error) {
        console.error('Error saving sedes selection', error);
    }

    if (state.viewMode === 'movies') {
        await loadAndRenderMultiDayMovies();
    } else {
        const dateKey = formatDateForAPI(state.currentDate);
        if (isChecked) {
            if (!state.movieData[sedeId] || !hasCachedData(dateKey, sedeId)) {
                await loadSedeData(sedeId);
            } else {
                renderCurrentView();
            }
        } else {
            renderCurrentView();
        }
    }
}

