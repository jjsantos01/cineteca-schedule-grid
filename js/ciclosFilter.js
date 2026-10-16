import state, {
    setSelectedCiclos,
    toggleCiclo,
    selectAllCiclos,
    deselectAllCiclos,
    setSoloCiclo,
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
        if (state.selectedCiclos instanceof Set && state.selectedCiclos.size > 0) {
            onCiclosChanged();
        } else {
            renderCiclosDrawer();
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
                <div class="ciclos-header-actions">
                    <button type="button" id="btnCiclosClose" class="ciclos-close-btn" aria-label="Cerrar panel de ciclos" title="Cerrar">✕</button>
                </div>
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
        const isSelected = state.selectedCiclos === null || (state.selectedCiclos instanceof Set && state.selectedCiclos.has(ciclo.id));
        const activeClass = isSelected ? 'ciclo-card--active' : 'ciclo-card--inactive';
        const checkedAttr = isSelected ? 'checked' : '';
        const countText = ciclo.totalPeliculas === 1 ? '1 película' : `${ciclo.totalPeliculas || 0} películas`;

        cardsHtml += `
            <div class="ciclo-card ${activeClass}" data-ciclo-id="${ciclo.id}" role="listitem">
                <div class="ciclo-card-poster-wrapper">
                    ${ciclo.posterUrl ? `
                        <img src="${ciclo.posterUrl}" alt="${ciclo.nombre}" class="ciclo-card-poster" loading="lazy" />
                    ` : ''}
                    <div class="ciclo-card-fallback" style="${ciclo.posterUrl ? 'display: none;' : ''}">
                        <span class="ciclo-card-fallback-icon">🎪</span>
                        <span class="ciclo-card-fallback-text">${ciclo.nombre}</span>
                    </div>
                    <button type="button" class="ciclo-solo-btn" data-ciclo-id="${ciclo.id}" title="Ver sólo películas de este ciclo">Solo este</button>
                </div>
                <div class="ciclo-card-body">
                    <div class="ciclo-card-top">
                        <label class="ciclo-card-checkbox-label" title="Activar/desactivar ciclo">
                            <input type="checkbox" class="ciclo-checkbox" data-ciclo-id="${ciclo.id}" ${checkedAttr}>
                        </label>
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
            <div class="ciclos-header-actions">
                <button type="button" id="btnCiclosSelectAll" class="ciclos-action-btn" title="Seleccionar todos los ciclos">Seleccionar todos</button>
                <button type="button" id="btnCiclosDeselectAll" class="ciclos-action-btn" title="Deseleccionar todos los ciclos">Ninguno</button>
                <button type="button" id="btnCiclosClose" class="ciclos-close-btn" aria-label="Cerrar panel de ciclos" title="Cerrar panel">✕</button>
            </div>
        </div>
        <div class="ciclos-track-wrapper">
            <div class="ciclos-track" role="list">
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
    const btnSelectAll = drawer.querySelector('#btnCiclosSelectAll');
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            selectAllCiclos();
            onCiclosChanged();
        });
    }

    const btnDeselectAll = drawer.querySelector('#btnCiclosDeselectAll');
    if (btnDeselectAll) {
        btnDeselectAll.addEventListener('click', () => {
            deselectAllCiclos();
            onCiclosChanged();
        });
    }

    const btnClose = drawer.querySelector('#btnCiclosClose');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            toggleDrawer(false);
        });
    }

    // Wire clics en tarjetas, checkboxes y botón "Solo este"
    const cards = drawer.querySelectorAll('.ciclo-card');
    cards.forEach(card => {
        const cicloId = card.dataset.cicloId;

        // Botón Solo este
        const soloBtn = card.querySelector('.ciclo-solo-btn');
        if (soloBtn) {
            soloBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setSoloCiclo(cicloId);
                onCiclosChanged();
            });
        }

        // Checkbox interno
        const checkbox = card.querySelector('.ciclo-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleCiclo(cicloId);
                onCiclosChanged();
            });
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Clic en la tarjeta completa
        card.addEventListener('click', (e) => {
            if (e.target.closest('.ciclo-solo-btn') || e.target.closest('.ciclo-checkbox')) {
                return;
            }
            toggleCiclo(cicloId);
            onCiclosChanged();
        });
    });

    updateCiclosUI();
}

/**
 * Notifica cambios en la selección de ciclos y refresca todos los componentes dependientes.
 */
function onCiclosChanged() {
    // 1. Si se seleccionan ciclos, asegurar que las sedes donde se proyectan estén activas
    if (state.selectedCiclos instanceof Set && state.selectedCiclos.size > 0) {
        const sedesWithCiclo = new Set();
        for (const sedes of Object.values(state.multiDayData || {})) {
            for (const [sId, movies] of Object.entries(sedes || {})) {
                if (Array.isArray(movies)) {
                    for (const m of movies) {
                        const mCiclos = Array.isArray(m.ciclos) ? m.ciclos : [];
                        if (mCiclos.some(c => state.selectedCiclos.has(c))) {
                            sedesWithCiclo.add(sId);
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

    // 2. Si una película estaba fijada en el carrusel pero su ciclo fue deseleccionado, liberar el bloqueo
    if (state.carouselFilterFilmId) {
        let isFilmStillActive = true;
        if (state.selectedCiclos instanceof Set) {
            if (state.selectedCiclos.size === 0) {
                isFilmStillActive = false;
            } else {
                let foundMovie = null;
                for (const movies of Object.values(state.movieData || {})) {
                    if (Array.isArray(movies)) {
                        const m = movies.find(x => x.filmId === state.carouselFilterFilmId);
                        if (m) { foundMovie = m; break; }
                    }
                }
                if (!foundMovie) {
                    for (const sedes of Object.values(state.multiDayData || {})) {
                        for (const movies of Object.values(sedes || {})) {
                            if (Array.isArray(movies)) {
                                const m = movies.find(x => x.filmId === state.carouselFilterFilmId);
                                if (m) { foundMovie = m; break; }
                            }
                        }
                        if (foundMovie) break;
                    }
                }

                if (foundMovie) {
                    const movieCiclos = Array.isArray(foundMovie.ciclos) ? foundMovie.ciclos : [];
                    isFilmStillActive = movieCiclos.some(c => state.selectedCiclos.has(c));
                }
            }
        }

        if (!isFilmStillActive) {
            clearCarouselSelection();
        }
    }

    // 3. Aplicar filtros en la cuadrícula
    applyFilters();

    // 4. Refrescar el carrusel de pósters con el conjunto activo
    if (state.selectedCiclos instanceof Set && state.selectedCiclos.size > 0) {
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
 * Actualiza los badges de conteo y el estado visual de las tarjetas.
 */
export function updateCiclosUI() {
    const totalCount = Object.keys(state.ciclos || {}).length;
    const btn = document.getElementById('btnCiclosFilter');
    const countBadge = document.getElementById('ciclosCountBadge');
    const summary = document.getElementById('ciclosSelectionSummary');

    let activeCount = totalCount;
    let isFiltered = false;

    if (state.selectedCiclos === null) {
        activeCount = totalCount;
        isFiltered = false;
    } else if (state.selectedCiclos instanceof Set) {
        activeCount = state.selectedCiclos.size;
        isFiltered = totalCount > 0 && activeCount < totalCount;
    }

    // Actualizar badge en botón de encabezado
    if (countBadge) {
        if (!isFiltered) {
            countBadge.textContent = 'Todos';
        } else if (activeCount === 0) {
            countBadge.textContent = `0 de ${totalCount}`;
        } else {
            countBadge.textContent = `${activeCount} de ${totalCount}`;
        }
    }

    // Actualizar clase activa en botón
    if (btn) {
        btn.classList.toggle('ciclos-filter-btn--active', isFiltered);
    }

    // Actualizar texto descriptivo en cabecera del drawer
    if (summary) {
        if (totalCount === 0) {
            summary.textContent = 'Sin ciclos disponibles';
        } else if (!isFiltered) {
            summary.textContent = `Todos los ciclos activos (${totalCount})`;
        } else if (activeCount === 0) {
            summary.textContent = `Ningún ciclo seleccionado (0 de ${totalCount})`;
        } else {
            summary.textContent = `${activeCount} de ${totalCount} ciclos seleccionados`;
        }
    }

    // Sincronizar clases y checkboxes en tarjetas existentes
    const drawer = document.getElementById('ciclosDrawer');
    if (drawer) {
        const cards = drawer.querySelectorAll('.ciclo-card');
        cards.forEach(card => {
            const cicloId = card.dataset.cicloId;
            const isSelected = state.selectedCiclos === null || (state.selectedCiclos instanceof Set && state.selectedCiclos.has(cicloId));

            card.classList.toggle('ciclo-card--active', isSelected);
            card.classList.toggle('ciclo-card--inactive', !isSelected);

            const checkbox = card.querySelector('.ciclo-checkbox');
            if (checkbox) {
                checkbox.checked = isSelected;
            }
        });
    }
}
