import state, { setTooltipOverlay, setTooltipContext, resetTooltipContext } from './state.js';
import { markMovieAsVisited } from './visited.js';
import { hasActiveFilters } from './filters.js';
import { toggleMovieSelection } from './selection.js';
import { formatDuration, getMovieUniqueId, doMoviesOverlap } from './utils.js';
import { findAllShowtimesForMovie } from './showtimes.js';
import { generateCalendarLink } from './calendar.js';
import { showMovieInfoModal } from './modal.js';
import { destroyInlineInfo, updatePosterInfoActions } from './inlineInfo.js';
import { getEnrichedShowtime, formatMovieTitle } from './movieUtils.js';
import { selectFilmInCarousel } from './carousel.js';
import { SEDES } from './config.js';
import { hidePosterTooltip } from './posterTooltip.js';

let lastBlockClickTime = 0;
let lastBlockClickedId = null;
let currentTooltipElement = null;
let repositionRafId = null;

export function initTooltip() {
    const overlay = document.createElement('div');
    overlay.className = 'tooltip-overlay';
    document.body.appendChild(overlay);
    setTooltipOverlay(overlay);

    // Dynamic repositioning on scroll from window or any scroll container (e.g. .schedule-grid)
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', handleScrollOrResize, { passive: true });
        window.visualViewport.addEventListener('resize', handleScrollOrResize, { passive: true });
    }

    // Close on outside click or tap
    document.addEventListener('click', (event) => {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip || tooltip.style.display === 'none') return;

        if (event.target.closest('#tooltip') || event.target.closest('.movie-block')) {
            return;
        }

        closeTooltip();
    });

    // Close on ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const tooltip = document.getElementById('tooltip');
            if (tooltip && tooltip.style.display !== 'none') {
                closeTooltip();
            }
        }
    });

    document.body.addEventListener('click', (event) => {
        const movieBlock = event.target.closest('.movie-block');
        if (!movieBlock) return;

        event.preventDefault();
        event.stopPropagation();

        const movieDataStr = movieBlock.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const horario = movieBlock.dataset.horario;

        const currentTime = new Date().getTime();
        const filmId = movie.filmId;
        const isDoubleClick = (currentTime - lastBlockClickTime) < 800 && lastBlockClickedId === filmId;
        lastBlockClickTime = currentTime;
        lastBlockClickedId = filmId;

        if (isDoubleClick) {
            closeTooltip();
            selectFilmInCarousel(filmId, movie.titulo);
            return;
        }

        showInteractiveTooltip(movieBlock, movie, horario);
    });
}

function handleScrollOrResize(event) {
    if (event && event.target && event.target.closest && event.target.closest('#tooltip')) {
        return;
    }

    if (!currentTooltipElement) return;
    const tooltip = document.getElementById('tooltip');
    if (!tooltip || tooltip.style.display === 'none') return;

    if (repositionRafId) {
        cancelAnimationFrame(repositionRafId);
    }
    repositionRafId = requestAnimationFrame(() => {
        repositionRafId = null;
        if (!currentTooltipElement || !tooltip || tooltip.style.display === 'none') return;
        positionTooltip(tooltip, currentTooltipElement);
    });
}

export function showInteractiveTooltip(element, movie, horario) {
    hidePosterTooltip();
    currentTooltipElement = element;
    markMovieAsVisited(movie, horario);
    element.classList.add('visited');

    const tooltip = document.getElementById('tooltip');
    const enriched = getEnrichedShowtime(movie, horario);

    setTooltipContext(movie, horario);

    const titleElement = tooltip.querySelector('.tooltip-title');
    titleElement.textContent = formatMovieTitle(movie.titulo, movie.tipoVersion);

    const movieDateKey = movie.date || element.dataset.date;
    const allShowtimes = findAllShowtimesForMovie(movie.titulo, movie.sedeId, movie.sala, horario, movieDateKey);
    let showtimesHTML = '';
    if (allShowtimes.length > 0) {
        showtimesHTML = `
            <div class="tooltip-showtimes-container">
                <button type="button" class="tooltip-showtimes-toggle" id="tooltipToggleShowtimes" aria-expanded="false">
                    <div class="tooltip-showtimes-toggle-left">
                        <span class="tooltip-showtimes-title">Otros horarios hoy</span>
                        <span class="tooltip-showtimes-count">(${allShowtimes.length})</span>
                    </div>
                    <div class="tooltip-showtimes-chevron">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </button>
                <div class="tooltip-showtimes" id="tooltipShowtimesList" style="display: none;">
                    <table class="showtimes-table">
                        <thead>
                            <tr>
                                <th>Sede</th>
                                <th>Sala</th>
                                <th>Hora</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allShowtimes.map(showtime => {
                                const sedeInfo = SEDES[showtime.sedeId] || Object.values(SEDES).find(s => s.nombre === showtime.sede || s.codigo === showtime.sede);
                                const sedeColor = sedeInfo?.color || '#2c3e50';
                                const sedeName = sedeInfo?.nombre || showtime.sede;
                                const url = showtime.ticketUrl || (showtime.href ? `https://www.cinetecanacional.net/${showtime.href}` : null);
                                const horaDisplay = url
                                    ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="showtime-ticket-link" title="Comprar boletos">${showtime.horario} 🎟️</a>`
                                    : showtime.horario;
                                const rowAttrs = url ? `data-url="${url}" title="Comprar boletos para ${showtime.horario} en ${sedeName}"` : '';
                                return `
                                    <tr ${rowAttrs}>
                                        <td><span class="showtime-sede-name" style="color: ${sedeColor}; font-weight: 700;">${sedeName}</span></td>
                                        <td>${showtime.sala}</td>
                                        <td>${horaDisplay}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    const infoElement = tooltip.querySelector('.tooltip-info');
    infoElement.innerHTML = `
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Horario:</span>
            <span class="tooltip-info-value">${horario} - ${enriched.endTime}</span>
        </div>
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Duración:</span>
            <span class="tooltip-info-value">${formatDuration(movie.duracion)}</span>
        </div>
        <div class="tooltip-info-row">
            <span class="tooltip-info-label">Sala:</span>
            <span class="tooltip-info-value">${movie.salaCompleta}</span>
        </div>
        ${showtimesHTML}
    `;

    const hasFilters = hasActiveFilters();
    if (hasFilters) {
        infoElement.innerHTML += `
            <div class="tooltip-info-row" style="color: #3498db; margin-top: 10px;">
                <span class="tooltip-info-label">ℹ️ Nota:</span>
                <span class="tooltip-info-value">Selección deshabilitada con filtros activos</span>
            </div>
        `;
    }

    const movieInfo = {
        startMinutes: enriched.startMinutes,
        endMinutes: enriched.endMinutes
    };

    const hasOverlap = state.selectedMovies.some(selected => doMoviesOverlap(selected, movieInfo));
    const isSelected = state.selectedMovies.some(m => m.uniqueId === enriched.uniqueId);

    const actionsElement = tooltip.querySelector('.tooltip-actions');
    let selectButton = '';

    if (!hasFilters) {
        if (isSelected) {
            selectButton = `
                <button class="tooltip-btn btn-select selected" id="tooltipSelectBtn">
                    Deseleccionar
                </button>
            `;
        } else if (!hasOverlap) {
            selectButton = `
                <button class="tooltip-btn btn-select" id="tooltipSelectBtn">
                    Seleccionar
                </button>
            `;
        } else {
            const overlappingMovie = state.selectedMovies.find(selected =>
                doMoviesOverlap(selected, movieInfo)
            );
            if (overlappingMovie) {
                infoElement.innerHTML += `
                    <div class="tooltip-info-row" style="color: #e74c3c; margin-top: 10px;">
                        <span class="tooltip-info-label">⚠️ Traslape:</span>
                        <span class="tooltip-info-value">${overlappingMovie.titulo} (${overlappingMovie.horario})</span>
                    </div>
                `;
            }
        }
    }

    const calendarButton = `
        <button class="tooltip-btn btn-calendar" id="tooltipCalendarBtn">
            Agregar al calendario
        </button>
    `;

    const infoButton = movie.href ? `
        <button class="tooltip-btn btn-info" id="tooltipInfoBtn">
            Información
        </button>
    ` : '';

    const directTicketUrl = movie.ticketUrls?.[horario];
    const hasBuyUrl = Boolean(directTicketUrl || movie.href);

    const buyButton = hasBuyUrl ? `
        <button class="tooltip-btn btn-link" id="tooltipBuyBtn">
            Ir a comprar
        </button>
    ` : '';

    actionsElement.innerHTML = `
        <div class="primary-actions">
            ${selectButton}
            ${infoButton}
        </div>
        <div class="secondary-actions">
            ${calendarButton}
            ${buyButton}
        </div>
    `;

    if (!selectButton && !hasBuyUrl) {
        const message = hasFilters
            ? 'Desactiva los filtros para seleccionar películas'
            : hasOverlap
                ? 'Esta película se traslapa con tu selección actual'
                : '';
        actionsElement.innerHTML = `
            <div style="text-align: center; color: #7f8c8d; font-style: italic; padding: 10px 0;">
                ${message}
            </div>
        `;
    }

    const selectBtn = actionsElement.querySelector('#tooltipSelectBtn');
    if (selectBtn) {
        selectBtn.addEventListener('click', () => {
            toggleFromTooltip();
        });
    }

    const calendarBtn = actionsElement.querySelector('#tooltipCalendarBtn');
    if (calendarBtn) {
        calendarBtn.addEventListener('click', () => {
            const movieDate = (movie.date || element.dataset.date)
                ? new Date(`${(movie.date || element.dataset.date)}T00:00:00`)
                : state.currentDate;
            const link = generateCalendarLink(movie, horario, movieDate);
            window.open(link, '_blank');
        });
    }

    const infoBtn = actionsElement.querySelector('#tooltipInfoBtn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            // Cierra inline (manteniendo los botones visibles) y tooltip, luego abre el modal
            destroyInlineInfo({ keepActions: true });
            updatePosterInfoActions();
            closeTooltip();
            showMovieInfoModal(movie, horario);
        });
    }

    const buyBtn = actionsElement.querySelector('#tooltipBuyBtn');
    if (buyBtn && hasBuyUrl) {
        buyBtn.addEventListener('click', () => {
            const targetUrl = movie.ticketUrls?.[horario] || `https://www.cinetecanacional.net/${movie.href}`;
            window.open(targetUrl, '_blank');
        });
    }

    const toggleShowtimesBtn = tooltip.querySelector('#tooltipToggleShowtimes');
    if (toggleShowtimesBtn) {
        const showtimesList = tooltip.querySelector('#tooltipShowtimesList');
        toggleShowtimesBtn.addEventListener('click', () => {
            if (!showtimesList) return;
            const isHidden = showtimesList.style.display === 'none' || !showtimesList.style.display;
            if (isHidden) {
                showtimesList.style.display = 'block';
                toggleShowtimesBtn.classList.add('is-open');
                toggleShowtimesBtn.setAttribute('aria-expanded', 'true');
            } else {
                showtimesList.style.display = 'none';
                toggleShowtimesBtn.classList.remove('is-open');
                toggleShowtimesBtn.setAttribute('aria-expanded', 'false');
            }
            positionTooltip(tooltip, element);
        });
    }

    const showtimesTable = tooltip.querySelector('.showtimes-table');
    if (showtimesTable) {
        showtimesTable.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) return; // Native click on <a> link handles it
            const row = e.target.closest('tr[data-url]');
            if (row && row.dataset.url) {
                window.open(row.dataset.url, '_blank');
            }
        });
    }

    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';

    requestAnimationFrame(() => {
        positionTooltip(tooltip, element);
        tooltip.style.visibility = 'visible';
    });
}

export function positionTooltip(tooltip, element) {
    if (!element || !tooltip) return;

    if (!element.isConnected) {
        closeTooltip();
        return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        closeTooltip();
        return;
    }

    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height || tooltip.offsetHeight;
    const tooltipWidth = tooltipRect.width || tooltip.offsetWidth;

    const margin = 10;
    const gap = 8;

    // Vertical positioning
    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const isVerticallyInView = rect.bottom > 0 && rect.top < window.innerHeight;

    let top;
    if (isVerticallyInView) {
        if (spaceAbove >= tooltipHeight + gap) {
            top = rect.top - tooltipHeight - gap;
        } else if (spaceBelow >= tooltipHeight + gap) {
            top = rect.bottom + gap;
        } else {
            if (spaceBelow >= spaceAbove) {
                top = Math.max(margin, Math.min(rect.bottom + gap, window.innerHeight - tooltipHeight - margin));
            } else {
                top = Math.max(margin, Math.min(rect.top - tooltipHeight - gap, window.innerHeight - tooltipHeight - margin));
            }
        }
    } else {
        if (rect.bottom <= 0) {
            top = rect.top - tooltipHeight - gap;
        } else {
            top = rect.bottom + gap;
        }
    }

    // Horizontal positioning
    const blockCenterX = rect.left + (rect.width / 2);
    let left = blockCenterX - (tooltipWidth / 2);

    const isHorizontallyInView = rect.right > margin && rect.left < window.innerWidth - margin;
    if (isHorizontallyInView) {
        const minLeft = margin;
        const maxLeft = Math.max(margin, window.innerWidth - tooltipWidth - margin);
        left = Math.max(minLeft, Math.min(left, maxLeft));
    }

    tooltip.style.position = 'fixed';
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

export function closeTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
    if (repositionRafId) {
        cancelAnimationFrame(repositionRafId);
        repositionRafId = null;
    }
    currentTooltipElement = null;
    if (state.tooltipOverlay) {
        state.tooltipOverlay.classList.remove('active');
    }
    resetTooltipContext();
}

export function toggleFromTooltip() {
    if (!state.currentTooltipMovie || !state.currentTooltipHorario) return;

    toggleMovieSelection(state.currentTooltipMovie, state.currentTooltipHorario);
    closeTooltip();
}

