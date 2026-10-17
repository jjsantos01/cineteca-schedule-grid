import state, { setCurrentDate, getMaxSelectableDate } from './state.js';
import { DEFAULT_SEDES } from './config.js';
import { formatDateForAPI, getURLParams, updateURLParams, isSameDate } from './utils.js';

const VALID_SEDE_IDS = ['001', '002', '003'];

export function updateStateInURL() {
    if (state.isInitializing) return;

    let ciclosValue = null;
    const totalCiclos = Object.keys(state.ciclos || {}).length;
    if (state.selectedCiclos instanceof Set) {
        if (totalCiclos === 0 || state.selectedCiclos.size < totalCiclos) {
            if (state.selectedCiclos.size === 0) {
                ciclosValue = 'none';
            } else {
                ciclosValue = Array.from(state.selectedCiclos).join(',');
            }
        }
    }

    const params = {
        date: formatDateForAPI(state.currentDate),
        sedes: Array.from(state.activeSedes).join(','),
        filter: state.movieFilter || null,
        timeStart: state.timeFilterStart || null,
        timeEnd: state.timeFilterEnd || null,
        view: (state.viewMode === 'week' || state.viewMode === 'movies') ? 'week' : null,
        ciclos: ciclosValue,
        start: null,
        end: null
    };

    updateURLParams(params);
}

export function loadStateFromURL() {
    const params = getURLParams();
    const previousDate = state.currentDate ? new Date(state.currentDate) : null;

    const result = {
        dateChanged: false,
        sedesChanged: false,
        movieFilterChanged: false,
        timeFilterChanged: false,
        viewModeChanged: false,
        ciclosChanged: false
    };

    if (params.view) {
        const viewFromUrl = (params.view === 'week' || params.view === 'movies') ? 'week' : 'day';
        if (viewFromUrl !== state.viewMode) {
            state.viewMode = viewFromUrl;
            result.viewModeChanged = true;
        }
    } else if (state.viewMode !== 'day') {
        state.viewMode = 'day';
        result.viewModeChanged = true;
    }

    if (params.date) {
        const parsedDate = new Date(`${params.date}T00:00:00`);
        if (!Number.isNaN(parsedDate.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxDate = getMaxSelectableDate(today);

            if (parsedDate >= today && parsedDate <= maxDate) {
                if (!isSameDate(previousDate, parsedDate)) {
                    result.dateChanged = true;
                }
                setCurrentDate(parsedDate);
            }
        }
    }

    if (params.sedes) {
        const sedeIds = params.sedes
            .split(',')
            .map(id => id.trim())
            .filter(id => VALID_SEDE_IDS.includes(id));
        if (sedeIds.length > 0) {
            const current = Array.from(state.activeSedes).sort().join(',');
            const incoming = sedeIds.slice().sort().join(',');
            state.activeSedes = new Set(sedeIds);
            result.sedesChanged = current !== incoming;
        } else {
            state.activeSedes = new Set(DEFAULT_SEDES);
            result.sedesChanged = true;
        }
    }

    const filterFromUrl = params.filter ? params.filter.toLowerCase() : '';
    if (filterFromUrl !== state.movieFilter) {
        state.movieFilter = filterFromUrl;
        result.movieFilterChanged = true;
    }

    const timeStart = params.timeStart || '';
    const timeEnd = params.timeEnd || '';
    if (timeStart !== state.timeFilterStart || timeEnd !== state.timeFilterEnd) {
        state.timeFilterStart = timeStart;
        state.timeFilterEnd = timeEnd;
        result.timeFilterChanged = true;
    }

    const ciclosParam = params.ciclos;
    if (ciclosParam) {
        if (ciclosParam === 'none') {
            const current = state.selectedCiclos instanceof Set ? Array.from(state.selectedCiclos).join(',') : 'all';
            if (current !== '') {
                result.ciclosChanged = true;
            }
            state.selectedCiclos = new Set();
        } else {
            const incoming = new Set(ciclosParam.split(',').map(s => s.trim()).filter(Boolean));
            const current = state.selectedCiclos instanceof Set ? Array.from(state.selectedCiclos).sort().join(',') : 'all';
            const incStr = Array.from(incoming).sort().join(',');
            if (current !== incStr) {
                result.ciclosChanged = true;
            }
            state.selectedCiclos = incoming;
        }
    } else {
        if (state.selectedCiclos !== null) {
            state.selectedCiclos = null;
            result.ciclosChanged = true;
        }
    }

    if (!params.sedes && !params.filter && !params.timeStart && !params.timeEnd && !params.date && !params.view && !params.ciclos) {
        state.activeSedes = new Set(DEFAULT_SEDES);
    } else if (!state.activeSedes || state.activeSedes.size === 0) {
        state.activeSedes = new Set(DEFAULT_SEDES);
    }

    return result;
}

export const restoreStateFromURL = loadStateFromURL;
export const updateURL = updateStateInURL;
