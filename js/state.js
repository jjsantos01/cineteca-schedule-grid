const state = {
    currentDate: new Date(),
    activeSedes: new Set(['003']),
    movieData: {},
    cachedData: {},
    isLoading: false,
    loadingSedes: new Set(),
    movieFilter: '',
    timeFilterStart: '',
    timeFilterEnd: '',
    isInitializing: true,
    selectedMovies: [],
    carouselFilterFilmId: null,
    filterLock: null,
    currentMovieIndex: -1,
    allMoviesForNavigation: [],
    isNavigating: false,
    inlineSelectionChange: false,
    startHour: 13,
    endHour: 21,
    viewMode: 'day',
    multiDayData: {},
    availableDates: [],
    selectedCiclos: null,
    ciclosMode: 'include',
    ciclos: {}
};

export default state;

export function setSelectedCiclos(ciclosSetOrArray) {
    if (ciclosSetOrArray instanceof Set || Array.isArray(ciclosSetOrArray)) {
        const [first] = ciclosSetOrArray;
        state.selectedCiclos = first !== undefined ? new Set([first]) : null;
    } else {
        state.selectedCiclos = null;
    }
}

/**
 * Selección única: elegir un ciclo reemplaza al anterior; elegir el ciclo ya seleccionado lo quita.
 */
export function toggleCiclo(cicloId) {
    const isSelected = state.selectedCiclos instanceof Set && state.selectedCiclos.has(cicloId);
    state.selectedCiclos = isSelected ? null : new Set([cicloId]);
}

export function clearCiclosSelection() {
    state.selectedCiclos = null;
}

export function setCiclosMode(mode) {
    state.ciclosMode = mode === 'exclude' ? 'exclude' : 'include';
}

/**
 * Filtra exclusivamente por el ciclo indicado (modo "Seleccionar").
 */
export function setSoloCiclo(cicloId) {
    state.ciclosMode = 'include';
    state.selectedCiclos = new Set([cicloId]);
}

/**
 * Indica si hay ciclos seleccionados (es decir, si el filtro de ciclos restringe la cartelera).
 */
export function hasCicloSelection() {
    return state.selectedCiclos instanceof Set && state.selectedCiclos.size > 0;
}

/**
 * Determina si una película pasa el filtro de ciclos actual.
 * - Sin selección: pasa todo.
 * - Modo 'include': pasa si pertenece a al menos un ciclo seleccionado.
 * - Modo 'exclude': se oculta si pertenece a al menos un ciclo seleccionado.
 */
export function movieMatchesCicloFilter(movie) {
    if (!hasCicloSelection()) return true;
    const movieCiclos = Array.isArray(movie?.ciclos) ? movie.ciclos : [];
    const inSelection = movieCiclos.some(c => state.selectedCiclos.has(c));
    return state.ciclosMode === 'exclude' ? !inSelection : inSelection;
}
export function setCurrentDate(date) {
    state.currentDate = date;
}

export function getMaxSelectableDate(todayRef = null) {
    const today = todayRef ? new Date(todayRef) : new Date();
    today.setHours(0, 0, 0, 0);

    const dates = Array.isArray(state.availableDates) && state.availableDates.length > 0
        ? state.availableDates
        : Object.keys(state.multiDayData || {}).sort();

    if (dates.length > 0) {
        const lastDateStr = dates[dates.length - 1];
        const parsedMax = new Date(`${lastDateStr}T00:00:00`);
        if (!Number.isNaN(parsedMax.getTime()) && parsedMax >= today) {
            return parsedMax;
        }
    }

    const fallbackMax = new Date(today);
    fallbackMax.setDate(fallbackMax.getDate() + 14);
    return fallbackMax;
}

export function getCurrentMovieData() {
    const currentData = {};
    for (const sedeId of state.activeSedes) {
        if (state.movieData[sedeId]) {
            currentData[sedeId] = state.movieData[sedeId];
        }
    }
    return currentData;
}

export function setStartEndHours(startHour, endHour) {
    state.startHour = startHour;
    state.endHour = endHour;
}

export function resetSelectionState() {
    state.selectedMovies = [];
}

export function setNavigationData(movies, index) {
    state.allMoviesForNavigation = movies;
    state.currentMovieIndex = index;
}

export function setNavigating(isNavigating) {
    state.isNavigating = isNavigating;
}

export function setLoading(isLoading) {
    state.isLoading = isLoading;
}

export function setViewMode(mode) {
    state.viewMode = mode === 'movies' ? 'week' : mode;
}
