import { POSTER_BASE_URL, SEDES } from './config.js';
import { extractFilmId } from './utils.js';

let posterTooltipEl = null;
let activeBlock = null;
let repositionRaf = null;

/**
 * Ensures the poster tooltip DOM container is created once.
 */
function ensurePosterTooltipElement() {
    if (posterTooltipEl) return posterTooltipEl;

    posterTooltipEl = document.createElement('div');
    posterTooltipEl.id = 'moviePosterTooltip';
    posterTooltipEl.className = 'movie-poster-tooltip';
    posterTooltipEl.setAttribute('role', 'tooltip');
    posterTooltipEl.setAttribute('aria-hidden', 'true');

    posterTooltipEl.innerHTML = `
        <div class="poster-tooltip-img-wrapper">
            <img class="poster-tooltip-img" alt="" loading="eager" />
            <div class="poster-tooltip-fallback">
                <span class="poster-tooltip-fallback-icon">🎬</span>
                <span>Poster no disponible</span>
            </div>
        </div>
        <div class="poster-tooltip-caption">
            <div class="poster-tooltip-title"></div>
            <div class="poster-tooltip-meta">
                <span class="poster-tooltip-badge"></span>
                <span class="poster-tooltip-details"></span>
            </div>
        </div>
    `;

    const img = posterTooltipEl.querySelector('.poster-tooltip-img');
    img.addEventListener('load', () => {
        if (posterTooltipEl) {
            posterTooltipEl.classList.remove('has-error');
        }
    });
    img.addEventListener('error', () => {
        if (posterTooltipEl) {
            posterTooltipEl.classList.add('has-error');
        }
    });

    document.body.appendChild(posterTooltipEl);
    return posterTooltipEl;
}

/**
 * Positions the poster tooltip relative to the hovered movie block.
 */
export function positionPosterTooltip(tooltip, block) {
    if (!tooltip || !block || !block.isConnected) {
        hidePosterTooltip();
        return;
    }

    const rect = block.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
        hidePosterTooltip();
        return;
    }

    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height || 230;
    const tooltipWidth = tooltipRect.width || 140;
    const margin = 8;
    const gap = 8;

    // Vertical positioning: prefer above the block, fallback below
    let top;
    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;

    if (spaceAbove >= tooltipHeight + gap) {
        top = rect.top - tooltipHeight - gap;
    } else if (spaceBelow >= tooltipHeight + gap) {
        top = rect.bottom + gap;
    } else {
        if (spaceAbove >= spaceBelow) {
            top = Math.max(margin, rect.top - tooltipHeight - gap);
        } else {
            top = Math.min(window.innerHeight - tooltipHeight - margin, rect.bottom + gap);
        }
    }

    // Horizontal positioning: center on block and clamp within viewport
    const blockCenterX = rect.left + (rect.width / 2);
    let left = blockCenterX - (tooltipWidth / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));

    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
}

/**
 * Shows the poster tooltip for a specific movie block.
 */
export function showPosterTooltip(block) {
    if (!block || !block.isConnected) return;

    // Don't show if interactive modal, tour, or click tooltip is open
    const clickTooltip = document.getElementById('tooltip');
    if (clickTooltip && clickTooltip.style.display !== 'none') return;

    const modal = document.getElementById('movieInfoModal');
    if (modal && modal.style.display === 'flex') return;

    if (document.body.classList.contains('tour-active')) return;

    const movieDataStr = block.dataset.movie?.replace(/&quot;/g, '"');
    if (!movieDataStr) return;

    let movie;
    try {
        movie = JSON.parse(movieDataStr);
    } catch (e) {
        console.error('Error parsing movie data for poster tooltip:', e);
        return;
    }

    const horario = block.dataset.horario || '';
    const filmId = movie.filmId || extractFilmId(movie.href);
    const posterUrl = movie.posterUrl || (filmId ? `${POSTER_BASE_URL}/${filmId}` : null);
    const tooltip = ensurePosterTooltipElement();

    const titleEl = tooltip.querySelector('.poster-tooltip-title');
    const badgeEl = tooltip.querySelector('.poster-tooltip-badge');
    const detailsEl = tooltip.querySelector('.poster-tooltip-details');
    const imgEl = tooltip.querySelector('.poster-tooltip-img');

    titleEl.textContent = movie.displayTitle || movie.titulo || '';

    const sedeInfo = SEDES[movie.sedeId] || Object.values(SEDES).find(s => s.nombre === movie.sede || s.codigo === movie.sede);
    if (sedeInfo) {
        badgeEl.textContent = sedeInfo.codigo;
        badgeEl.style.backgroundColor = sedeInfo.color;
        badgeEl.style.display = 'inline-block';
    } else if (movie.sedeCodigo) {
        badgeEl.textContent = movie.sedeCodigo;
        badgeEl.style.backgroundColor = '#2c3e50';
        badgeEl.style.display = 'inline-block';
    } else {
        badgeEl.style.display = 'none';
    }

    const durationText = movie.duracion ? `${movie.duracion} min` : '';
    detailsEl.textContent = [horario, durationText].filter(Boolean).join(' · ');

    if (posterUrl) {
        tooltip.classList.remove('has-error');
        imgEl.src = posterUrl;
        imgEl.alt = `Poster de ${movie.displayTitle || movie.titulo}`;
    } else {
        imgEl.removeAttribute('src');
        tooltip.classList.add('has-error');
    }

    activeBlock = block;
    positionPosterTooltip(tooltip, block);
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
}

/**
 * Hides the poster hover tooltip.
 */
export function hidePosterTooltip() {
    if (!posterTooltipEl) return;
    posterTooltipEl.classList.remove('visible');
    posterTooltipEl.setAttribute('aria-hidden', 'true');
    activeBlock = null;
    if (repositionRaf) {
        cancelAnimationFrame(repositionRaf);
        repositionRaf = null;
    }
}

function handleScrollOrResize() {
    if (!activeBlock || !posterTooltipEl || !posterTooltipEl.classList.contains('visible')) return;

    if (repositionRaf) {
        cancelAnimationFrame(repositionRaf);
    }
    repositionRaf = requestAnimationFrame(() => {
        repositionRaf = null;
        if (!activeBlock || !posterTooltipEl || !posterTooltipEl.classList.contains('visible')) return;
        positionPosterTooltip(posterTooltipEl, activeBlock);
    });
}

/**
 * Initializes global event listeners for the poster hover tooltip.
 */
export function initPosterTooltip() {
    ensurePosterTooltipElement();

    // Event delegation on mouseover
    document.body.addEventListener('mouseover', (event) => {
        const block = event.target.closest('.movie-block');
        if (!block) return;
        if (block === activeBlock) return;

        showPosterTooltip(block);
    });

    // Event delegation on mouseout
    document.body.addEventListener('mouseout', (event) => {
        const block = event.target.closest('.movie-block');
        if (!block) return;

        const related = event.relatedTarget;
        if (block.contains(related)) return; // cursor still inside the block

        if (activeBlock === block) {
            hidePosterTooltip();
        }
    });

    // Reposition on scroll / resize
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', handleScrollOrResize, { passive: true });
        window.visualViewport.addEventListener('resize', handleScrollOrResize, { passive: true });
    }

    // Dismiss on click, touchstart or Escape
    document.addEventListener('click', () => hidePosterTooltip());
    document.addEventListener('touchstart', () => hidePosterTooltip(), { passive: true });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hidePosterTooltip();
        }
    });
}
