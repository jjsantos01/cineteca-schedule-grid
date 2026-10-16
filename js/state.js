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
    ciclos: {}
};

export default state;

export function setSelectedCiclos(ciclosSetOrArray) {
    if (ciclosSetOrArray === null) {
        state.selectedCiclos = null;
    } else if (ciclosSetOrArray instanceof Set) {
        state.selectedCiclos = new Set(ciclosSetOrArray);
    } else if (Array.isArray(ciclosSetOrArray)) {
        state.selectedCiclos = new Set(ciclosSetOrArray);
    } else {
        state.selectedCiclos = null;
    }
}

export function toggleCiclo(cicloId) {
    const allIds = Object.keys(state.ciclos || {});
    if (state.selectedCiclos === null) {
        const nextSet = new Set(allIds);
        nextSet.delete(cicloId);
        state.selectedCiclos = nextSet;
    } else {
        const nextSet = new Set(state.selectedCiclos);
        if (nextSet.has(cicloId)) {
            nextSet.delete(cicloId);
        } else {
            nextSet.add(cicloId);
        }
        if (allIds.length > 0 && nextSet.size === allIds.length) {
            state.selectedCiclos = null;
        } else {
            state.selectedCiclos = nextSet;
        }
    }
}

export function selectAllCiclos() {
    state.selectedCiclos = null;
}

export function deselectAllCiclos() {
    state.selectedCiclos = new Set();
}

export function setSoloCiclo(cicloId) {
    state.selectedCiclos = new Set([cicloId]);
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
