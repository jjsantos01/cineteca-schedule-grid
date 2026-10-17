import state, { setCurrentDate, setViewMode, getMaxSelectableDate } from './state.js';
import { DEFAULT_SEDES, SELECTED_SEDES_KEY } from './config.js';
import { formatDate, formatDateForAPI, isSameDate } from './utils.js';
import { loadStateFromURL, updateStateInURL } from './urlState.js';
import { loadAndRenderMovies, toggleSedeSelection } from './dataLoader.js';
import { setMovieFilter, setTimeFilter, clearTimeFilter as resetTimeFilters, applyFilters, initClearAllFilters, updateClearAllFiltersVisibility, clearAllFilters } from './filters.js';
import { clearSelection } from './selection.js';
import { initModal, showMovieInfoModal, navigateToPrevMovie, navigateToNextMovie, closeMovieInfoModal, playTrailer } from './modal.js';
import { updatePosterInfoActions, destroyInlineInfo, openInlineInfo } from './inlineInfo.js';
import { initializeVisitedMovies } from './visited.js';
import { cleanOldCache } from './cache.js';
import { FILTER_LOCKS, setFilterLock, updateFilterLockUI } from './filterLock.js';
import { initCarouselFilterChip } from './carouselFilterChip.js';
import { initHelpModal, openHelpModal, closeHelpModal } from './helpModal.js';
import { startTour, stopTour } from './tour.js';
import { initPosterTooltip } from './posterTooltip.js';
import { initCiclosFilter, updateCiclosUI } from './ciclosFilter.js';
import { initMovieAutocomplete, syncAutocompleteUI } from './autocomplete.js';
import { initTimeSlider, setTimeSlider, resetTimeSlider } from './timeSlider.js';

// Expose functions used in inline handlers
window.showMovieInfoModal = showMovieInfoModal;
window.navigateToPrevMovie = navigateToPrevMovie;
window.navigateToNextMovie = navigateToNextMovie;
window.closeMovieInfoModal = closeMovieInfoModal;
window.playTrailer = playTrailer;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.startTour = startTour;
window.stopTour = stopTour;
window.clearAllFilters = clearAllFilters;

let filterDebounceTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeVisitedMovies();
    initPosterTooltip();
    initModal();
    initHelpModal();
    setupEventListeners();
    initializeState();
    updateFilterLockUI();
    initCarouselFilterChip();
    initCiclosFilter();
    initMovieAutocomplete({
        onFilterChange: (value) => {
            clearTimeout(filterDebounceTimeout);
            handleMovieFilterChange(value);
        },
        clearDebounce: () => {
            clearTimeout(filterDebounceTimeout);
        }
    });
    initClearAllFilters();

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
        state.viewMode = 'day';
    } else {
        const savedSedes = loadSavedSedes();
        if (!urlParams.has('sedes')) {
            state.activeSedes = new Set(savedSedes.length > 0 ? savedSedes : DEFAULT_SEDES);
        }
        const result = loadStateFromURL();
        if (result.dateChanged || result.viewModeChanged) {
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
    const dayBtn = document.getElementById('viewModeDay');
    const moviesBtn = document.getElementById('viewModeMovies');
    if (dayBtn) dayBtn.addEventListener('click', () => handleViewModeChange('day'));
    if (moviesBtn) moviesBtn.addEventListener('click', () => handleViewModeChange('week'));

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
        updateClearAllFiltersVisibility();
        clearTimeout(filterDebounceTimeout);
        filterDebounceTimeout = setTimeout(() => {
            handleMovieFilterChange(event.target.value);
        }, 300);
    });

    initTimeSlider({
        onTimeChange: (start, end) => {
            handleTimeFilterChange(start, end);
            updateClearAllFiltersVisibility();
        }
    });

    const clearTimeBtn = document.getElementById('clearTimeFilter');
    if (clearTimeBtn) {
        clearTimeBtn.addEventListener('click', handleClearTimeFilters);
    }

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
    document.addEventListener('feed:loaded', () => {
        updateDateDisplay();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.selectedMovies.length > 0) {
            const modal = document.getElementById('movieInfoModal');
            const helpModal = document.getElementById('helpModal');
            const isModalOpen = (modal && modal.style.display === 'flex') || (helpModal && helpModal.classList.contains('help-modal-backdrop--visible'));
            const isTourActive = document.body.classList.contains('tour-active');

            if (isModalOpen || isTourActive) {
                return;
            }

            clearSelection();
        }
    });

    window.addEventListener('popstate', handlePopState);
}

function handleViewModeChange(mode) {
    const normalizedMode = (mode === 'movies' || mode === 'week') ? 'week' : 'day';
    if (state.viewMode === normalizedMode) return;
    setViewMode(normalizedMode);
    clearSelection();
    syncUIWithState();
    updateStateInURL();
    loadAndRenderMovies();
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
    const isWeekMode = state.viewMode === 'week' || state.viewMode === 'movies';
    const dayBtn = document.getElementById('viewModeDay');
    const moviesBtn = document.getElementById('viewModeMovies');
    const dateSelector = document.getElementById('dateSelector');
    const posterCarousel = document.getElementById('posterCarousel');
    const posterInfoActions = document.getElementById('posterInfoActions');
    const inlinePanel = document.getElementById('inlineMovieInfoPanel');

    if (dayBtn) dayBtn.classList.toggle('active', !isWeekMode);
    if (moviesBtn) moviesBtn.classList.toggle('active', isWeekMode);

    if (dateSelector) {
        dateSelector.style.display = isWeekMode ? 'none' : 'flex';
    }

    document.getElementById('currentDate').textContent = formatDate(state.currentDate);
    document.getElementById('datePicker').value = formatDateForAPI(state.currentDate);
    document.getElementById('cenart').checked = state.activeSedes.has('002');
    document.getElementById('xoco').checked = state.activeSedes.has('003');
    document.getElementById('chapultepec').checked = state.activeSedes.has('001');
    document.getElementById('movieFilter').value = state.movieFilter;
    syncAutocompleteUI();
    setTimeSlider(state.timeFilterStart, state.timeFilterEnd);
    const startTimeInput = document.getElementById('startTimeFilter');
    const endTimeInput = document.getElementById('endTimeFilter');
    if (startTimeInput) startTimeInput.value = state.timeFilterStart;
    if (endTimeInput) endTimeInput.value = state.timeFilterEnd;
    updateClearAllFiltersVisibility();
}

function updateDateDisplay() {
    const dateDisplay = document.getElementById('currentDate');
    const datePicker = document.getElementById('datePicker');
    dateDisplay.textContent = formatDate(state.currentDate);
    datePicker.value = formatDateForAPI(state.currentDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = getMaxSelectableDate(today);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = getMaxSelectableDate(today);

    let newDate = null;
    if (Array.isArray(state.availableDates) && state.availableDates.length > 0) {
        const currentKey = formatDateForAPI(state.currentDate);
        const todayKey = formatDateForAPI(today);
        const validDates = state.availableDates.filter(d => d >= todayKey);
        if (days > 0) {
            const nextKey = validDates.find(d => d > currentKey);
            if (nextKey) newDate = new Date(`${nextKey}T00:00:00`);
        } else if (days < 0) {
            const prevCandidates = validDates.filter(d => d < currentKey);
            const prevKey = prevCandidates[prevCandidates.length - 1];
            if (prevKey) newDate = new Date(`${prevKey}T00:00:00`);
        }
    }

    if (!newDate) {
        const fallbackDate = new Date(state.currentDate);
        fallbackDate.setDate(fallbackDate.getDate() + days);
        if (fallbackDate >= today && fallbackDate <= maxDate && (!state.availableDates || state.availableDates.length === 0)) {
            newDate = fallbackDate;
        }
    }

    if (newDate && newDate >= today && newDate <= maxDate) {
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
    const maxDate = getMaxSelectableDate(today);

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

    return value.trim();
}

function computeInputLock() {
    const hasTextFilter = state.movieFilter !== '';
    const hasTimeFilter = Boolean(state.timeFilterStart || state.timeFilterEnd);
    return hasTextFilter || hasTimeFilter ? FILTER_LOCKS.INPUTS : FILTER_LOCKS.NONE;
}

function applyMovieFilter(value) {
    if (state.filterLock === FILTER_LOCKS.CAROUSEL) {
        return;
    }

    const rawValue = typeof value === 'string' ? value : '';
    const filterValue = normalizeFilterValue(rawValue);

    if (state.carouselFilterFilmId) {
        state.carouselFilterFilmId = null;
        destroyInlineInfo();
    }

    const previousFilter = state.movieFilter;
    const newFilter = setMovieFilter(filterValue);

    if (!previousFilter && newFilter) {
        clearSelection();
    }

    setFilterLock(computeInputLock());
    updatePosterInfoActions();
    updateStateInURL();
}

function applyTimeFilter(start, end) {
    if (state.filterLock === FILTER_LOCKS.CAROUSEL) {
        return;
    }

    const previousStart = state.timeFilterStart;
    const previousEnd = state.timeFilterEnd;
    const { start: newStart, end: newEnd } = setTimeFilter(start, end);

    const startTimeInput = document.getElementById('startTimeFilter');
    const endTimeInput = document.getElementById('endTimeFilter');
    if (startTimeInput) startTimeInput.value = newStart;
    if (endTimeInput) endTimeInput.value = newEnd;

    if ((!previousStart && newStart) || (!previousEnd && newEnd)) {
        clearSelection();
    }

    if (state.carouselFilterFilmId) {
        state.carouselFilterFilmId = null;
        destroyInlineInfo();
    }

    setFilterLock(computeInputLock());
    updateStateInURL();
}

function handleMovieFilterChange(value) {
    applyMovieFilter(value);
}

function handleTimeFilterChange(start, end) {
    applyTimeFilter(start, end);
}

function handleClearTimeFilters() {
    resetTimeSlider();
    resetTimeFilters();
    const startTimeInput = document.getElementById('startTimeFilter');
    const endTimeInput = document.getElementById('endTimeFilter');
    if (startTimeInput) startTimeInput.value = '';
    if (endTimeInput) endTimeInput.value = '';
    state.carouselFilterFilmId = null;
    setFilterLock(computeInputLock());
    updateStateInURL();
    destroyInlineInfo();
}

function handleCarouselFilterApply(event) {
    const { filmId, forceOpenInfo } = event.detail || {};
    if (!filmId) {
        return;
    }

    state.carouselFilterFilmId = filmId;
    state.movieFilter = '';

    const movieFilterInput = document.getElementById('movieFilter');
    if (movieFilterInput) {
        movieFilterInput.value = '';
    }

    setFilterLock(FILTER_LOCKS.CAROUSEL);
    clearSelection();
    applyFilters();

    const panel = document.getElementById('inlineMovieInfoPanel');
    const isOpen = panel && panel.childElementCount > 0;
    if (state.inlineSelectionChange) {
        // Se originó desde navegación inline, el propio inline ya actualiza.
        updatePosterInfoActions();
        return;
    }

    if ((isOpen || forceOpenInfo) && filmId) {
        // Si el usuario tiene activo Información, actualiza el panel a la nueva selección
        openInlineInfo(filmId);
    }
    updatePosterInfoActions();
}

function handleCarouselFilterClear() {
    state.carouselFilterFilmId = null;
    setFilterLock(FILTER_LOCKS.NONE);
    applyFilters();
    destroyInlineInfo();
}

function handlePopState() {
    state.isInitializing = true;
    const result = loadStateFromURL();
    if (result.dateChanged || result.viewModeChanged) {
        clearSelection();
    }
    syncUIWithState();
    updateCiclosUI();
    state.isInitializing = false;
    updateDateDisplay();
    setFilterLock(computeInputLock());
    loadAndRenderMovies();
}
