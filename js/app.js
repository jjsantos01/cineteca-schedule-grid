import state, { setCurrentDate } from './state.js';
import { DEFAULT_SEDES, SELECTED_SEDES_KEY } from './config.js';
import { formatDate, formatDateForAPI, isSameDate } from './utils.js';
import { loadStateFromURL, updateStateInURL } from './urlState.js';
import { loadAndRenderMovies, toggleSedeSelection } from './dataLoader.js';
import { setMovieFilter, setTimeFilter, clearTimeFilter as resetTimeFilters } from './filters.js';
import { clearSelection } from './selection.js';
import { initTooltip, closeTooltip } from './tooltip.js';
import { initModal, showMovieInfoModal, navigateToPrevMovie, navigateToNextMovie, closeMovieInfoModal, playTrailer } from './modal.js';
import { initializeVisitedMovies } from './visited.js';
import { cleanOldCache } from './cache.js';
import { FILTER_LOCKS, setFilterLock, updateFilterLockUI } from './filterLock.js';

// Expose functions used in inline handlers
window.closeTooltip = closeTooltip;
window.showMovieInfoModal = showMovieInfoModal;
window.navigateToPrevMovie = navigateToPrevMovie;
window.navigateToNextMovie = navigateToNextMovie;
window.closeMovieInfoModal = closeMovieInfoModal;
window.playTrailer = playTrailer;

let filterDebounceTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeVisitedMovies();
    initTooltip();
    initModal();
    setupEventListeners();
    initializeState();
    updateFilterLockUI();

    // Periodic updates
    setInterval(() => {
        updateDateDisplay();
    }, 60000);

    setInterval(() => {
        cleanOldCache();
    }, 3600000);
});

function initializeState() {
    state.isInitializing = true;

    const urlParams = new URLSearchParams(window.location.search);
    const hasParams = Array.from(urlParams.keys()).length > 0;

    if (!hasParams) {
        setCurrentDate(new Date());
        const savedSedes = loadSavedSedes();
        state.activeSedes = new Set(savedSedes.length > 0 ? savedSedes : DEFAULT_SEDES);
        state.movieFilter = '';
        state.timeFilterStart = '';
        state.timeFilterEnd = '';
    } else {
        const result = loadStateFromURL();
        if (result.dateChanged) {
            clearSelection();
        }
    }

    syncUIWithState();
    updateDateDisplay();

    state.isInitializing = false;
    updateStateInURL();
    setFilterLock(computeInputLock());

    loadAndRenderMovies();
}

function setupEventListeners() {
    document.getElementById('prevDay').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDay').addEventListener('click', () => changeDate(1));

    const currentDateElement = document.getElementById('currentDate');
    const datePicker = document.getElementById('datePicker');
    currentDateElement.addEventListener('click', () => {
        datePicker.showPicker();
    });
    datePicker.addEventListener('change', (event) => {
        handleDatePickerChange(event.target.value);
    });

    document.getElementById('cenart').addEventListener('change', (event) => handleSedeToggle('002', event.target.checked));
    document.getElementById('xoco').addEventListener('change', (event) => handleSedeToggle('003', event.target.checked));
    document.getElementById('chapultepec').addEventListener('change', (event) => handleSedeToggle('001', event.target.checked));

    const movieFilterInput = document.getElementById('movieFilter');
    movieFilterInput.addEventListener('input', (event) => {
        clearTimeout(filterDebounceTimeout);
        filterDebounceTimeout = setTimeout(() => {
            handleMovieFilterChange(event.target.value);
        }, 300);
    });

    const startTimeInput = document.getElementById('startTimeFilter');
    const endTimeInput = document.getElementById('endTimeFilter');
    startTimeInput.addEventListener('change', () => handleTimeFilterChange(startTimeInput.value, endTimeInput.value));
    endTimeInput.addEventListener('change', () => handleTimeFilterChange(startTimeInput.value, endTimeInput.value));
    document.getElementById('clearTimeFilter').addEventListener('click', handleClearTimeFilters);

    const shareButton = document.getElementById('shareButton');
    const shareMessage = document.getElementById('shareMessage');
    shareButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            shareMessage.textContent = '¡Link copiado! Puedes compartirlo';
            shareMessage.classList.add('visible');
            setTimeout(() => {
                shareMessage.classList.remove('visible');
            }, 3000);
        } catch (error) {
            console.error('Error al copiar el enlace:', error);
        }
    });

    document.addEventListener('posterCarousel:applyFilter', handleCarouselFilterApply);
    document.addEventListener('posterCarousel:clearFilter', handleCarouselFilterClear);

    window.addEventListener('popstate', handlePopState);
}

function loadSavedSedes() {
    try {
        const saved = localStorage.getItem(SELECTED_SEDES_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        const valid = ['001', '002', '003'];
        return parsed.filter(id => valid.includes(id));
    } catch (error) {
        console.error('Error loading saved sedes', error);
        return [];
    }
}

function syncUIWithState() {
    document.getElementById('currentDate').textContent = formatDate(state.currentDate);
    document.getElementById('datePicker').value = formatDateForAPI(state.currentDate);
    document.getElementById('cenart').checked = state.activeSedes.has('002');
    document.getElementById('xoco').checked = state.activeSedes.has('003');
    document.getElementById('chapultepec').checked = state.activeSedes.has('001');
    document.getElementById('movieFilter').value = state.movieFilter;
    document.getElementById('startTimeFilter').value = state.timeFilterStart;
    document.getElementById('endTimeFilter').value = state.timeFilterEnd;
}

function updateDateDisplay() {
    const dateDisplay = document.getElementById('currentDate');
    const datePicker = document.getElementById('datePicker');
    dateDisplay.textContent = formatDate(state.currentDate);
    datePicker.value = formatDateForAPI(state.currentDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);

    datePicker.min = formatDateForAPI(today);
    datePicker.max = formatDateForAPI(maxDate);

    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');
    const current = new Date(state.currentDate);
    current.setHours(0, 0, 0, 0);

    prevBtn.disabled = current <= today;
    nextBtn.disabled = current >= maxDate;
}

function changeDate(days) {
    const newDate = new Date(state.currentDate);
    newDate.setDate(newDate.getDate() + days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);

    if (newDate >= today && newDate <= maxDate) {
        if (!isSameDate(state.currentDate, newDate)) {
            clearSelection();
        }
        setCurrentDate(newDate);
        updateDateDisplay();
        loadAndRenderMovies();
        updateStateInURL();
    }
}

function handleDatePickerChange(newDate) {
    const parsedDate = new Date(`${newDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 7);

    if (parsedDate >= today && parsedDate <= maxDate) {
        const dateChanged = !isSameDate(state.currentDate, parsedDate);
        setCurrentDate(parsedDate);
        if (dateChanged) {
            clearSelection();
        }
        updateDateDisplay();
        loadAndRenderMovies();
        updateStateInURL();
    }
}

async function handleSedeToggle(sedeId, isChecked) {
    await toggleSedeSelection(sedeId, isChecked);
    updateStateInURL();
}

function normalizeFilterValue(value) {
    if (typeof value !== 'string') {
        return '';
    }

    return value.replace(/\s*\((dob|sub)\)\s*$/i, '').trim();
}

function computeInputLock() {
    const hasTextFilter = state.movieFilter !== '';
    const hasTimeFilter = Boolean(state.timeFilterStart || state.timeFilterEnd);
    return hasTextFilter || hasTimeFilter ? FILTER_LOCKS.INPUTS : FILTER_LOCKS.NONE;
}

function applyMovieFilter(value, { source = 'input' } = {}) {
    if (source === 'input' && state.filterLock === FILTER_LOCKS.CAROUSEL) {
        return;
    }

    const rawValue = typeof value === 'string' ? value : '';
    const filterValue = normalizeFilterValue(rawValue);

    if (source !== 'carousel' && state.carouselFilterFilmId) {
        state.carouselFilterFilmId = null;
    }

    const previousFilter = state.movieFilter;
    const newFilter = setMovieFilter(filterValue);

    if (!previousFilter && newFilter) {
        clearSelection();
    }

    if (source === 'carousel') {
        const movieFilterInput = document.getElementById('movieFilter');
        if (movieFilterInput) {
            movieFilterInput.value = rawValue;
        }

        const hasTimeFilter = Boolean(state.timeFilterStart || state.timeFilterEnd);
        const nextLock = filterValue
            ? FILTER_LOCKS.CAROUSEL
            : (hasTimeFilter ? FILTER_LOCKS.INPUTS : FILTER_LOCKS.NONE);
        setFilterLock(nextLock);
    } else {
        setFilterLock(computeInputLock());
    }

    updateStateInURL();
}

function applyTimeFilter(start, end, { source = 'input' } = {}) {
    if (source === 'input' && state.filterLock === FILTER_LOCKS.CAROUSEL) {
        return;
    }

    const previousStart = state.timeFilterStart;
    const previousEnd = state.timeFilterEnd;
    const { start: newStart, end: newEnd } = setTimeFilter(start, end);

    if ((!previousStart && newStart) || (!previousEnd && newEnd)) {
        clearSelection();
    }

    if (source !== 'carousel' && state.carouselFilterFilmId) {
        state.carouselFilterFilmId = null;
    }

    setFilterLock(computeInputLock());
    updateStateInURL();
}

function handleMovieFilterChange(value) {
    applyMovieFilter(value, { source: 'input' });
}

function handleTimeFilterChange(start, end) {
    applyTimeFilter(start, end, { source: 'input' });
}

function handleClearTimeFilters() {
    resetTimeFilters();
    document.getElementById('startTimeFilter').value = '';
    document.getElementById('endTimeFilter').value = '';
    state.carouselFilterFilmId = null;
    setFilterLock(computeInputLock());
    updateStateInURL();
}

function handleCarouselFilterApply(event) {
    const { title } = event.detail || {};
    if (!title) {
        return;
    }

    applyMovieFilter(title, { source: 'carousel' });
}

function handleCarouselFilterClear() {
    applyMovieFilter('', { source: 'carousel' });
}

function handlePopState() {
    state.isInitializing = true;
    const result = loadStateFromURL();
    if (result.dateChanged) {
        clearSelection();
    }
    syncUIWithState();
    state.isInitializing = false;
    updateDateDisplay();
    setFilterLock(computeInputLock());
    loadAndRenderMovies();
}
