/**
 * tour.js - Onboarding Tour interactivo para Cineteca Schedule Grid
 * Implementación nativa y ligera (zero dependencies) con spotlight animado y popovers inteligentes.
 */

import state from './state.js';
import { toggleMovieSelection, clearSelection } from './selection.js';

const TOUR_STEPS = [
    {
        target: '.date-selector',
        title: '📅 Selector de Fechas',
        content: 'Navega entre días usando las flechas <strong>&lt;</strong> y <strong>&gt;</strong> o haz clic en la fecha para abrir el calendario. Puedes consultar la cartelera de hoy y hasta <strong>7 días en el futuro</strong>.',
        placement: 'bottom'
    },
    {
        target: '.sedes-selector',
        title: '🏛️ Selector de Sedes',
        content: 'Activa o desactiva las sedes de la Cineteca: <strong>CENART</strong> (morado), <strong>XOCO</strong> (rojo) y <strong>CHAPULTEPEC</strong> (verde). ¡Puedes marcar varias al mismo tiempo para comparar horarios y salas!',
        placement: 'bottom'
    },
    {
        target: '#movieFilter',
        title: '🔍 Búsqueda por Película',
        content: 'Escribe cualquier palabra del título de una película para filtrar la cartelera al instante. La cuadrícula mostrará solo las funciones que coincidan.',
        placement: 'bottom'
    },
    {
        target: '.filter-group:nth-child(3)',
        title: '⏰ Filtro por Horario',
        content: 'Define una hora de inicio y/o fin (ej. 16:00 a 20:00) para ver únicamente las funciones que comienzan en tu ventana de tiempo ideal. Usa <em>Limpiar</em> para resetearlo.',
        placement: 'bottom'
    },
    {
        target: '#shareButton',
        title: '🔗 Compartir Cartelera',
        content: 'Copia un enlace directo que guarda tus sedes seleccionadas, fecha y filtros activos. Ideal para mandar la programación a tus acompañantes.',
        placement: 'bottom'
    },
    {
        target: '#posterCarousel',
        title: '🎬 Carrusel de Pósters',
        content: 'Explora visualmente los pósters de todas las películas programadas hoy. Al hacer <strong>clic en un póster</strong>, la cuadrícula se filtra exclusivamente para esa película.',
        placement: 'bottom'
    },
    {
        target: '.sede-container',
        scrollBlock: 'start',
        title: '📊 Cuadrícula de Horarios (Grid)',
        content: 'Cada fila representa una sala y cada bloque una función con su duración exacta.<br><br>💡 <strong>Haz clic en cualquier bloque</strong> para abrir sus opciones: ver detalles, comprar boletos, ver el tráiler oficial o consultar otros horarios del día.',
        placement: 'bottom'
    },
    {
        target: '.movie-block.selected, .movie-block',
        isDemoSelection: true,
        scrollBlock: 'start',
        title: '⚡ Planificador de Itinerario y Traslapes',
        content: '<p>¡Arma tu recorrido del día fácilmente! Al hacer <strong>clic sobre una función</strong> y presionar <strong>"Seleccionar"</strong>, puedes marcar varias películas.</p><p>✨ <strong>Detección de traslapes en vivo:</strong> El sistema resalta de inmediato las películas que se empalman en horario para que agendes tu visita sin conflictos.</p><div class="tour-demo-card"><div class="tour-demo-row"><span class="tour-tag-selected">✓ Seleccionada</span><span>Película agregada a tu itinerario</span></div><div class="tour-demo-row"><span class="tour-tag-overlap">⚠️ Traslape</span><span>Funciones en conflicto deshabilitadas</span></div></div>',
        placement: 'bottom'
    },
    {
        target: '#helpBtn',
        title: '❓ Ayuda y Guía Completa',
        content: '¡Listo! Puedes volver a abrir esta guía, consultar todas las funciones a detalle o reiniciar este tour en cualquier momento haciendo clic en este botón.',
        placement: 'bottom'
    }
];

let currentStepIndex = 0;
let isTourRunning = false;
let spotlightElement = null;
let popoverElement = null;
let backdropOverlay = null;
let onTourCompleteCallback = null;
let demoSelectionActive = false;

export function isTourActive() {
    return isTourRunning;
}

export function startTour(options = {}) {
    if (isTourRunning) {
        stopTour();
    }

    onTourCompleteCallback = options.onComplete || null;
    isTourRunning = true;
    currentStepIndex = 0;

    createTourDOM();
    bindTourEvents();
    renderStep(currentStepIndex);
}

export function stopTour() {
    if (!isTourRunning) return;

    if (demoSelectionActive) {
        clearSelection();
        demoSelectionActive = false;
    }

    isTourRunning = false;
    unbindTourEvents();
    removeTourDOM();

    if (typeof onTourCompleteCallback === 'function') {
        const cb = onTourCompleteCallback;
        onTourCompleteCallback = null;
        cb();
    }
}

export function nextStep() {
    if (!isTourRunning) return;
    if (currentStepIndex < TOUR_STEPS.length - 1) {
        currentStepIndex++;
        renderStep(currentStepIndex);
    } else {
        stopTour();
    }
}

export function prevStep() {
    if (!isTourRunning) return;
    if (currentStepIndex > 0) {
        currentStepIndex--;
        renderStep(currentStepIndex);
    }
}

function createTourDOM() {
    // Backdrop invisible/clickeable para bloquear interacción accidental
    backdropOverlay = document.createElement('div');
    backdropOverlay.className = 'tour-backdrop-overlay';
    backdropOverlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdropOverlay);

    // Spotlight box
    spotlightElement = document.createElement('div');
    spotlightElement.className = 'tour-spotlight';
    spotlightElement.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spotlightElement);

    // Popover box
    popoverElement = document.createElement('div');
    popoverElement.className = 'tour-popover';
    popoverElement.setAttribute('role', 'dialog');
    popoverElement.setAttribute('aria-modal', 'true');
    popoverElement.setAttribute('aria-label', 'Tour guiado');
    document.body.appendChild(popoverElement);
}

function removeTourDOM() {
    if (spotlightElement && spotlightElement.parentNode) {
        spotlightElement.parentNode.removeChild(spotlightElement);
    }
    if (popoverElement && popoverElement.parentNode) {
        popoverElement.parentNode.removeChild(popoverElement);
    }
    if (backdropOverlay && backdropOverlay.parentNode) {
        backdropOverlay.parentNode.removeChild(backdropOverlay);
    }
    spotlightElement = null;
    popoverElement = null;
    backdropOverlay = null;
}

function bindTourEvents() {
    window.addEventListener('resize', handleWindowUpdate);
    window.addEventListener('scroll', handleWindowUpdate, true);
    document.addEventListener('keydown', handleKeyDown);
    if (backdropOverlay) {
        backdropOverlay.addEventListener('click', stopTour);
    }
}

function unbindTourEvents() {
    window.removeEventListener('resize', handleWindowUpdate);
    window.removeEventListener('scroll', handleWindowUpdate, true);
    document.removeEventListener('keydown', handleKeyDown);
}

function handleKeyDown(event) {
    if (!isTourRunning) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        stopTour();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextStep();
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevStep();
    }
}

let updateThrottleTimeout = null;
function handleWindowUpdate() {
    if (!isTourRunning || updateThrottleTimeout) return;
    updateThrottleTimeout = setTimeout(() => {
        updateThrottleTimeout = null;
        if (isTourRunning) {
            positionTourElements(TOUR_STEPS[currentStepIndex]);
        }
    }, 50);
}

function handleStepDemo(step) {
    if (step.isDemoSelection) {
        if (!demoSelectionActive && state.selectedMovies.length === 0) {
            const availableBlock = document.querySelector('.sede-container .movie-block:not(.filtered-out)') ||
                                   document.querySelector('.movie-block:not(.filtered-out)');
            if (availableBlock) {
                try {
                    const movieDataStr = availableBlock.dataset.movie.replace(/&quot;/g, '"');
                    const movie = JSON.parse(movieDataStr);
                    const horario = availableBlock.dataset.horario;
                    toggleMovieSelection(movie, horario);
                    demoSelectionActive = true;
                } catch (e) {
                    console.error('Error triggering tour demo selection', e);
                }
            }
        }
    } else if (demoSelectionActive) {
        clearSelection();
        demoSelectionActive = false;
    }
}

function renderStep(index) {
    const step = TOUR_STEPS[index];
    if (!step) return;

    handleStepDemo(step);

    const totalSteps = TOUR_STEPS.length;
    const isFirst = index === 0;
    const isLast = index === totalSteps - 1;

    let targetEl = document.querySelector(step.target);
    if (!targetEl) {
        targetEl = document.body;
    }

    // Scroll smoothly to target element
    if (targetEl !== document.body) {
        // Center horizontally inside scrollable container
        targetEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });

        if (step.isDemoSelection) {
            const targetTop = targetEl.getBoundingClientRect().top + window.scrollY;
            const desiredTop = window.innerWidth <= 600 ? 80 : 100;
            window.scrollTo({
                top: Math.max(0, targetTop - desiredTop),
                behavior: 'smooth'
            });
        } else {
            const scrollBlock = step.scrollBlock || 'center';
            targetEl.scrollIntoView({
                behavior: 'smooth',
                block: scrollBlock,
                inline: 'nearest'
            });
        }
    }

    // Generate Popover HTML
    popoverElement.innerHTML = `
        <div class="tour-popover-header">
            <div class="tour-step-badge">Paso ${index + 1} de ${totalSteps}</div>
            <button class="tour-close-btn" id="tourCloseBtn" title="Cerrar tour (Esc)" aria-label="Cerrar tour">×</button>
        </div>
        <div class="tour-popover-body">
            <h4 class="tour-popover-title">${step.title}</h4>
            <div class="tour-popover-text">${step.content}</div>
        </div>
        <div class="tour-popover-footer">
            <div class="tour-progress-dots">
                ${TOUR_STEPS.map((_, i) => `<span class="tour-dot ${i === index ? 'active' : ''}"></span>`).join('')}
            </div>
            <div class="tour-popover-actions">
                ${!isFirst ? `<button class="tour-btn tour-btn-secondary" id="tourPrevBtn">Anterior</button>` : ''}
                <button class="tour-btn tour-btn-primary" id="tourNextBtn">
                    ${isLast ? '¡Entendido!' : 'Siguiente'}
                </button>
            </div>
        </div>
    `;

    document.getElementById('tourCloseBtn').addEventListener('click', stopTour);
    const prevBtn = document.getElementById('tourPrevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', prevStep);
    }
    document.getElementById('tourNextBtn').addEventListener('click', nextStep);

    // Initial immediate position + multi-stage updates as smooth scroll completes
    positionTourElements(step);
    setTimeout(() => { if (isTourRunning) positionTourElements(step); }, 100);
    setTimeout(() => { if (isTourRunning) positionTourElements(step); }, 250);
    setTimeout(() => { if (isTourRunning) positionTourElements(step); }, 500);
}

function positionTourElements(step) {
    if (!spotlightElement || !popoverElement) return;

    let targetEl = document.querySelector(step.target);
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let rect = null;
    if (targetEl && targetEl !== document.body) {
        rect = targetEl.getBoundingClientRect();
    } else {
        rect = {
            top: viewportHeight / 2 - 50,
            bottom: viewportHeight / 2 + 50,
            left: viewportWidth / 2 - 100,
            right: viewportWidth / 2 + 100,
            width: 200,
            height: 100
        };
    }

    // Position spotlight
    const spotTop = Math.max(0, rect.top - padding);
    const spotLeft = Math.max(0, rect.left - padding);
    const spotWidth = Math.min(viewportWidth, rect.width + (padding * 2));
    const spotHeight = Math.min(viewportHeight, rect.height + (padding * 2));

    spotlightElement.style.top = `${spotTop}px`;
    spotlightElement.style.left = `${spotLeft}px`;
    spotlightElement.style.width = `${spotWidth}px`;
    spotlightElement.style.height = `${spotHeight}px`;

    // Measure popover
    popoverElement.style.visibility = 'hidden';
    popoverElement.style.display = 'block';
    const popoverRect = popoverElement.getBoundingClientRect();
    const popWidth = Math.min(popoverRect.width || 360, viewportWidth - 32);
    const popHeight = popoverRect.height || 220;

    let placement = step.placement || 'bottom';
    let top = 0;
    let left = 0;

    const spaceBelow = viewportHeight - (spotTop + spotHeight + 12);
    const spaceAbove = spotTop - 12;

    if (placement === 'bottom' && spaceBelow < popHeight + 10 && spaceAbove > spaceBelow) {
        placement = 'top';
    } else if (placement === 'top' && spaceAbove < popHeight + 10 && spaceBelow > spaceAbove) {
        placement = 'bottom';
    }

    if (placement === 'bottom') {
        top = spotTop + spotHeight + 14;
        left = spotLeft + (spotWidth / 2) - (popWidth / 2);
    } else if (placement === 'top') {
        top = spotTop - popHeight - 14;
        left = spotLeft + (spotWidth / 2) - (popWidth / 2);
    } else {
        top = spotTop + (spotHeight / 2) - (popHeight / 2);
        left = spotLeft + (spotWidth / 2) - (popWidth / 2);
    }

    // Viewport boundaries adjustments
    if (left < 16) {
        left = 16;
    } else if (left + popWidth > viewportWidth - 16) {
        left = viewportWidth - popWidth - 16;
    }

    if (top < 16) {
        top = 16;
    } else if (top + popHeight > viewportHeight - 16) {
        top = viewportHeight - popHeight - 16;
    }

    // For small target elements (movie blocks, buttons, inputs <= 100px tall), prevent popover from overlapping the element
    const isSmallTarget = rect.height <= 100;
    if (isSmallTarget) {
        if (placement === 'bottom' && top < spotTop + spotHeight + 6) {
            top = spotTop + spotHeight + 6;
        } else if (placement === 'top' && top + popHeight > spotTop - 6) {
            top = spotTop - popHeight - 6;
        }
    }

    popoverElement.style.top = `${top}px`;
    popoverElement.style.left = `${left}px`;
    popoverElement.style.visibility = 'visible';
}
