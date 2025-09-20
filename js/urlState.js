import state, { setCurrentDate } from './state.js';
import { DEFAULT_SEDES } from './config.js';
import { formatDateForAPI, getURLParams, updateURLParams, isSameDate } from './utils.js';

const VALID_SEDE_IDS = ['001', '002', '003'];

export function updateStateInURL() {
    if (state.isInitializing) return;

    const params = {
        date: formatDateForAPI(state.currentDate),
        sedes: Array.from(state.activeSedes).join(','),
        filter: state.movieFilter || null,
        timeStart: state.timeFilterStart || null,
        timeEnd: state.timeFilterEnd || null
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
        timeFilterChanged: false
    };

    if (params.date) {
        const parsedDate = new Date(`${params.date}T00:00:00`);
        if (!Number.isNaN(parsedDate.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxDate = new Date(today);
            maxDate.setDate(maxDate.getDate() + 7);

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

    if (!params.sedes && !params.filter && !params.timeStart && !params.timeEnd && !params.date) {
        state.activeSedes = new Set(DEFAULT_SEDES);
    }

    return result;
}
