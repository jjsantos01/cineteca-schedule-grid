import state, { setNavigationData, setNavigating, resetTooltipContext } from './state.js';
import { minutesToTime, extractFilmId, getYouTubeEmbedUrl } from './utils.js';
import { getFutureShowtimesForMovie, groupShowtimesByDay, buildMovieNavigationArray } from './showtimes.js';
import {
    decodeHTMLEntities,
    extractMovieMetadata,
    generateSearchURLs,
    getEnrichedShowtime
} from './movieUtils.js';
import {
    fetchMovieDetailsWithCache,
    fetchMovieImageWithCache,
    fetchMovieTrailerWithCache
} from './apiCache.js';

// Reusable content builder for modal and inline panel
export async function buildMovieInfoContent(movie, { idPrefix = 'modal-', filmId: explicitFilmId = null } = {}) {
    const filmId = explicitFilmId || movie?.filmId || extractFilmId(movie?.href) || extractFilmIdFromTitle(movie?.titulo);
    if (!filmId) {
        return 'No hay información detallada disponible para esta película.';
    }

    const [movieDetails, imageUrl, trailerUrl] = await Promise.all([
        fetchMovieDetailsWithCache(filmId),
        fetchMovieImageWithCache(filmId),
        fetchMovieTrailerWithCache(filmId)
    ]);

    const paragraphs = movieDetails?.info || [];

    if (!paragraphs || paragraphs.length === 0) {
        return 'No se pudo obtener información adicional para esta película.';
    }

    const decodedParagraphs = paragraphs.map(text => decodeHTMLEntities(text));

    const { year, originalTitle } = extractMovieMetadata(decodedParagraphs[0], movie?.titulo || '');

    let formattedInfo = '';
    if (imageUrl || trailerUrl) {
        const embedUrl = getYouTubeEmbedUrl(trailerUrl);
        const ids = {
            poster: `${idPrefix}moviePoster`,
            play: `${idPrefix}playButton`,
            frame: `${idPrefix}trailerFrame`,
            vcontainer: `${idPrefix}videoContainer`,
        };
        formattedInfo += `
            <div class="movie-image-container">
                <div class="media-wrapper" id="${idPrefix}mediaWrapper">
        `;
        if (imageUrl) {
            formattedInfo += `<img src="${imageUrl}" alt="${movie?.titulo || ''}" class="movie-poster" id="${ids.poster}">`;
        }
        if (trailerUrl && embedUrl) {
            formattedInfo += `
                <div class="play-button-overlay" id="${ids.play}" data-embed="${embedUrl}">
                    <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
                <div class="video-container" id="${ids.vcontainer}" style="display: none;">
                    <iframe id="${ids.frame}" width="100%" height="315" frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen></iframe>
                </div>
            `;
        }
        formattedInfo += '</div></div>';
    }

    if (decodedParagraphs[0]) {
        formattedInfo += `<p class="movie-info-general">${decodedParagraphs[0]}</p>`;
    }
    if (decodedParagraphs[1]) {
        formattedInfo += `<p class="movie-info-credits">${decodedParagraphs[1]}</p>`;
    }
    if (decodedParagraphs[2]) {
        formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[2]}</p>`;
    }
    if (decodedParagraphs.length > 3) {
        for (let i = 3; i < decodedParagraphs.length; i++) {
            formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[i]}</p>`;
        }
    }

    const searchTitle = (originalTitle || movie?.titulo || '').trim();
    const { imdbUrl, letterboxdUrl, youtubeUrl } = generateSearchURLs(searchTitle, year);

    formattedInfo += `
        <div class="movie-search-links">
            <p class="search-links-title">Buscar con:</p>
            <div class="search-buttons">
                <a href="${imdbUrl}" target="_blank" rel="noopener noreferrer" class="search-button imdb-button">IMDB</a>
                <a href="${letterboxdUrl}" target="_blank" rel="noopener noreferrer" class="search-button letterboxd-button">Letterboxd</a>
                <a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" class="search-button youtube-button">YouTube</a>
            </div>
        </div>
    `;

    // Funciones futuras agrupadas por día con enlaces directos de compra (plegada por default al fondo)
    const futureShowtimes = getFutureShowtimesForMovie(movie, filmId);
    const dayGroups = groupShowtimesByDay(futureShowtimes);

    if (dayGroups.length > 0) {
        const totalShowtimes = dayGroups.reduce((acc, g) => acc + g.totalShowtimes, 0);
        formattedInfo += `
            <div class="future-showtimes-container" id="${idPrefix}futureShowtimes">
                <button type="button" class="future-showtimes-toggle" id="${idPrefix}toggleFutureShowtimes" aria-expanded="false">
                    <div class="future-showtimes-toggle-left">
                        <span class="future-showtimes-icon">📅</span>
                        <span class="future-showtimes-title">Próximas funciones</span>
                        <span class="future-showtimes-count">(${totalShowtimes})</span>
                    </div>
                    <div class="future-showtimes-chevron">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </button>
                <div class="future-showtimes-days" id="${idPrefix}futureShowtimesDays" style="display: none;">
                    ${dayGroups.map(group => `
                        <div class="future-day-group">
                            <div class="future-day-header ${group.isToday ? 'is-today' : ''} ${group.isTomorrow ? 'is-tomorrow' : ''}">
                                <span class="future-day-title">${group.dateLabel}</span>
                            </div>
                            <div class="future-day-sedes">
                                ${group.sedes.map(sedeGroup => `
                                    <div class="future-sede-row">
                                        <span class="future-sede-badge" style="background-color: ${sedeGroup.color};" title="${sedeGroup.sedeNombre}">
                                            ${sedeGroup.sedeCodigo}
                                        </span>
                                        <div class="future-showtimes-chips">
                                            ${sedeGroup.showtimes.map(st => {
                                                if (st.ticketUrl) {
                                                    return `
                                                        <a href="${st.ticketUrl}" target="_blank" rel="noopener noreferrer" class="future-showtime-chip has-ticket" title="Comprar boleto para ${st.time} en ${sedeGroup.sedeNombre}">
                                                            <span class="chip-time">${st.time}</span>
                                                            <span class="chip-icon">🎟️</span>
                                                        </a>
                                                    `;
                                                }
                                                return `
                                                    <span class="future-showtime-chip" title="${st.time} en ${sedeGroup.sedeNombre}">
                                                        <span class="chip-time">${st.time}</span>
                                                    </span>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    return formattedInfo;
}

function extractFilmIdFromTitle() {
    // When only the title is known, filmId must come from card href/context; return null here
    return null;
}

export function initModal() {
    document.addEventListener('click', (event) => {
        const modal = document.getElementById('movieInfoModal');
        if (event.target === modal) {
            closeMovieInfoModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        const modal = document.getElementById('movieInfoModal');
        if (modal.style.display === 'flex') {
            if (!state.isNavigating && event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateToPrevMovie();
            } else if (!state.isNavigating && event.key === 'ArrowRight') {
                event.preventDefault();
                navigateToNextMovie();
            } else if (event.key === 'Escape') {
                closeMovieInfoModal();
            }
        }
    });
}

export async function showMovieInfoModal(movie, horario = null) {
    // Asegura que el tooltip quede cerrado si estaba visible
    const tooltip = document.getElementById('tooltip');
    if (tooltip && tooltip.style.display !== 'none') {
        tooltip.style.display = 'none';
        if (state.tooltipOverlay) {
            state.tooltipOverlay.classList.remove('active');
        }
        resetTooltipContext();
    }
    const movies = buildMovieNavigationArray();
    let index = 0;

    if (horario) {
        index = movies.findIndex(item =>
            item.movie.titulo === movie.titulo &&
            item.movie.sedeId === movie.sedeId &&
            item.movie.sala === movie.sala &&
            item.horario === horario
        );
    } else {
        index = movies.findIndex(item =>
            item.movie.titulo === movie.titulo &&
            item.movie.sedeId === movie.sedeId
        );
    }

    if (index === -1) {
        index = 0;
    }

    setNavigationData(movies, index);
    await displayMovieInModal(index);
}

export function navigateToNextMovie() {
    if (state.isNavigating || state.currentMovieIndex >= state.allMoviesForNavigation.length - 1) {
        return;
    }

    setNavigating(true);
    disableNavigationButtons(true);
    state.currentMovieIndex += 1;
    displayMovieInModal(state.currentMovieIndex).finally(() => {
        setNavigating(false);
        disableNavigationButtons(false);
        updateNavigationButtons();
    });
}

export function navigateToPrevMovie() {
    if (state.isNavigating || state.currentMovieIndex <= 0) {
        return;
    }

    setNavigating(true);
    disableNavigationButtons(true);
    state.currentMovieIndex -= 1;
    displayMovieInModal(state.currentMovieIndex).finally(() => {
        setNavigating(false);
        disableNavigationButtons(false);
        updateNavigationButtons();
    });
}

export function closeMovieInfoModal() {
    const modal = document.getElementById('movieInfoModal');
    const trailerFrame = document.getElementById('modal-trailerFrame');
    const playButton = document.getElementById('modal-playButton');
    const videoContainer = document.getElementById('modal-videoContainer');
    const moviePoster = document.getElementById('modal-moviePoster');

    if (trailerFrame) {
        trailerFrame.src = '';
    }
    if (videoContainer) {
        videoContainer.style.display = 'none';
    }
    if (moviePoster) {
        moviePoster.style.display = 'block';
    }
    if (playButton) {
        playButton.style.display = 'flex';
    }

    modal.style.display = 'none';
}

export function playTrailer(embedUrl) {
    const playButton = document.getElementById('modal-playButton');
    const videoContainer = document.getElementById('modal-videoContainer');
    const trailerFrame = document.getElementById('modal-trailerFrame');
    const moviePoster = document.getElementById('modal-moviePoster');

    if (playButton) playButton.style.display = 'none';
    if (moviePoster) moviePoster.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'block';
    if (trailerFrame) trailerFrame.src = embedUrl;
}

async function displayMovieInModal(index) {
    if (index < 0 || index >= state.allMoviesForNavigation.length) {
        return;
    }

    state.currentMovieIndex = index;
    const currentItem = state.allMoviesForNavigation[index];
    const movie = currentItem.movie;
    const horario = currentItem.horario;
    const modal = document.getElementById('movieInfoModal');
    const modalTitle = modal.querySelector('.movie-modal-title');
    const modalInfo = modal.querySelector('.movie-modal-info');
    const modalLoading = modal.querySelector('.movie-modal-loading');

    updateNavigationButtons();

    const enriched = getEnrichedShowtime(movie, horario);
    modalTitle.innerHTML = `
        <div class="modal-title-content">
            <div class="movie-title-main">${movie.displayTitle}</div>
            <div class="movie-title-details">${horario} - ${enriched.endTime} | ${movie.salaCompleta}</div>
        </div>
    `;

    if (state.isNavigating) {
        showLoadingOverlay();
    } else {
        modalInfo.style.display = 'none';
        modalLoading.style.display = 'block';
        modal.style.display = 'flex';
    }

    // Usar buildMovieInfoContent para generar el contenido
    const formattedInfo = await buildMovieInfoContent(movie, {
        idPrefix: 'modal-',
        filmId: movie.filmId
    });

    updateModalContent(formattedInfo);

    // Wire up interactions para el contenido generado
    setTimeout(() => {
        const modal = document.getElementById('movieInfoModal');
        if (modal) {
            wireMovieInfoInteractions(modal, { idPrefix: 'modal-' });
        }
    }, 100);
}

// Wire up interactions inside a given container using a prefix
export function wireMovieInfoInteractions(container, { idPrefix = '' } = {}) {
    const toggleFutureBtn = container.querySelector(`#${idPrefix}toggleFutureShowtimes`);
    if (toggleFutureBtn) {
        const daysContainer = container.querySelector(`#${idPrefix}futureShowtimesDays`);
        toggleFutureBtn.addEventListener('click', () => {
            if (!daysContainer) return;
            const isHidden = daysContainer.style.display === 'none' || !daysContainer.style.display;
            if (isHidden) {
                daysContainer.style.display = 'flex';
                toggleFutureBtn.classList.add('is-open');
                toggleFutureBtn.setAttribute('aria-expanded', 'true');
            } else {
                daysContainer.style.display = 'none';
                toggleFutureBtn.classList.remove('is-open');
                toggleFutureBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    const toggleBtn = container.querySelector(`#${idPrefix}toggleAllShowtimes`);
    if (toggleBtn) {
        const tableElement = container.querySelector(`#${idPrefix}allShowtimesTable`);
        toggleBtn.addEventListener('click', () => {
            if (!tableElement) return;
            if (tableElement.style.display === 'none') {
                tableElement.style.display = 'block';
                toggleBtn.textContent = 'Ocultar funciones';
            } else {
                tableElement.style.display = 'none';
                const count = toggleBtn.getAttribute('data-count');
                toggleBtn.textContent = `Ver todas las funciones (${count})`;
            }
        });
    }

    const playBtn = container.querySelector(`#${idPrefix}playButton`);
    if (playBtn) {
        const moviePoster = container.querySelector(`#${idPrefix}moviePoster`);
        const videoContainer = container.querySelector(`#${idPrefix}videoContainer`);
        const trailerFrame = container.querySelector(`#${idPrefix}trailerFrame`);
        playBtn.addEventListener('click', () => {
            const embedUrl = playBtn.getAttribute('data-embed');
            if (!embedUrl || !videoContainer || !trailerFrame) return;
            playBtn.style.display = 'none';
            if (moviePoster) moviePoster.style.display = 'none';
            videoContainer.style.display = 'block';
            trailerFrame.src = embedUrl;
        });
    }
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevMovieBtn');
    const nextBtn = document.getElementById('nextMovieBtn');
    const counter = document.getElementById('movieCounter');

    if (!state.isNavigating) {
        if (prevBtn) prevBtn.disabled = state.currentMovieIndex <= 0;
        if (nextBtn) nextBtn.disabled = state.currentMovieIndex >= state.allMoviesForNavigation.length - 1;
    }

    if (counter) {
        counter.textContent = `${state.currentMovieIndex + 1} de ${state.allMoviesForNavigation.length}`;
    }
}

function disableNavigationButtons(disabled) {
    const prevBtn = document.getElementById('prevMovieBtn');
    const nextBtn = document.getElementById('nextMovieBtn');
    if (prevBtn) prevBtn.disabled = disabled;
    if (nextBtn) nextBtn.disabled = disabled;
}

function showLoadingOverlay() {
    const modal = document.getElementById('movieInfoModal');
    if (!modal) return;
    const modalBody = modal.querySelector('.movie-modal-body');
    let overlay = document.getElementById('modalLoadingOverlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalLoadingOverlay';
        overlay.className = 'modal-loading-overlay';
        overlay.innerHTML = `
            <div class="modal-loading-spinner">
                <div class="spinner"></div>
                <span>Cargando...</span>
            </div>
        `;
        modalBody.appendChild(overlay);
    }

    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('modalLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function updateModalContent(newContent) {
    const modal = document.getElementById('movieInfoModal');
    if (!modal) return;
    const modalInfo = modal.querySelector('.movie-modal-info');
    const modalLoading = modal.querySelector('.movie-modal-loading');

    modalLoading.style.display = 'none';
    hideLoadingOverlay();
    modalInfo.innerHTML = newContent;
    modalInfo.style.display = 'block';
    modalInfo.scrollTop = 0;
}
