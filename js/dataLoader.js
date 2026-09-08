import state, { getCurrentMovieData } from './state.js';
import { SELECTED_SEDES_KEY, SEDES } from './config.js';
import { formatDateForAPI, showError, showLoading } from './utils.js';
import { fetchConsolidatedFeed } from './api.js';
import { hydrateMovieItem } from './parser.js';
import { renderSchedule } from './grid.js';
import { renderMoviesSchedule } from './moviesGrid.js';
import { showLoadingIndicator, hideLoadingIndicator } from './loadingIndicator.js';
import { getCachedData, setCachedData } from './cache.js';
import { primeMovieCatalog } from './apiCache.js';

let isFeedLoaded = false;
let feedLoadingPromise = null;

export function renderCurrentView() {
    const posterCarousel = document.getElementById('posterCarousel');
    if (posterCarousel) posterCarousel.style.display = '';

    if (state.viewMode === 'movies') {
        renderMoviesSchedule(state.multiDayData);
    } else {
        renderSchedule(getCurrentMovieData());
    }
}

/**
 * Asegura que el feed consolidado semanal esté cargado e hidratado en memoria.
 */
export async function ensureFeedLoaded(forceRefresh = false) {
    if (isFeedLoaded && !forceRefresh) {
        return;
    }

    if (feedLoadingPromise) {
        return feedLoadingPromise;
    }

    feedLoadingPromise = (async () => {
        try {
            const feed = await fetchConsolidatedFeed(forceRefresh);
            if (!feed || !feed.schedules || !feed.movies) {
                throw new Error('Formato de feed consolidado inválido');
            }

            // 1. Precargar catálogo de sinopsis, pósters y tráilers en apiCache
            primeMovieCatalog(feed.movies);

            // 2. Precalcular allShowtimes para cada película cruzando todos los días y sedes
            const allShowtimesByFilm = new Map();
            for (const [dateKey, sedes] of Object.entries(feed.schedules)) {
                for (const [sedeId, movies] of Object.entries(sedes)) {
                    for (const m of movies) {
                        if (!allShowtimesByFilm.has(m.filmId)) {
                            allShowtimesByFilm.set(m.filmId, []);
                        }
                        const list = allShowtimesByFilm.get(m.filmId);
                        for (const s of (m.sessions || [])) {
                            list.push({
                                date: dateKey,
                                time: s.time,
                                displayTime: s.displayTime || s.time,
                                ticketUrl: s.ticketUrl,
                                sessionId: s.sessionId,
                                sala: s.sala || m.sala,
                                salaCompleta: s.salaCompleta || m.salaCompleta,
                                sedeId,
                                sede: SEDES[sedeId]?.nombre || sedeId,
                                sedeCodigo: SEDES[sedeId]?.codigo || sedeId
                            });
                        }
                    }
                }
            }

            // Ordenar cronológicamente las funciones de cada película
            for (const list of allShowtimesByFilm.values()) {
                list.sort((a, b) => {
                    const dateCmp = a.date.localeCompare(b.date);
                    if (dateCmp !== 0) return dateCmp;
                    return a.time.localeCompare(b.time);
                });
            }

            // 3. Hidratar state.cachedData y state.multiDayData para todas las fechas y sedes
            state.multiDayData = {};

            for (const [dateKey, sedes] of Object.entries(feed.schedules)) {
                if (!state.multiDayData[dateKey]) {
                    state.multiDayData[dateKey] = {};
                }

                for (const [sedeId, movies] of Object.entries(sedes)) {
                    const hydratedMovies = movies.map(item => {
                        const meta = feed.movies[item.filmId] || {};
                        const filmShowtimes = allShowtimesByFilm.get(item.filmId) || [];
                        return hydrateMovieItem(item, meta, sedeId, dateKey, filmShowtimes);
                    });

                    setCachedData(dateKey, sedeId, hydratedMovies);
                    state.multiDayData[dateKey][sedeId] = hydratedMovies;
                }
            }

            isFeedLoaded = true;
        } catch (error) {
            console.error('Error al procesar el feed consolidado:', error);
            showError('Error al cargar la cartelera de Cineteca');
            const container = document.getElementById('scheduleContainer');
            if (container) {
                container.innerHTML = '<div class="error">No se pudo conectar con el servidor de la cartelera. Por favor intenta recargar la página.</div>';
            }
            throw error;
        } finally {
            feedLoadingPromise = null;
        }
    })();

    return feedLoadingPromise;
}

/**
 * Carga los datos de todas las sedes activas para la vista multi-día (instantáneo si el feed ya cargó).
 */
export async function loadAndRenderMultiDayMovies() {
    if (state.isLoading) return;

    if (!isFeedLoaded) {
        state.isLoading = true;
        showLoadingIndicator('Cargando programación completa...');
        try {
            await ensureFeedLoaded();
        } catch (e) {
            return;
        } finally {
            state.isLoading = false;
            hideLoadingIndicator();
        }
    }

    renderCurrentView();
}

/**
 * Carga los datos de la fecha seleccionada para la vista diaria (instantáneo si el feed ya cargó).
 */
export async function loadAndRenderMovies() {
    if (state.viewMode === 'movies') {
        await loadAndRenderMultiDayMovies();
        return;
    }

    if (state.isLoading) return;

    const dateKey = formatDateForAPI(state.currentDate);

    if (!isFeedLoaded) {
        state.isLoading = true;
        showLoading();
        showLoadingIndicator('Cargando cartelera...');
        try {
            await ensureFeedLoaded();
        } catch (e) {
            return;
        } finally {
            state.isLoading = false;
            hideLoadingIndicator();
        }
    }

    state.movieData = {};
    for (const sedeId of state.activeSedes) {
        const cached = getCachedData(dateKey, sedeId);
        if (cached) {
            state.movieData[sedeId] = cached;
        }
    }

    renderCurrentView();
}

/**
 * Alterna la selección de una sede y refresca la vista inmediatamente desde memoria.
 */
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

    if (!isFeedLoaded) {
        await ensureFeedLoaded();
    }

    if (state.viewMode === 'movies') {
        renderCurrentView();
    } else {
        const dateKey = formatDateForAPI(state.currentDate);
        if (isChecked) {
            const cached = getCachedData(dateKey, sedeId);
            if (cached) {
                state.movieData[sedeId] = cached;
            }
        } else {
            delete state.movieData[sedeId];
        }
        renderCurrentView();
    }
}


