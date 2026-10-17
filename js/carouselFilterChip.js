import state from './state.js';
import { FILTER_LOCKS } from './filterLock.js';
import { clearCarouselSelection } from './carousel.js';

let activeFilterTitle = '';
let lastTrackedFilmId = null;
let currentBlockIndex = 0;
let hasScrolledToCurrent = false;

/**
 * Inicializa el chip sticky de filtro de carrusel y los 3 chips inferiores
 * de navegación entre funciones (movie-blocks).
 */
export function initCarouselFilterChip() {
    document.addEventListener('posterCarousel:applyFilter', (event) => {
        const { filmId, title } = event.detail || {};
        activeFilterTitle = title || '';
        if (filmId !== lastTrackedFilmId) {
            lastTrackedFilmId = filmId || null;
            currentBlockIndex = 0;
            hasScrolledToCurrent = false;
            clearActiveBlockHighlight();
        }
        updateChipVisibility();
    });

    document.addEventListener('posterCarousel:clearFilter', () => {
        activeFilterTitle = '';
        lastTrackedFilmId = null;
        currentBlockIndex = 0;
        hasScrolledToCurrent = false;
        clearActiveBlockHighlight();
        updateChipVisibility();
    });

    document.addEventListener('filters:updated', () => {
        if (state.carouselFilterFilmId !== lastTrackedFilmId) {
            lastTrackedFilmId = state.carouselFilterFilmId || null;
            currentBlockIndex = 0;
            hasScrolledToCurrent = false;
            clearActiveBlockHighlight();
        }
        updateChipVisibility();
    });

    document.addEventListener('filterLock:changed', () => {
        if (state.filterLock !== FILTER_LOCKS.CAROUSEL) {
            clearActiveBlockHighlight();
        }
        updateChipVisibility();
    });

    const chip = document.getElementById('carouselFilterChip');
    if (chip) {
        chip.addEventListener('click', handleClearClick);
    }

    const prevBtn = document.getElementById('carouselNavPrev');
    const counterBtn = document.getElementById('carouselNavCounter');
    const nextBtn = document.getElementById('carouselNavNext');

    if (prevBtn) {
        prevBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            navigateMovieBlocks(-1);
        });
    }

    if (counterBtn) {
        counterBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            navigateMovieBlocks(0);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            navigateMovieBlocks(1);
        });
    }

    updateChipVisibility();
}

function handleClearClick() {
    clearCarouselSelection();
}

/**
 * Obtiene todos los movie-blocks visibles (no filtrados) ordenados
 * de arriba hacia abajo por fila/carril y de izquierda a derecha por horario.
 */
function getVisibleMovieBlocks() {
    const container = document.getElementById('scheduleContainer');
    if (!container) return [];

    const blocks = Array.from(container.querySelectorAll('.movie-block:not(.filtered-out)'));
    if (blocks.length <= 1) return blocks;

    const rows = Array.from(container.querySelectorAll('.room-row, .movies-lane'));
    const rowOrderMap = new Map();
    rows.forEach((row, idx) => rowOrderMap.set(row, idx));

    return blocks.sort((a, b) => {
        const rowA = a.closest('.room-row, .movies-lane');
        const rowB = b.closest('.room-row, .movies-lane');
        const rowIdxA = rowA && rowOrderMap.has(rowA) ? rowOrderMap.get(rowA) : 0;
        const rowIdxB = rowB && rowOrderMap.has(rowB) ? rowOrderMap.get(rowB) : 0;

        if (rowIdxA !== rowIdxB) {
            return rowIdxA - rowIdxB;
        }

        const leftA = parseFloat(a.style.left) || 0;
        const leftB = parseFloat(b.style.left) || 0;
        return leftA - leftB;
    });
}

function clearActiveBlockHighlight() {
    document.querySelectorAll('.movie-block--nav-active').forEach(el => {
        el.classList.remove('movie-block--nav-active');
    });
    document.querySelectorAll('.room-row--nav-active, .movies-lane--nav-active').forEach(el => {
        el.classList.remove('room-row--nav-active', 'movies-lane--nav-active');
    });
}

function highlightMovieBlock(block) {
    clearActiveBlockHighlight();
    if (!block) return;

    block.classList.add('movie-block--nav-active');
    const row = block.closest('.room-row');
    if (row) {
        row.classList.add('room-row--nav-active');
    }
    const lane = block.closest('.movies-lane');
    if (lane) {
        lane.classList.add('movies-lane--nav-active');
    }
}

function scrollToMovieBlock(block) {
    if (!block) return;

    highlightMovieBlock(block);

    // 1. Scroll vertical hacia el movie-block dejando margen para los chips fijos y el time-axis sticky
    const rect = block.getBoundingClientRect();
    const desiredTop = Math.max(135, Math.min(220, Math.round(window.innerHeight * 0.26)));
    const targetScrollY = Math.max(0, window.scrollY + rect.top - desiredTop);

    window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
    });

    // 2. Scroll horizontal si la cuadrícula o el contenedor tienen overflow horizontal (ej. móvil)
    const scrollContainers = [
        block.closest('.schedule-grid'),
        block.closest('.schedule-container')
    ].filter(el => el && el.scrollWidth > el.clientWidth + 2);

    const labelWidth = 100; // Ancho fijo de .room-label / .lane-label sticky
    for (const scrollEl of scrollContainers) {
        const scrollRect = scrollEl.getBoundingClientRect();
        const blockRect = block.getBoundingClientRect();
        const visibleTimelineWidth = Math.max(100, scrollEl.clientWidth - labelWidth);
        const desiredCenterX = scrollRect.left + labelWidth + (visibleTimelineWidth / 2);
        const blockCenterX = blockRect.left + (blockRect.width / 2);
        const targetScrollLeft = Math.max(0, scrollEl.scrollLeft + (blockCenterX - desiredCenterX));

        scrollEl.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
        });
    }
}

/**
 * Avanza o retrocede entre los movie-blocks visibles de la película filtrada.
 * @param {number} direction -1 para anterior (<<), 1 para siguiente (>>), 0 para ir al actual (n de N)
 */
function navigateMovieBlocks(direction) {
    const blocks = getVisibleMovieBlocks();
    const total = blocks.length;
    if (total === 0) return;

    if (currentBlockIndex >= total || currentBlockIndex < 0) {
        currentBlockIndex = 0;
    }

    if (direction === 0) {
        hasScrolledToCurrent = true;
    } else if (direction > 0) {
        if (!hasScrolledToCurrent) {
            // Primer clic en >> lleva al primer bloque (1 de N)
            currentBlockIndex = 0;
            hasScrolledToCurrent = true;
        } else {
            currentBlockIndex = (currentBlockIndex + 1) % total;
        }
    } else if (direction < 0) {
        if (!hasScrolledToCurrent) {
            // Primer clic en << lleva al último bloque (N de N)
            currentBlockIndex = total - 1;
            hasScrolledToCurrent = true;
        } else {
            currentBlockIndex = (currentBlockIndex - 1 + total) % total;
        }
    }

    const targetBlock = blocks[currentBlockIndex];
    updateNavChipsState(blocks);
    scrollToMovieBlock(targetBlock);
}

function updateNavChipsState(blocks = getVisibleMovieBlocks()) {
    const navContainer = document.getElementById('carouselNavChips');
    const prevBtn = document.getElementById('carouselNavPrev');
    const counterBtn = document.getElementById('carouselNavCounter');
    const nextBtn = document.getElementById('carouselNavNext');

    if (!navContainer || !prevBtn || !counterBtn || !nextBtn) return;

    const total = blocks.length;

    if (total === 0) {
        currentBlockIndex = 0;
        hasScrolledToCurrent = false;
        counterBtn.textContent = '0 de 0';
        counterBtn.disabled = true;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        clearActiveBlockHighlight();
        return;
    }

    if (currentBlockIndex >= total || currentBlockIndex < 0) {
        currentBlockIndex = 0;
        hasScrolledToCurrent = false;
    }

    const currentNumber = currentBlockIndex + 1;
    counterBtn.textContent = `${currentNumber} de ${total}`;
    counterBtn.disabled = false;
    prevBtn.disabled = false;
    nextBtn.disabled = false;

    const activeBlock = blocks[currentBlockIndex];
    if (activeBlock) {
        const horario = activeBlock.dataset.horario || '';
        const rowLabelEl = activeBlock.closest('.room-row, .movies-lane')?.querySelector('.room-label, .lane-label');
        const salaLabel = rowLabelEl ? rowLabelEl.textContent.trim() : '';
        const detailSuffix = [salaLabel, horario].filter(Boolean).join(' · ');
        counterBtn.title = detailSuffix
            ? `Ir a función ${currentNumber} de ${total} (${detailSuffix})`
            : `Ir a función ${currentNumber} de ${total}`;
    }

    if (hasScrolledToCurrent && activeBlock) {
        highlightMovieBlock(activeBlock);
    }
}

function updateChipVisibility() {
    const isCarouselActive = state.filterLock === FILTER_LOCKS.CAROUSEL;

    document.body.classList.toggle('has-carousel-filter-chips', isCarouselActive);

    const chip = document.getElementById('carouselFilterChip');
    const navChips = document.getElementById('carouselNavChips');
    const helpBtn = document.getElementById('helpBtn');

    if (chip) {
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

    if (navChips) {
        if (isCarouselActive) {
            updateNavChipsState();
            navChips.classList.add('carousel-nav-chips--visible');
        } else {
            navChips.classList.remove('carousel-nav-chips--visible');
            clearActiveBlockHighlight();
        }
    }

    if (helpBtn) {
        helpBtn.classList.toggle('help-btn--shifted', isCarouselActive);
    }
}
