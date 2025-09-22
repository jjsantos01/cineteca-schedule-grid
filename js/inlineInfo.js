import state from './state.js';
import { buildMovieInfoContent, wireMovieInfoInteractions } from './modal.js';
import { selectFilmInCarousel, clearCarouselSelection } from './carousel.js';

function getCarouselOrder() {
    const track = document.querySelector('#posterCarousel .poster-carousel-track');
    if (!track) return [];
    return Array.from(track.querySelectorAll('.poster-card')).map(card => ({
        filmId: card.dataset.filmId,
        title: card.dataset.filterTitle || card.dataset.titleLower || ''
    }));
}

export function updatePosterInfoActions() {
    const actions = document.getElementById('posterInfoActions');
    const panel = document.getElementById('inlineMovieInfoPanel');
    if (!actions || !panel) return;

    actions.innerHTML = '';

    const selectedFilmId = state.carouselFilterFilmId;
    if (!selectedFilmId) {
        panel.innerHTML = '';
        panel.removeAttribute('data-film-id');
        return;
    }

    const btn = document.createElement('button');
    btn.id = 'tooltipInfoBtn';
    const isOpenForSelected = panel.dataset.filmId === selectedFilmId && panel.childElementCount > 0;
    btn.className = `tooltip-btn ${isOpenForSelected ? 'btn-danger' : 'btn-info'}`;
    btn.textContent = isOpenForSelected ? 'Ocultar' : 'Información';
    btn.addEventListener('click', () => {
        const open = panel.childElementCount > 0 && panel.dataset.filmId === selectedFilmId;
        if (open) {
            destroyInlineInfo();
            updatePosterInfoActions();
        } else {
            openInlineInfo(selectedFilmId);
            // After opening, update visual state
            btn.className = 'tooltip-btn btn-danger';
            btn.textContent = 'Ocultar';
        }
    });
    actions.appendChild(btn);

    // Add Deselect button
    const deselectBtn = document.createElement('button');
    deselectBtn.id = 'tooltipDeselectBtn';
    deselectBtn.className = 'tooltip-btn btn-calendar';
    deselectBtn.textContent = 'Limpiar selección';
    deselectBtn.addEventListener('click', () => {
        destroyInlineInfo();
        clearCarouselSelection();
        updatePosterInfoActions();
    });
    actions.appendChild(deselectBtn);
}

export async function openInlineInfo(filmId) {
    const panel = document.getElementById('inlineMovieInfoPanel');
    if (!panel) return;

    const order = getCarouselOrder();
    let index = order.findIndex(x => x.filmId === filmId);
    const current = order[index] || order[0];

    panel.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'movie-modal-content';

    const header = document.createElement('div');
    header.className = 'movie-modal-header';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'modal-nav-btn';
    prevBtn.id = 'inlinePrevMovieBtn';
    prevBtn.title = 'Película anterior';
    prevBtn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>';

    const titleEl = document.createElement('h3');
    titleEl.className = 'movie-modal-title';
    titleEl.textContent = current?.title || '';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'modal-nav-btn';
    nextBtn.id = 'inlineNextMovieBtn';
    nextBtn.title = 'Siguiente película';
    nextBtn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>';

    header.appendChild(prevBtn);
    header.appendChild(titleEl);
    header.appendChild(nextBtn);

    const body = document.createElement('div');
    body.className = 'movie-modal-body';
    body.innerHTML = '<div class="movie-modal-loading">Cargando información...</div><div class="movie-modal-info" style="display:none"></div>';

    container.appendChild(header);
    container.appendChild(body);
    panel.appendChild(container);

    function updateNavButtons(i) {
        prevBtn.disabled = i <= 0;
        nextBtn.disabled = i >= order.length - 1;
    }

    let currentIndex = index >= 0 ? index : 0;
    updateNavButtons(currentIndex);

    async function renderAt(i) {
        const item = order[i];
        if (!item) return;
        currentIndex = i;
        titleEl.textContent = item.title;
        panel.dataset.filmId = item.filmId;
        updateNavButtons(currentIndex);

        const infoContainer = body.querySelector('.movie-modal-info');
        const loading = body.querySelector('.movie-modal-loading');
        loading.style.display = 'block';
        infoContainer.style.display = 'none';

        const html = await buildMovieInfoContent({ titulo: item.title }, { idPrefix: 'inline-', filmId: item.filmId });
        infoContainer.innerHTML = html;
        loading.style.display = 'none';
        infoContainer.style.display = 'block';
        wireMovieInfoInteractions(infoContainer, { idPrefix: 'inline-' });
    }

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            const nextIndex = currentIndex - 1;
            renderAt(nextIndex);
            // sincroniza selección del carrusel
            state.inlineSelectionChange = true;
            selectFilmInCarousel(order[nextIndex].filmId);
            setTimeout(() => { state.inlineSelectionChange = false; }, 0);
        }
    });
    nextBtn.addEventListener('click', () => {
        if (currentIndex < order.length - 1) {
            const nextIndex = currentIndex + 1;
            renderAt(nextIndex);
            state.inlineSelectionChange = true;
            selectFilmInCarousel(order[nextIndex].filmId);
            setTimeout(() => { state.inlineSelectionChange = false; }, 0);
        }
    });

    panel.dataset.filmId = current?.filmId || '';
    renderAt(currentIndex);
}

export function destroyInlineInfo(options = {}) {
    const { keepActions = false } = options;
    const panel = document.getElementById('inlineMovieInfoPanel');
    if (panel) {
        panel.innerHTML = '';
        panel.removeAttribute('data-film-id');
    }
    if (!keepActions) {
        const actions = document.getElementById('posterInfoActions');
        if (actions) actions.innerHTML = '';
    }
}
