import state from './state.js';
import { timeToMinutes } from './utils.js';
import { FILTER_LOCKS, setFilterLock, updateFilterLockUI } from './filterLock.js';
import { SEDES } from './config.js';

const POSTER_BASE_URL = 'https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic';

const posterFilmMap = new Map();
let listenersRegistered = false;

export function renderPosterCarousel(movieData, { isLoading = false } = {}) {
    const container = document.getElementById('posterCarousel');
    if (!container) {
        return;
    }

    hideShowtimesPopover();
    ensureGlobalListeners();

    const uniqueMovies = collectUniqueMoviesWithPoster(movieData);
    container.innerHTML = '';

    if (uniqueMovies.length === 0) {
        const hasMovies = Object.values(movieData).some(movies => Array.isArray(movies) && movies.length > 0);
        const message = isLoading
            ? 'Cargando posters disponibles...'
            : hasMovies
                ? 'No se encontraron posters para las películas actuales.'
                : 'Selecciona una fecha y sede con funciones disponibles para ver los posters.';

        const emptyState = document.createElement('div');
        emptyState.className = 'poster-carousel-empty';
        emptyState.textContent = message;
        container.appendChild(emptyState);
        updatePosterCarouselHighlights();
        updateFilterLockUI();
        return;
    }

    const track = document.createElement('div');
    track.className = 'poster-carousel-track';
    track.setAttribute('role', 'list');

    for (const movie of uniqueMovies) {
        const card = createPosterCard(movie);
        track.appendChild(card);
    }

    container.appendChild(track);
    setupPosterCardInteractions(track);
    updatePosterCarouselHighlights();
    updateFilterLockUI();
}

export function selectFilmInCarousel(filmId, fallbackTitle = '') {
    const container = document.getElementById('posterCarousel');
    const card = container ? container.querySelector(`.poster-card[data-film-id="${filmId}"]`) : null;
    
    // Si no hay tarjeta (ej. sin poster), usamos el fallbackTitle
    const title = card ? card.dataset.filterTitle : fallbackTitle;
    if (!filmId) return;

    state.carouselFilterFilmId = filmId;
    setFilterLock(FILTER_LOCKS.CAROUSEL);
    document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', { detail: { filmId, title } }));
    updatePosterCarouselHighlights();
    updateFilterLockUI();
}

export function clearCarouselSelection() {
    const previous = state.carouselFilterFilmId;
    state.carouselFilterFilmId = null;
    setFilterLock(FILTER_LOCKS.NONE);
    document.dispatchEvent(new CustomEvent('posterCarousel:clearFilter', { detail: { filmId: previous } }));
    updatePosterCarouselHighlights();
    updateFilterLockUI();
}

function ensureGlobalListeners() {
    if (listenersRegistered) {
        return;
    }

    document.addEventListener('filters:updated', () => {
        updatePosterCarouselHighlights();
    });

    document.addEventListener('filterLock:changed', () => {
        updatePosterCarouselHighlights();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.carouselFilterFilmId) {
            const modal = document.getElementById('movieInfoModal');
            const helpModal = document.getElementById('helpModal');
            const isModalOpen = (modal && modal.style.display === 'flex') || (helpModal && helpModal.classList.contains('help-modal-backdrop--visible'));
            const isTourActive = document.body.classList.contains('tour-active');
            if (isModalOpen || isTourActive) {
                return;
            }

            clearCarouselSelection();
        }
    });

    listenersRegistered = true;
}

function collectUniqueMoviesWithPoster(movieData) {
    posterFilmMap.clear();
    const moviesByFilmId = new Map();

    for (const [sedeId, movies] of Object.entries(movieData)) {
        if (!Array.isArray(movies)) {
            continue;
        }

        for (const movie of movies) {
            const filmId = movie.filmId;
            if (!filmId) {
                continue;
            }

            const currentSedeId = sedeId || movie.sedeId;
            const displayTitle = movie.displayTitle;
            const titleLower = displayTitle.toLowerCase();

            if (!moviesByFilmId.has(filmId)) {
                moviesByFilmId.set(filmId, {
                    title: displayTitle,
                    titleLower,
                    filmId,
                    movies: [movie],
                    sedeIds: new Set(currentSedeId ? [currentSedeId] : [])
                });
            } else {
                const entry = moviesByFilmId.get(filmId);
                entry.movies.push(movie);
                if (currentSedeId) {
                    entry.sedeIds.add(currentSedeId);
                }
            }
        }
    }

    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    const uniqueMovies = Array.from(moviesByFilmId.values()).sort((a, b) => collator.compare(a.title, b.title));

    for (const movie of uniqueMovies) {
        posterFilmMap.set(movie.filmId, movie);
    }

    return uniqueMovies;
}

function getSedeShowtimesData(movie, sedeId) {
    const sedeMovies = (movie.movies || []).filter(m => (m.sedeId || sedeId) === sedeId);

    const salaMap = new Map();
    const allTimesSet = new Set();

    for (const m of sedeMovies) {
        const salaName = m.sala ? `Sala ${m.sala}` : (m.salaCompleta || 'Sala principal');
        if (!salaMap.has(salaName)) {
            salaMap.set(salaName, { times: new Set(), ticketUrls: {} });
        }
        const entry = salaMap.get(salaName);
        for (const h of (m.horarios || [])) {
            entry.times.add(h);
            allTimesSet.add(h);
            if (m.ticketUrls?.[h]) {
                entry.ticketUrls[h] = m.ticketUrls[h];
            } else if (m.href) {
                entry.ticketUrls[h] = `https://www.cinetecanacional.net/${m.href}`;
            }
        }
    }

    const allHorarios = Array.from(allTimesSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

    const salasDetail = Array.from(salaMap.entries()).map(([sala, entry]) => ({
        sala,
        horarios: Array.from(entry.times).sort((a, b) => timeToMinutes(a) - timeToMinutes(b)),
        ticketUrls: entry.ticketUrls
    })).sort((a, b) => a.sala.localeCompare(b.sala, 'es', { numeric: true }));

    return {
        allHorarios,
        salasDetail
    };
}

let showtimesPopover = null;
let popoverHideTimeout = null;
let activePopoverTag = null;

function ensureShowtimesPopover() {
    if (showtimesPopover) return showtimesPopover;

    showtimesPopover = document.createElement('div');
    showtimesPopover.id = 'posterShowtimesPopover';
    showtimesPopover.className = 'poster-showtimes-popover';
    showtimesPopover.setAttribute('role', 'tooltip');
    showtimesPopover.setAttribute('aria-hidden', 'true');

    showtimesPopover.addEventListener('mouseenter', () => {
        if (popoverHideTimeout) {
            clearTimeout(popoverHideTimeout);
            popoverHideTimeout = null;
        }
    });

    showtimesPopover.addEventListener('mouseleave', () => {
        scheduleHidePopover();
    });

    showtimesPopover.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.body.appendChild(showtimesPopover);

    window.addEventListener('scroll', () => hideShowtimesPopover(), { passive: true });

    document.addEventListener('click', (e) => {
        if (activePopoverTag && !showtimesPopover.contains(e.target) && !activePopoverTag.contains(e.target)) {
            hideShowtimesPopover();
        }
    });

    return showtimesPopover;
}

function showShowtimesPopover(tag) {
    if (popoverHideTimeout) {
        clearTimeout(popoverHideTimeout);
        popoverHideTimeout = null;
    }

    const data = tag._showtimesData;
    if (!data || !data.allHorarios || data.allHorarios.length === 0) return;

    const popover = ensureShowtimesPopover();
    activePopoverTag = tag;

    const { sede, salasDetail } = data;

    let salasHTML = '';
    if (salasDetail && salasDetail.length > 0) {
        salasHTML = salasDetail.map(s => `
            <div class="poster-showtimes-popover-sala-row">
                <div class="poster-showtimes-popover-sala-header">
                    <span class="poster-showtimes-popover-badge ${sede.className}">${sede.codigo}</span>
                    <span class="poster-showtimes-popover-sala-name">${s.sala}</span>
                </div>
                <div class="poster-showtimes-popover-times">
                    ${s.horarios.map(h => {
                        const url = s.ticketUrls?.[h];
                        if (url) {
                            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="poster-showtimes-popover-time-pill" title="Comprar boletos">${h} 🎟️</a>`;
                        }
                        return `<span class="poster-showtimes-popover-time-pill">${h}</span>`;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    popover.innerHTML = `
        <div class="poster-showtimes-popover-salas">
            ${salasHTML}
        </div>
    `;

    popover.classList.add('visible');
    popover.setAttribute('aria-hidden', 'false');

    positionShowtimesPopover(popover, tag);
}

function positionShowtimesPopover(popover, tag) {
    const rect = tag.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const margin = 10;

    let top = rect.top - popoverRect.height - 8;
    if (top < margin) {
        top = rect.bottom + 8;
    }

    let left = rect.left + (rect.width / 2) - (popoverRect.width / 2);

    if (left + popoverRect.width > window.innerWidth - margin) {
        left = window.innerWidth - popoverRect.width - margin;
    }
    if (left < margin) {
        left = margin;
    }

    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
}

function scheduleHidePopover(delay = 150) {
    if (popoverHideTimeout) {
        clearTimeout(popoverHideTimeout);
    }
    popoverHideTimeout = setTimeout(() => {
        hideShowtimesPopover();
    }, delay);
}

export function hideShowtimesPopover() {
    if (!showtimesPopover) return;
    showtimesPopover.classList.remove('visible');
    showtimesPopover.setAttribute('aria-hidden', 'true');
    activePopoverTag = null;
    if (popoverHideTimeout) {
        clearTimeout(popoverHideTimeout);
        popoverHideTimeout = null;
    }
}

function createPosterCard(movie) {
    const card = document.createElement('article');
    card.className = 'poster-card';
    card.setAttribute('role', 'listitem');
    card.dataset.filmId = movie.filmId;
    card.dataset.filterTitle = movie.title;
    card.dataset.titleLower = movie.titleLower;

    const title = document.createElement('h3');
    title.className = 'poster-card-title';
    title.textContent = movie.title;

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'poster-card-image-wrapper';

    const image = document.createElement('img');
    image.className = 'poster-card-image';
    image.src = `${POSTER_BASE_URL}/${movie.filmId}`;
    image.alt = `Poster de ${movie.title}`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => handlePosterError(imageWrapper, image));

    imageWrapper.appendChild(image);
    card.appendChild(title);
    card.appendChild(imageWrapper);

    if (movie.sedeIds && movie.sedeIds.size > 0) {
        const sedesContainer = document.createElement('div');
        sedesContainer.className = 'poster-card-sedes';

        // Orden consistente: CNA ('002'), XOCO ('003'), CHAPULTEPEC ('001')
        const sedeOrder = { '002': 1, '003': 2, '001': 3 };
        const sortedSedeIds = Array.from(movie.sedeIds)
            .filter(id => SEDES[id])
            .sort((a, b) => (sedeOrder[a] || 99) - (sedeOrder[b] || 99));

        for (const sedeId of sortedSedeIds) {
            const sede = SEDES[sedeId];
            const { allHorarios, salasDetail } = getSedeShowtimesData(movie, sedeId);

            const tag = document.createElement('span');
            tag.className = `poster-card-sede-tag ${sede.className}`;
            tag.setAttribute('role', 'button');
            tag.setAttribute('tabindex', '0');
            tag.dataset.sedeId = sedeId;

            const codeSpan = document.createElement('span');
            codeSpan.className = 'sede-code';
            codeSpan.textContent = sede.codigo;
            tag.appendChild(codeSpan);

            if (allHorarios.length > 0) {
                const previewTimes = allHorarios.slice(0, 3);
                const previewSpan = document.createElement('span');
                previewSpan.className = 'sede-showtimes-preview';
                previewSpan.textContent = previewTimes.join(' · ');
                tag.appendChild(previewSpan);

                if (allHorarios.length > 3) {
                    const moreSpan = document.createElement('span');
                    moreSpan.className = 'sede-more-tag';
                    moreSpan.textContent = `+${allHorarios.length - 3}`;
                    moreSpan.title = `Ver ${allHorarios.length - 3} funciones más`;
                    tag.appendChild(moreSpan);
                }
            }

            tag._showtimesData = {
                sede,
                movieTitle: movie.title,
                allHorarios,
                salasDetail
            };

            let lastMouseEnterTime = 0;

            tag.addEventListener('mouseenter', () => {
                lastMouseEnterTime = Date.now();
                showShowtimesPopover(tag);
            });
            tag.addEventListener('mouseleave', () => scheduleHidePopover());
            tag.addEventListener('click', (event) => {
                event.stopPropagation();
                const timeSinceHover = Date.now() - lastMouseEnterTime;
                if (activePopoverTag === tag && showtimesPopover && showtimesPopover.classList.contains('visible')) {
                    if (timeSinceHover < 500) {
                        return; // Evita cerrar si el usuario hizo clic inmediatamente al pasar el cursor
                    }
                    hideShowtimesPopover();
                } else {
                    showShowtimesPopover(tag);
                }
            });
            tag.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    if (activePopoverTag === tag && showtimesPopover && showtimesPopover.classList.contains('visible')) {
                        hideShowtimesPopover();
                    } else {
                        showShowtimesPopover(tag);
                    }
                }
            });

            sedesContainer.appendChild(tag);
        }

        card.appendChild(sedesContainer);
    }

    return card;
}

function setupPosterCardInteractions(track) {
    const cards = track.querySelectorAll('.poster-card');
    cards.forEach(card => {
        card.addEventListener('click', handlePosterCardClick);
    });
}

let lastClickTime = 0;
let lastClickedFilmId = null;

function handlePosterCardClick(event) {
    if (event.target.closest('.poster-card-sede-tag')) {
        return;
    }

    const card = event.currentTarget;
    const filmId = card.dataset.filmId;
    if (!filmId) {
        return;
    }

    if (state.filterLock === FILTER_LOCKS.INPUTS) {
        return;
    }

    const currentTime = new Date().getTime();
    const isDoubleClick = (currentTime - lastClickTime) < 400 && lastClickedFilmId === filmId;
    lastClickTime = currentTime;
    lastClickedFilmId = filmId;

    const isCurrentSelection = state.carouselFilterFilmId === filmId;

    if (isDoubleClick) {
        state.carouselFilterFilmId = filmId;
        setFilterLock(FILTER_LOCKS.CAROUSEL);
        document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', {
            detail: {
                filmId,
                title: card.dataset.filterTitle || '',
                forceOpenInfo: true
            }
        }));
        updatePosterCarouselHighlights();
        return;
    }

    if (isCurrentSelection) {
        state.carouselFilterFilmId = null;
        setFilterLock(FILTER_LOCKS.NONE);
        document.dispatchEvent(new CustomEvent('posterCarousel:clearFilter', {
            detail: { filmId }
        }));
        updatePosterCarouselHighlights();
        return;
    }

    state.carouselFilterFilmId = filmId;
    setFilterLock(FILTER_LOCKS.CAROUSEL);
    document.dispatchEvent(new CustomEvent('posterCarousel:applyFilter', {
        detail: {
            filmId,
            title: card.dataset.filterTitle || ''
        }
    }));
    updatePosterCarouselHighlights();
}

function updatePosterCarouselHighlights() {
    const container = document.getElementById('posterCarousel');
    if (!container) {
        return;
    }

    const cards = container.querySelectorAll('.poster-card');
    if (cards.length === 0) {
        return;
    }

    let selectedFilmId = state.carouselFilterFilmId;
    if (selectedFilmId && !posterFilmMap.has(selectedFilmId)) {
        state.carouselFilterFilmId = null;
        selectedFilmId = null;
        if (state.filterLock === FILTER_LOCKS.CAROUSEL) {
            setFilterLock(FILTER_LOCKS.NONE);
        }
    }

    const hasSelectedFilm = Boolean(selectedFilmId);
    const hasTextFilter = state.movieFilter !== '';
    const hasTimeFilter = Boolean(state.timeFilterStart || state.timeFilterEnd);
    const hasActiveFilters = hasTextFilter || hasTimeFilter;

    cards.forEach(card => {
        const filmId = card.dataset.filmId;
        const filmData = posterFilmMap.get(filmId);
        const matchesFilters = filmMatchesActiveFilters(filmData);
        const isSelected = hasSelectedFilm && selectedFilmId === filmId;

        card.classList.toggle('poster-card--selected', isSelected || (!hasSelectedFilm && hasActiveFilters && matchesFilters));
        card.classList.toggle('poster-card--dimmed',
            hasSelectedFilm ? selectedFilmId !== filmId : (hasActiveFilters ? !matchesFilters : false)
        );
    });
}

function filmMatchesActiveFilters(filmData) {
    if (!filmData) {
        return false;
    }

    if (state.movieFilter && !filmData.titleLower.includes(state.movieFilter)) {
        return false;
    }

    if (!state.timeFilterStart && !state.timeFilterEnd) {
        return true;
    }

    const startMinutes = state.timeFilterStart ? timeToMinutes(state.timeFilterStart) : 0;
    const endMinutes = state.timeFilterEnd ? timeToMinutes(state.timeFilterEnd) : 24 * 60;

    return filmData.movies.some(movie =>
        Array.isArray(movie.horarios) && movie.horarios.some(horario => {
            const minutes = timeToMinutes(horario);
            return minutes >= startMinutes && minutes <= endMinutes;
        })
    );
}

function handlePosterError(wrapper, image) {
    image.remove();
    wrapper.classList.add('poster-card-image-wrapper--error');
    const fallback = document.createElement('div');
    fallback.className = 'poster-card-image-fallback';
    fallback.textContent = 'Poster no disponible';
    wrapper.appendChild(fallback);
}
