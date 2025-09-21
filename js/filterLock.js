import state from './state.js';

export const FILTER_LOCKS = {
    NONE: null,
    CAROUSEL: 'carousel',
    INPUTS: 'inputs'
};

export function setFilterLock(lock) {
    if (state.filterLock === lock) {
        return;
    }

    state.filterLock = lock;
    updateFilterLockUI();
    document.dispatchEvent(new CustomEvent('filterLock:changed', { detail: { lock } }));
}

export function updateFilterLockUI() {
    const movieFilterInput = document.getElementById('movieFilter');
    const startTimeInput = document.getElementById('startTimeFilter');
    const endTimeInput = document.getElementById('endTimeFilter');
    const clearTimeButton = document.getElementById('clearTimeFilter');
    const carouselElement = document.getElementById('posterCarousel');

    const isCarouselLock = state.filterLock === FILTER_LOCKS.CAROUSEL;
    const isInputsLock = state.filterLock === FILTER_LOCKS.INPUTS;

    if (movieFilterInput) {
        movieFilterInput.disabled = isCarouselLock;
        movieFilterInput.classList.toggle('filter-input--locked', isCarouselLock);
    }

    if (startTimeInput) {
        startTimeInput.disabled = isCarouselLock;
    }
    if (endTimeInput) {
        endTimeInput.disabled = isCarouselLock;
    }
    if (clearTimeButton) {
        clearTimeButton.disabled = isCarouselLock;
        clearTimeButton.classList.toggle('clear-time-btn--locked', isCarouselLock);
    }

    if (carouselElement) {
        carouselElement.classList.toggle('poster-carousel--inputs-locked', isInputsLock);
        carouselElement.classList.toggle('poster-carousel--carousel-active', isCarouselLock);
    }
}
