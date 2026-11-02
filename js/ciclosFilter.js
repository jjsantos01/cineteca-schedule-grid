import state, {
    toggleCiclo,
    clearCiclosSelection,
    setCiclosMode,
    hasCicloSelection,
    movieMatchesCicloFilter,
    getCurrentMovieData
} from './state.js';
import { applyFilters } from './filters.js';
import { renderPosterCarousel, clearCarouselSelection } from './carousel.js';
import { updateURL } from './urlState.js';
import { getCachedData } from './cache.js';
import { formatDateForAPI } from './utils.js';
import { renderCurrentView } from './dataLoader.js';

let isDrawerOpen = false;
let isInitialized = false;

const MODE_INCLUDE = 'include';
const MODE_EXCLUDE = 'exclude';

/**
 * Inicializa el componente de filtrado por Ciclos y Festivales.
 */
export function initCiclosFilter() {
    if (isInitialized) {
        return;
    }
    isInitialized = true;

    const btn = document.getElementById('btnCiclosFilter');
    const drawer = document.getElementById('ciclosDrawer');

    if (btn && drawer) {
        btn.addEventListener('click', () => {
            toggleDrawer();
        });
    }

    // Escuchar cuando el feed consolidado esté listo
    document.addEventListener('feed:loaded', () => {
        renderCiclosDrawer();
        if (hasCicloSelection()) {
            onCiclosChanged();
        } else {
            updateCiclosUI();
        }
    });

    // Escuchar cambios de ciclo desde badges externos (modal, inlineInfo)
    document.addEventListener('ciclos:changed', () => {
        onCiclosChanged();
    });

    // Escuchar cambios generales de filtros para sincronización
    document.addEventListener('filters:updated', () => {
        updateCiclosUI();
    });

    // Renderizado inicial por si los ciclos ya estaban disponibles
    renderCiclosDrawer();
    updateCiclosUI();
}

/**
 * Alterna la visibilidad del drawer colapsable.
 */
export function toggleDrawer(forceOpen = null) {
    const btn = document.getElementById('btnCiclosFilter');
    const drawer = document.getElementById('ciclosDrawer');
    if (!btn || !drawer) return;

    if (forceOpen !== null) {
        isDrawerOpen = Boolean(forceOpen);
    } else {
        isDrawerOpen = !isDrawerOpen;
    }

    if (isDrawerOpen) {
        drawer.hidden = false;
        drawer.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('is-open');
        renderCiclosDrawer();
    } else {
        drawer.hidden = true;
        drawer.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('is-open');
    }
}

/**
 * Renderiza el contenido interno del drawer con los ciclos disponibles.
 */
export function renderCiclosDrawer() {
    const drawer = document.getElementById('ciclosDrawer');
    if (!drawer) return;

    const ciclosMap = state.ciclos || {};
    const cicloEntries = Object.values(ciclosMap);

    if (cicloEntries.length === 0) {
        drawer.innerHTML = `
            <div class="ciclos-drawer-header">
                <div class="ciclos-header-info">
                    <h3 class="ciclos-drawer-title">🎪 Ciclos y Festivales</h3>
                    <span class="ciclos-selection-summary">Cargando ciclos disponibles...</span>
                </div>
                <button type="button" id="btnCiclosClose" class="ciclos-close-btn" aria-label="Cerrar panel de ciclos" title="Cerrar">✕</button>
            </div>
        `;
        const closeBtn = drawer.querySelector('#btnCiclosClose');
        if (closeBtn) closeBtn.addEventListener('click', () => toggleDrawer(false));
        return;
    }

    // Ordenar ciclos por nombre
    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    const sortedCiclos = [...cicloEntries].sort((a, b) => collator.compare(a.nombre || '', b.nombre || ''));

    let cardsHtml = '';
    for (const ciclo of sortedCiclos) {
        const countText = ciclo.totalPeliculas === 1 ? '1 película' : `${ciclo.totalPeliculas || 0} películas`;

        cardsHtml += `
            <div class="ciclo-card" data-ciclo-id="${ciclo.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${ciclo.nombre}">
                <div class="ciclo-card-poster-wrapper">
                    ${ciclo.posterUrl ? `
                        <img src="${ciclo.posterUrl}" alt="${ciclo.nombre}" class="ciclo-card-poster" loading="lazy" />
                    ` : ''}
                    <div class="ciclo-card-fallback" style="${ciclo.posterUrl ? 'display: none;' : ''}">
                        <span class="ciclo-card-fallback-icon">🎪</span>
                        <span class="ciclo-card-fallback-text">${ciclo.nombre}</span>
                    </div>
                    <span class="ciclo-card-status" aria-hidden="true"></span>
                </div>
                <div class="ciclo-card-body">
                    <div class="ciclo-card-top">
                        <span class="ciclo-count-pill">${countText}</span>
                    </div>
                    <div class="ciclo-card-name" title="${ciclo.nombre}">${ciclo.nombre}</div>
                </div>
            </div>
        `;
    }

    drawer.innerHTML = `
        <div class="ciclos-drawer-header">
            <div class="ciclos-header-info">
                <h3 class="ciclos-drawer-title">🎪 Ciclos y Festivales</h3>
                <span id="ciclosSelectionSummary" class="ciclos-selection-summary"></span>
            </div>
            <button type="button" id="btnCiclosClose" class="ciclos-close-btn" aria-label="Cerrar panel de ciclos" title="Cerrar panel">✕</button>
            <div class="ciclos-header-actions">
                <button type="button" id="btnCiclosClear" class="ciclos-action-btn" title="Quitar la selección de ciclos" hidden>Limpiar</button>
                <div id="ciclosModeSwitch" class="ciclos-mode-switch" role="radiogroup" aria-label="Acción al elegir un ciclo" data-mode="${MODE_INCLUDE}">
                    <span class="ciclos-mode-thumb" aria-hidden="true"></span>
                    <button type="button" role="radio" class="ciclos-mode-option" data-mode="${MODE_INCLUDE}" aria-checked="true" title="Mostrar solo las películas de los ciclos elegidos">Seleccionar</button>
                    <button type="button" role="radio" class="ciclos-mode-option" data-mode="${MODE_EXCLUDE}" aria-checked="false" tabindex="-1" title="Ocultar las películas de los ciclos elegidos">Deseleccionar</button>
                </div>
            </div>
        </div>
        <div class="ciclos-track-wrapper">
            <div class="ciclos-track" role="group" aria-label="Ciclos y festivales">
                ${cardsHtml}
            </div>
        </div>
    `;

    // Fallback para pósters rotos
    const posters = drawer.querySelectorAll('.ciclo-card-poster');
    posters.forEach(img => {
        img.addEventListener('error', () => {
            img.style.display = 'none';
            const fallback = img.nextElementSibling;
            if (fallback) fallback.style.display = 'flex';
        });
    });

    // Wire botones de cabecera
    const btnClear = drawer.querySelector('#btnCiclosClear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            clearCiclosSelection();
            onCiclosChanged();
        });
    }

    const btnClose = drawer.querySelector('#btnCiclosClose');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            toggleDrawer(false);
        });
    }

    // Wire switch Seleccionar / Deseleccionar
    const modeSwitch = drawer.querySelector('#ciclosModeSwitch');
    if (modeSwitch) {
        const options = Array.from(modeSwitch.querySelectorAll('.ciclos-mode-option'));
        options.forEach(option => {
            option.addEventListener('click', () => {
                if (state.ciclosMode === option.dataset.mode) return;
                setCiclosMode(option.dataset.mode);
                onCiclosChanged();
            });
        });
        modeSwitch.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
            e.preventDefault();
            const nextMode = state.ciclosMode === MODE_EXCLUDE ? MODE_INCLUDE : MODE_EXCLUDE;
            setCiclosMode(nextMode);
            onCiclosChanged();
            const nextOption = options.find(o => o.dataset.mode === nextMode);
            if (nextOption) nextOption.focus();
        });
    }

    // Wire clics y teclado en tarjetas (selección única)
    const cards = drawer.querySelectorAll('.ciclo-card');
    cards.forEach(card => {
        const cicloId = card.dataset.cicloId;
        const activate = () => {
            toggleCiclo(cicloId);
            onCiclosChanged();
        };

        card.addEventListener('click', activate);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });
    });

    updateCiclosUI();
}

/**
 * Busca una película por filmId en los datos cargados (día actual y multi-día).
 */
function findMovieByFilmId(filmId) {
    for (const movies of Object.values(state.movieData || {})) {
        if (Array.isArray(movies)) {
            const m = movies.find(x => x.filmId === filmId);
            if (m) return m;
        }
    }
    for (const sedes of Object.values(state.multiDayData || {})) {
        for (const movies of Object.values(sedes || {})) {
            if (Array.isArray(movies)) {
                const m = movies.find(x => x.filmId === filmId);
                if (m) return m;
            }
        }
    }
    return null;
}

/**
 * Notifica cambios en la selección de ciclos y refresca todos los componentes dependientes.
 */
function onCiclosChanged() {
    const isIncludeWithSelection = hasCicloSelection() && state.ciclosMode === MODE_INCLUDE;

    // 1. En modo "Seleccionar", asegurar que las sedes donde se proyectan los ciclos estén activas
    if (isIncludeWithSelection) {
        const sedesWithCiclo = new Set();
        for (const sedes of Object.values(state.multiDayData || {})) {
            for (const [sId, movies] of Object.entries(sedes || {})) {
                if (Array.isArray(movies)) {
                    for (const m of movies) {
                        if (movieMatchesCicloFilter(m)) {
                            sedesWithCiclo.add(sId);
                            break;
                        }
                    }
                }
            }
        }

        let sedesAdded = false;
        for (const s of sedesWithCiclo) {
            if (!state.activeSedes.has(s)) {
                state.activeSedes.add(s);
                sedesAdded = true;
            }
        }

        if (sedesAdded) {
            // Sincronizar checkboxes de sedes en la UI
            const cenartCheck = document.getElementById('cenart');
            const xocoCheck = document.getElementById('xoco');
            const chapCheck = document.getElementById('chapultepec');
            if (cenartCheck) cenartCheck.checked = state.activeSedes.has('002');
            if (xocoCheck) xocoCheck.checked = state.activeSedes.has('003');
            if (chapCheck) chapCheck.checked = state.activeSedes.has('001');

            // Cargar datos en state.movieData para las sedes añadidas
            const dateKey = formatDateForAPI(state.currentDate);
            for (const sId of state.activeSedes) {
                if (!state.movieData[sId]) {
                    const cached = getCachedData(dateKey, sId);
                    if (cached) state.movieData[sId] = cached;
                }
            }
            renderCurrentView();
        }
    }

    updateCiclosUI();

    // 2. Si una película estaba fijada en el carrusel pero ya no pasa el filtro de ciclos, liberar el bloqueo
    if (state.carouselFilterFilmId) {
        const pinnedMovie = findMovieByFilmId(state.carouselFilterFilmId);
        if (pinnedMovie && !movieMatchesCicloFilter(pinnedMovie)) {
            clearCarouselSelection();
        }
    }

    // 3. Aplicar filtros en la cuadrícula
    applyFilters();

    // 4. Refrescar el carrusel de pósters con el conjunto activo
    if (isIncludeWithSelection) {
        // Al filtrar por ciclos, recopilar todas las películas del ciclo a través de las sedes activas
        let combined = {};
        for (const sedes of Object.values(state.multiDayData || {})) {
            for (const [sId, movies] of Object.entries(sedes || {})) {
                if (state.activeSedes.has(sId) && Array.isArray(movies)) {
                    if (!combined[sId]) combined[sId] = [];
                    combined[sId] = combined[sId].concat(movies);
                }
            }
        }
        renderPosterCarousel(combined);
    } else if (state.viewMode === 'week' || state.viewMode === 'movies') {
        let combinedMovies = [];
        for (const sedes of Object.values(state.multiDayData || {})) {
            for (const [sId, movies] of Object.entries(sedes || {})) {
                if (state.activeSedes.has(sId) && Array.isArray(movies)) {
                    combinedMovies = combinedMovies.concat(movies);
                }
            }
        }
        renderPosterCarousel({ all: combinedMovies });
    } else {
        renderPosterCarousel(getCurrentMovieData());
    }

    // 5. Sincronizar URL
    updateURL();
}

/**
 * Actualiza el badge del botón, el switch, el resumen y el estado visual de las tarjetas.
 */
export function updateCiclosUI() {
    const btn = document.getElementById('btnCiclosFilter');
    const countBadge = document.getElementById('ciclosCountBadge');
    const summary = document.getElementById('ciclosSelectionSummary');
    const drawer = document.getElementById('ciclosDrawer');

    const hasSelection = hasCicloSelection();
    const isExclude = state.ciclosMode === MODE_EXCLUDE;
    const selectedId = hasSelection ? [...state.selectedCiclos][0] : null;
    const selectedName = hasSelection ? (state.ciclos?.[selectedId]?.nombre || `Ciclo ${selectedId}`) : '';

    // Badge en botón de encabezado
    if (countBadge) {
        countBadge.textContent = hasSelection ? `${isExclude ? 'Sin' : 'Solo'}: ${selectedName}` : 'Todos';
        countBadge.title = hasSelection ? selectedName : '';
    }

    // Clases de estado en el botón
    if (btn) {
        btn.classList.toggle('ciclos-filter-btn--active', hasSelection);
        btn.classList.toggle('ciclos-filter-btn--exclude', hasSelection && isExclude);
    }

    // Texto descriptivo en cabecera del drawer
    if (summary) {
        if (Object.keys(state.ciclos || {}).length === 0) {
            summary.textContent = 'Sin ciclos disponibles';
        } else if (!hasSelection) {
            summary.textContent = 'Mostrando todas las películas';
        } else if (isExclude) {
            summary.textContent = `Ocultando: ${selectedName}`;
        } else {
            summary.textContent = `Mostrando solo: ${selectedName}`;
        }
    }

    if (!drawer) return;

    drawer.classList.toggle('ciclos-drawer--exclude', isExclude);
    drawer.classList.toggle('ciclos-drawer--has-selection', hasSelection);

    // Botón Limpiar
    const clearBtn = drawer.querySelector('#btnCiclosClear');
    if (clearBtn) {
        clearBtn.hidden = !hasSelection;
    }

    // Switch Seleccionar / Deseleccionar
    const modeSwitch = drawer.querySelector('#ciclosModeSwitch');
    if (modeSwitch) {
        modeSwitch.dataset.mode = isExclude ? MODE_EXCLUDE : MODE_INCLUDE;
        modeSwitch.querySelectorAll('.ciclos-mode-option').forEach(option => {
            const isActive = option.dataset.mode === modeSwitch.dataset.mode;
            option.setAttribute('aria-checked', String(isActive));
            option.tabIndex = isActive ? 0 : -1;
        });
    }

    // Sincronizar clases y estado accesible en tarjetas existentes
    const statusText = isExclude ? 'Oculto' : 'Mostrando';
    drawer.querySelectorAll('.ciclo-card').forEach(card => {
        const isSelected = hasSelection && state.selectedCiclos.has(card.dataset.cicloId);

        card.classList.toggle('ciclo-card--selected', isSelected);
        card.classList.toggle('ciclo-card--dimmed', hasSelection && !isSelected && !isExclude);

        card.setAttribute('aria-pressed', String(isSelected));

        const status = card.querySelector('.ciclo-card-status');
        if (status) {
            status.textContent = statusText;
        }
    });
}
