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
    availableDates: []
};

export default state;

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
