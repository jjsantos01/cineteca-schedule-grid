import state, { getCurrentMovieData } from './state.js';
import { SELECTED_SEDES_KEY, SEDES } from './config.js';
import { formatDateForAPI, showError, showLoading } from './utils.js';
import { fetchMoviesForSede } from './api.js';
import { renderSchedule } from './grid.js';
import { showLoadingIndicator, hideLoadingIndicator } from './loadingIndicator.js';
import { hasCachedData, getCachedData, setCachedData } from './cache.js';

async function loadSedeData(sedeId) {
    if (state.loadingSedes.has(sedeId)) {
        return;
    }

    const dateKey = formatDateForAPI(state.currentDate);
    const cachedSedeData = getCachedData(dateKey, sedeId);
    if (cachedSedeData) {
        state.movieData[sedeId] = cachedSedeData;
        renderSchedule(getCurrentMovieData());
        return;
    }

    state.loadingSedes.add(sedeId);
    updateLoadingState();

    try {
        const movies = await fetchMoviesForSede(sedeId, state.currentDate);
        state.movieData[sedeId] = movies;
        setCachedData(dateKey, sedeId, movies);
        renderSchedule(getCurrentMovieData());
    } catch (error) {
        console.error(`Error loading sede ${sedeId}:`, error);
        showError(`Error al cargar datos de ${SEDES[sedeId].nombre}`);
    } finally {
        state.loadingSedes.delete(sedeId);
        updateLoadingState();
    }
}

function updateLoadingState() {
    const container = document.getElementById('scheduleContainer');

    if (state.loadingSedes.size === 0) {
        hideLoadingIndicator();
        const currentData = getCurrentMovieData();
        if (Object.keys(currentData).length === 0 ||
            Object.values(currentData).every(movies => !movies || movies.length === 0)) {
            container.innerHTML = '<div class="error">Todavía no hay películas disponibles para las sedes seleccionadas</div>';
        }
        return;
    }

    const loadingSedeNames = Array.from(state.loadingSedes)
        .map(id => SEDES[id].nombre)
        .join(', ');
    const currentData = getCurrentMovieData();

    if (Object.keys(currentData).length > 0 &&
        Object.values(currentData).some(movies => movies && movies.length > 0)) {
        renderSchedule(currentData);
        showLoadingIndicator(`Cargando datos de: ${loadingSedeNames}`);
    } else {
        container.innerHTML = `<div class="loading">Cargando cartelera de ${loadingSedeNames}...</div>`;
    }
}

export async function loadAndRenderMovies() {
    if (state.isLoading) return;

    state.isLoading = true;
    const dateKey = formatDateForAPI(state.currentDate);
    state.movieData = {};

    let hasDataToRender = false;
    for (const sedeId of state.activeSedes) {
        const cachedSedeData = getCachedData(dateKey, sedeId);
        if (cachedSedeData) {
            state.movieData[sedeId] = cachedSedeData;
            hasDataToRender = true;
        }
    }

    if (hasDataToRender) {
        renderSchedule(getCurrentMovieData());
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
    const dateKey = formatDateForAPI(state.currentDate);

    if (isChecked) {
        state.activeSedes.add(sedeId);
        if (!state.movieData[sedeId] || !hasCachedData(dateKey, sedeId)) {
            await loadSedeData(sedeId);
        } else {
            renderSchedule(getCurrentMovieData());
        }
    } else {
        state.activeSedes.delete(sedeId);
        renderSchedule(getCurrentMovieData());
    }

    try {
        localStorage.setItem(SELECTED_SEDES_KEY, JSON.stringify(Array.from(state.activeSedes)));
    } catch (error) {
        console.error('Error saving sedes selection', error);
    }
}
