import state from './state.js';
import { FILTER_LOCKS } from './filterLock.js';
import { clearCarouselSelection } from './carousel.js';

let activeFilterTitle = '';

/**
 * Inicializa el chip sticky de filtro de carrusel.
 * Aparece cuando hay un filtro de carrusel activo y permite quitarlo.
 */
export function initCarouselFilterChip() {
    // Capturar el título de la película cuando se aplica el filtro de carrusel
    document.addEventListener('posterCarousel:applyFilter', (event) => {
        const { title } = event.detail || {};
        activeFilterTitle = title || '';
        updateChipVisibility();
    });

    document.addEventListener('posterCarousel:clearFilter', () => {
        activeFilterTitle = '';
        updateChipVisibility();
    });

    document.addEventListener('filters:updated', updateChipVisibility);
    document.addEventListener('filterLock:changed', updateChipVisibility);

    const chip = document.getElementById('carouselFilterChip');

    if (chip) {
        chip.addEventListener('click', handleClearClick);
    }

    updateChipVisibility();
}

function handleClearClick() {
    clearCarouselSelection();
}

function updateChipVisibility() {
    const isCarouselActive = state.filterLock === FILTER_LOCKS.CAROUSEL;

    const chip = document.getElementById('carouselFilterChip');

    if (!chip) return;

    if (isCarouselActive) {
        const chipTitle = chip.querySelector('.carousel-chip-title');
        if (chipTitle) {
            chipTitle.textContent = activeFilterTitle || 'Película seleccionada';
        }

        chip.classList.add('carousel-chip--visible');
    } else {
        chip.classList.remove('carousel-chip--visible');
    }
}
