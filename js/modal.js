import state, { setNavigationData, setNavigating } from './state.js';
import { extractFilmId, getYouTubeEmbedUrl, doMoviesOverlap } from './utils.js';
import { getFutureShowtimesForMovie, groupShowtimesByDay, buildMovieNavigationArray } from './showtimes.js';
import {
    decodeHTMLEntities,
    extractMovieMetadata,
    generateSearchURLs,
    getEnrichedShowtime
} from './movieUtils.js';
import {
    fetchMovieDataWithCache
} from './apiCache.js';
import { markMovieAsVisited } from './visited.js';
import { hasActiveFilters } from './filters.js';
import { toggleMovieSelection } from './selection.js';
import { generateCalendarLink } from './calendar.js';
import { hidePosterTooltip } from './posterTooltip.js';

// Reusable content builder for modal and inline panel
export async function buildMovieInfoContent(movie, { idPrefix = 'modal-', filmId: explicitFilmId = null, horario = null, date = null } = {}) {
    const filmId = explicitFilmId || movie?.filmId || extractFilmId(movie?.href) || extractFilmIdFromTitle(movie?.titulo);
    if (!filmId) {
        return 'No hay información detallada disponible para esta película.';
    }

    let { movieDetails, imageUrl, trailerUrl } = await fetchMovieDataWithCache(filmId);

    // Fallback a las propiedades del objeto movie (hidratadas desde el feed consolidado)
    if ((!movieDetails?.info || movieDetails.info.length === 0) && movie) {
        const fallbackInfo = Array.isArray(movie.info) && movie.info.length > 0
            ? movie.info
            : [movie.generalInfo, movie.credits, movie.synopsis].filter(Boolean);
        if (fallbackInfo.length > 0) {
            movieDetails = { info: fallbackInfo };
            imageUrl = imageUrl || movie.stillUrl || movie.posterUrl;
            trailerUrl = trailerUrl || movie.trailerUrl;
        }
    }

    const paragraphs = movieDetails?.info || [];

    if (!paragraphs || paragraphs.length === 0) {
        return 'No se pudo obtener información adicional para esta película.';
    }

    const decodedParagraphs = paragraphs.map(text => decodeHTMLEntities(text));

    const { year, originalTitle } = extractMovieMetadata(decodedParagraphs[0], movie?.titulo || '');

    let formattedInfo = '';
    if (imageUrl || trailerUrl) {
        const embedUrl = getYouTubeEmbedUrl(trailerUrl);
        let watchUrl = trailerUrl;
        if (trailerUrl && typeof trailerUrl === 'string') {
            if (trailerUrl.includes('youtu.be/')) {
                const vId = trailerUrl.split('youtu.be/')[1]?.split(/[?&#]/)[0];
                if (vId) watchUrl = `https://www.youtube.com/watch?v=${vId}`;
            } else if (trailerUrl.includes('embed/')) {
                const vId = trailerUrl.split('embed/')[1]?.split(/[?&#]/)[0];
                if (vId) watchUrl = `https://www.youtube.com/watch?v=${vId}`;
            }
        }
        const ids = {
            poster: `${idPrefix}moviePoster`,
            play: `${idPrefix}playButton`,
            frame: `${idPrefix}trailerFrame`,
            vcontainer: `${idPrefix}videoContainer`,
            toolbar: `${idPrefix}trailerToolbar`,
            togglePlay: `${idPrefix}trailerTogglePlay`,
            closeVideo: `${idPrefix}trailerCloseVideo`,
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
                <div class="play-button-overlay" id="${ids.play}" data-embed="${embedUrl}" role="button" tabindex="0" aria-label="Reproducir tráiler oficial" title="Reproducir tráiler">
                    <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
                <div class="video-container" id="${ids.vcontainer}" style="display: none;">
                    <iframe id="${ids.frame}"
                            title="Tráiler de ${movie?.titulo || 'película'}"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen
                            loading="lazy"></iframe>
                </div>
                <div class="trailer-toolbar" id="${ids.toolbar}" style="display: none;">
                    <button type="button" class="trailer-btn trailer-btn-toggle" id="${ids.togglePlay}" data-state="playing" title="Pausar o reanudar tráiler">
                        <span class="trailer-btn-icon">⏸️</span>
                        <span class="trailer-btn-label">Pausar</span>
                    </button>
                    <button type="button" class="trailer-btn trailer-btn-close" id="${ids.closeVideo}" title="Ocultar tráiler y ver imagen">
                        <span class="trailer-btn-icon">🖼️</span>
                        <span class="trailer-btn-label">Ver imagen</span>
                    </button>
                    ${watchUrl ? `
                    <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" class="trailer-btn trailer-btn-youtube" title="Ver directamente en YouTube">
                        <span class="trailer-btn-icon">▶️</span>
                        <span class="trailer-btn-label">YouTube</span>
                        <svg class="external-link-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>` : ''}
                </div>
            `;
        }
        formattedInfo += '</div></div>';
    }

    if (decodedParagraphs[0]) {
        formattedInfo += `<p class="movie-info-general">${decodedParagraphs[0]}</p>`;
    }
    if (decodedParagraphs[2]) {
        formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[2]}</p>`;
    }
    if (decodedParagraphs.length > 3) {
        for (let i = 3; i < decodedParagraphs.length; i++) {
            formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[i]}</p>`;
        }
    }
    if (decodedParagraphs[1]) {
        formattedInfo += `<p class="movie-info-credits">${decodedParagraphs[1]}</p>`;
    }

    let cinetecaUrl = '';
    if (filmId) {
        cinetecaUrl = `https://www.cinetecanacional.net/detallePelicula.php?FilmId=${filmId}`;
    } else if (movie?.href) {
        cinetecaUrl = movie.href.startsWith('http')
            ? movie.href
            : (movie.href.startsWith('/') ? `https://www.cinetecanacional.net${movie.href}` : `https://www.cinetecanacional.net/${movie.href}`);
    }


    let actionsHTML = '';
    if (horario) {
        const enriched = getEnrichedShowtime(movie, horario);
        const hasFilters = hasActiveFilters();
        const movieInfo = {
            startMinutes: enriched.startMinutes,
            endMinutes: enriched.endMinutes,
            date: date || movie.date
        };

        const isSelected = state.selectedMovies.some(m => m.uniqueId === enriched.uniqueId);
        const hasOverlap = state.selectedMovies.some(selected => doMoviesOverlap(selected, movieInfo));

        let selectBtnHTML = '';
        let warningHTML = '';

        if (hasFilters) {
            warningHTML = `
                <div class="modal-action-note modal-action-note--filters">
                    ℹ️ Selección deshabilitada con filtros activos
                </div>
            `;
        } else if (isSelected) {
            selectBtnHTML = `
                <button type="button" class="modal-action-btn btn-select selected" id="${idPrefix}selectBtn">
                    Deseleccionar
                </button>
            `;
        } else if (!hasOverlap) {
            selectBtnHTML = `
                <button type="button" class="modal-action-btn btn-select" id="${idPrefix}selectBtn">
                    Seleccionar
                </button>
            `;
        } else {
            const overlappingMovie = state.selectedMovies.find(selected =>
                doMoviesOverlap(selected, movieInfo)
            );
            const overlapText = overlappingMovie ? `${overlappingMovie.titulo} (${overlappingMovie.horario})` : 'otra función';
            warningHTML = `
                <div class="modal-action-note modal-action-note--overlap">
                    ⚠️ Traslape con ${overlapText}
                </div>
            `;
        }

        const calendarBtnHTML = `
            <button type="button" class="modal-action-btn btn-calendar" id="${idPrefix}calendarBtn">
                Agregar al calendario
            </button>
        `;

        const directTicketUrl = movie.ticketUrls?.[horario];
        const buyUrl = directTicketUrl || (movie.href ? (movie.href.startsWith('http') ? movie.href : `https://www.cinetecanacional.net/${movie.href}`) : null);

        let buyBtnHTML = '';
        if (buyUrl) {
            buyBtnHTML = `
                <a href="${buyUrl}" target="_blank" rel="noopener noreferrer" class="modal-action-btn btn-link" id="${idPrefix}buyBtn">
                    Ir a comprar
                </a>
            `;
        }

        actionsHTML = `
            <div class="modal-screening-actions">
                ${warningHTML}
                <div class="modal-screening-actions-group">
                    ${selectBtnHTML}
                    ${calendarBtnHTML}
                    ${buyBtnHTML}
                </div>
            </div>
        `;
    }

    const searchTitle = (originalTitle || movie?.titulo || '').trim();
    const { imdbUrl, letterboxdUrl, youtubeUrl } = generateSearchURLs(searchTitle, year);

    let cinetecaBtnHTML = '';
    if (cinetecaUrl) {
        cinetecaBtnHTML = `<a href="${cinetecaUrl}" target="_blank" rel="noopener noreferrer" class="search-button cineteca-button" title="Ver en página de la Cineteca">Cineteca</a>`;
    }

    formattedInfo += `
        ${actionsHTML}
        <div class="movie-search-links">
            <p class="search-links-title">Buscar con:</p>
            <div class="search-buttons">
                ${cinetecaBtnHTML}
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
            return;
        }

        const movieBlock = event.target.closest('.movie-block');
        if (!movieBlock) return;

        event.preventDefault();
        event.stopPropagation();

        const movieDataStr = movieBlock.dataset.movie?.replace(/&quot;/g, '"');
        if (!movieDataStr) return;

        let movie;
        try {
            movie = JSON.parse(movieDataStr);
        } catch (e) {
            console.error('Error parsing movie data for modal:', e);
            return;
        }

        const horario = movieBlock.dataset.horario;
        const movieDate = movieBlock.dataset.date || movie.date;
        if (movieDate && !movie.date) {
            movie.date = movieDate;
        }

        hidePosterTooltip();
        markMovieAsVisited(movie, horario);
        movieBlock.classList.add('visited');

        showMovieInfoModal(movie, horario);
    });

    document.addEventListener('keydown', (event) => {
        const modal = document.getElementById('movieInfoModal');
        if (modal && modal.style.display === 'flex') {
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
    document.body.style.overflow = 'hidden';
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
    const trailerToolbar = document.getElementById('modal-trailerToolbar');

    if (trailerFrame) {
        trailerFrame.src = '';
    }
    if (videoContainer) {
        videoContainer.style.display = 'none';
    }
    if (trailerToolbar) {
        trailerToolbar.style.display = 'none';
    }
    if (moviePoster) {
        moviePoster.style.display = 'block';
    }
    if (playButton) {
        playButton.style.display = 'flex';
    }

    if (modal) {
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
}

export function playTrailer(embedUrl) {
    const playButton = document.getElementById('modal-playButton');
    const videoContainer = document.getElementById('modal-videoContainer');
    const trailerFrame = document.getElementById('modal-trailerFrame');
    const moviePoster = document.getElementById('modal-moviePoster');
    const trailerToolbar = document.getElementById('modal-trailerToolbar');
    const togglePlayBtn = document.getElementById('modal-trailerTogglePlay');

    if (playButton) playButton.style.display = 'none';
    if (moviePoster) moviePoster.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'block';
    if (trailerToolbar) trailerToolbar.style.display = 'flex';
    if (togglePlayBtn) {
        togglePlayBtn.setAttribute('data-state', 'playing');
        const label = togglePlayBtn.querySelector('.trailer-btn-label');
        const icon = togglePlayBtn.querySelector('.trailer-btn-icon');
        if (label) label.textContent = 'Pausar';
        if (icon) icon.textContent = '⏸️';
    }
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
        document.body.style.overflow = 'hidden';
    }

    const date = currentItem.date || movie.date;

    // Usar buildMovieInfoContent para generar el contenido
    const formattedInfo = await buildMovieInfoContent(movie, {
        idPrefix: 'modal-',
        filmId: movie.filmId,
        horario,
        date
    });

    updateModalContent(formattedInfo);

    // Wire up interactions para el contenido generado
    setTimeout(() => {
        const modal = document.getElementById('movieInfoModal');
        if (modal) {
            wireMovieInfoInteractions(modal, { idPrefix: 'modal-', movie, horario, date });
        }
    }, 100);
}

// Wire up interactions inside a given container using a prefix
export function wireMovieInfoInteractions(container, { idPrefix = '', movie = null, horario = null, date = null } = {}) {
    const selectBtn = container.querySelector(`#${idPrefix}selectBtn`);
    if (selectBtn && movie && horario) {
        selectBtn.addEventListener('click', () => {
            toggleMovieSelection(movie, horario);
            closeMovieInfoModal();
        });
    }

    const calendarBtn = container.querySelector(`#${idPrefix}calendarBtn`);
    if (calendarBtn && movie && horario) {
        calendarBtn.addEventListener('click', () => {
            const movieDate = date
                ? new Date(`${date}T00:00:00`)
                : (movie.date ? new Date(`${movie.date}T00:00:00`) : state.currentDate);
            const link = generateCalendarLink(movie, horario, movieDate);
            window.open(link, '_blank');
        });
    }

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
        const trailerToolbar = container.querySelector(`#${idPrefix}trailerToolbar`);
        const togglePlayBtn = container.querySelector(`#${idPrefix}trailerTogglePlay`);
        const closeVideoBtn = container.querySelector(`#${idPrefix}trailerCloseVideo`);

        const startPlayback = () => {
            const embedUrl = playBtn.getAttribute('data-embed');
            if (!embedUrl || !videoContainer || !trailerFrame) return;
            playBtn.style.display = 'none';
            if (moviePoster) moviePoster.style.display = 'none';
            videoContainer.style.display = 'block';
            if (trailerToolbar) trailerToolbar.style.display = 'flex';
            if (togglePlayBtn) {
                togglePlayBtn.setAttribute('data-state', 'playing');
                const label = togglePlayBtn.querySelector('.trailer-btn-label');
                const icon = togglePlayBtn.querySelector('.trailer-btn-icon');
                if (label) label.textContent = 'Pausar';
                if (icon) icon.textContent = '⏸️';
            }
            trailerFrame.src = embedUrl;
        };

        playBtn.addEventListener('click', startPlayback);
        playBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startPlayback();
            }
        });

        if (togglePlayBtn) {
            togglePlayBtn.addEventListener('click', () => {
                if (!trailerFrame || !trailerFrame.contentWindow) return;
                const currentState = togglePlayBtn.getAttribute('data-state');
                const label = togglePlayBtn.querySelector('.trailer-btn-label');
                const icon = togglePlayBtn.querySelector('.trailer-btn-icon');

                if (currentState === 'paused') {
                    trailerFrame.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                    togglePlayBtn.setAttribute('data-state', 'playing');
                    if (label) label.textContent = 'Pausar';
                    if (icon) icon.textContent = '⏸️';
                } else {
                    trailerFrame.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                    togglePlayBtn.setAttribute('data-state', 'paused');
                    if (label) label.textContent = 'Reanudar';
                    if (icon) icon.textContent = '▶️';
                }
            });
        }

        if (closeVideoBtn) {
            closeVideoBtn.addEventListener('click', () => {
                if (trailerFrame) trailerFrame.src = '';
                if (videoContainer) videoContainer.style.display = 'none';
                if (trailerToolbar) trailerToolbar.style.display = 'none';
                if (moviePoster) moviePoster.style.display = 'block';
                if (playBtn) playBtn.style.display = 'flex';
            });
        }
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
