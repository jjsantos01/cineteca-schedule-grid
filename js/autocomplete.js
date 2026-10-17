import state from './state.js';
import { FILTER_LOCKS } from './filterLock.js';

let inputElementRef = null;
let clearBtnElementRef = null;
let dropdownElementRef = null;
let wrapperElementRef = null;
let onFilterChangeCallback = null;

let currentMatches = [];
let activeIndex = -1;
let isDropdownOpen = false;

/**
 * Normaliza una cadena removiendo acentos/diacríticos y pasándola a minúsculas.
 * @param {string} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
    if (typeof text !== 'string') return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Escapa caracteres HTML para evitar inyecciones al renderizar sugerencias.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const ACCENT_MAP = {
    'a': '[aáàäâ]',
    'e': '[eéèëê]',
    'i': '[iíìïî]',
    'o': '[oóòöô]',
    'u': '[uúùüû]',
    'n': '[nñ]',
    'c': '[cç]'
};

/**
 * Resalta la porción coincidente en el título usando <mark class="autocomplete-match">.
 * Maneja búsqueda insensible a mayúsculas y acentos.
 * @param {string} title
 * @param {string} query
 * @returns {string} HTML seguro con el fragmento coincidente resaltado.
 */
export function highlightMatch(title, query) {
    if (!title || typeof title !== 'string') return '';
    if (!query || typeof query !== 'string' || !query.trim()) {
        return escapeHTML(title);
    }

    try {
        const cleanQuery = query.trim();
        const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let pattern = '';
        for (const ch of escaped) {
            const lower = ch.toLowerCase();
            pattern += ACCENT_MAP[lower] || ch;
        }

        const regex = new RegExp(pattern, 'i');
        const match = title.match(regex);
        if (!match || typeof match.index === 'undefined') {
            return escapeHTML(title);
        }

        const startIndex = match.index;
        const matchLen = match[0].length;
        const before = escapeHTML(title.slice(0, startIndex));
        const matched = escapeHTML(title.slice(startIndex, startIndex + matchLen));
        const after = escapeHTML(title.slice(startIndex + matchLen));

        return `${before}<mark class="autocomplete-match">${matched}</mark>${after}`;
    } catch (e) {
        return escapeHTML(title);
    }
}

/**
 * Extrae los títulos únicos de películas cargadas actualmente.
 * - Si state.viewMode === 'day': películas de state.movieData (sedes activas de la fecha actual).
 * - Si state.viewMode === 'week' o 'movies': catálogo de state.multiDayData.
 * @returns {string[]} Lista ordenada alfabéticamente de títulos únicos.
 */
export function getAvailableMovieTitles() {
    const titlesSet = new Set();
    const isWeek = state.viewMode === 'week' || state.viewMode === 'movies';

    if (isWeek) {
        if (state.multiDayData && typeof state.multiDayData === 'object') {
            for (const sedes of Object.values(state.multiDayData)) {
                if (sedes && typeof sedes === 'object') {
                    for (const movies of Object.values(sedes)) {
                        if (Array.isArray(movies)) {
                            for (const movie of movies) {
                                const title = (movie.displayTitle || movie.titulo || '').trim();
                                if (title) {
                                    titlesSet.add(title);
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        if (state.movieData && typeof state.movieData === 'object') {
            for (const movies of Object.values(state.movieData)) {
                if (Array.isArray(movies)) {
                    for (const movie of movies) {
                        const title = (movie.displayTitle || movie.titulo || '').trim();
                        if (title) {
                            titlesSet.add(title);
                        }
                    }
                }
            }
        }
    }

    return Array.from(titlesSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

/**
 * Filtra y jerarquiza sugerencias según relevancia de coincidencia:
 * 1. Prefijo exacto
 * 2. Inicio de palabra (después de espacio o puntuación)
 * 3. Subcadena en cualquier posición
 * @param {string} query
 * @param {string[]} titles
 * @param {number} maxResults
 * @returns {string[]}
 */
export function getFilteredSuggestions(query, titles, maxResults = 8) {
    const cleanQuery = typeof query === 'string' ? query.trim() : '';
    if (!cleanQuery || !Array.isArray(titles) || titles.length === 0) {
        return [];
    }

    const normQuery = normalizeSearchText(cleanQuery);
    if (!normQuery) return [];

    const scored = [];

    for (const title of titles) {
        const normTitle = normalizeSearchText(title);
        const matchIndex = normTitle.indexOf(normQuery);

        if (matchIndex !== -1) {
            let score = 3;
            if (matchIndex === 0) {
                score = 1; // Prefijo
            } else {
                const prevChar = normTitle[matchIndex - 1];
                if (/[\s:,\-/(]/.test(prevChar)) {
                    score = 2; // Inicio de palabra
                }
            }
            scored.push({ title, score, length: title.length });
        }
    }

    scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (a.length !== b.length) return a.length - b.length;
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });

    return scored.slice(0, maxResults).map(item => item.title);
}

/**
 * Actualiza la visibilidad del botón de borrado rápido (x).
 */
export function updateClearButtonVisibility() {
    if (!inputElementRef || !clearBtnElementRef) return;
    const hasText = inputElementRef.value.length > 0;
    const isLocked = state.filterLock === FILTER_LOCKS.CAROUSEL || inputElementRef.disabled;
    const shouldShow = hasText && !isLocked;
    clearBtnElementRef.style.display = shouldShow ? 'flex' : 'none';
}

/**
 * Cierra y limpia el dropdown flotante de autocompletado.
 */
export function closeDropdown() {
    isDropdownOpen = false;
    activeIndex = -1;
    currentMatches = [];

    if (dropdownElementRef) {
        dropdownElementRef.hidden = true;
        dropdownElementRef.innerHTML = '';
    }

    if (inputElementRef) {
        inputElementRef.setAttribute('aria-expanded', 'false');
        inputElementRef.removeAttribute('aria-activedescendant');
    }
}

/**
 * Abre y renderiza el dropdown con la lista de sugerencias.
 * @param {string[]} matches
 */
function openDropdown(matches) {
    if (!dropdownElementRef || !inputElementRef) return;

    currentMatches = matches;
    activeIndex = -1;

    dropdownElementRef.innerHTML = '';

    matches.forEach((title, idx) => {
        const li = document.createElement('li');
        li.id = `movie-suggestion-${idx}`;
        li.className = 'autocomplete-item';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.setAttribute('data-index', String(idx));
        li.setAttribute('data-title', title);
        li.innerHTML = highlightMatch(title, inputElementRef.value);
        dropdownElementRef.appendChild(li);
    });

    dropdownElementRef.hidden = false;
    isDropdownOpen = true;
    inputElementRef.setAttribute('aria-expanded', 'true');
    inputElementRef.removeAttribute('aria-activedescendant');
}

/**
 * Actualiza la opción activa en el dropdown para navegación por teclado.
 * @param {number} newIndex
 */
function updateActiveOption(newIndex) {
    if (!dropdownElementRef || !inputElementRef || currentMatches.length === 0) return;

    activeIndex = newIndex;
    const items = dropdownElementRef.querySelectorAll('.autocomplete-item');

    items.forEach((item, idx) => {
        const isActive = idx === activeIndex;
        item.classList.toggle('autocomplete-item--active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
            item.scrollIntoView({ block: 'nearest' });
            inputElementRef.setAttribute('aria-activedescendant', item.id);
        }
    });

    if (activeIndex === -1) {
        inputElementRef.removeAttribute('aria-activedescendant');
    }
}

/**
 * Selecciona una opción del dropdown, actualiza el input y dispara el filtro.
 * @param {string} title
 */
function selectSuggestion(title) {
    if (!inputElementRef) return;

    inputElementRef.value = title;
    updateClearButtonVisibility();
    closeDropdown();

    if (typeof onFilterChangeCallback === 'function') {
        onFilterChangeCallback(title);
    }

    inputElementRef.focus();
}

/**
 * Sincroniza el estado del autocompletado y el botón (x) con el estado global de la app.
 */
export function syncAutocompleteUI() {
    updateClearButtonVisibility();
    if (state.filterLock === FILTER_LOCKS.CAROUSEL) {
        closeDropdown();
    }
}

/**
 * Inicializa el autocompletado y botón (x) de borrado rápido.
 * @param {Object} options
 * @param {Function} options.onFilterChange Callback invocado al seleccionar o borrar filtro.
 * @param {Function} [options.clearDebounce] Callback para cancelar debounce en curso.
 */
export function initMovieAutocomplete(options = {}) {
    onFilterChangeCallback = options.onFilterChange || null;
    const clearDebounce = options.clearDebounce || null;

    inputElementRef = document.getElementById('movieFilter');
    clearBtnElementRef = document.getElementById('clearMovieFilterBtn');
    dropdownElementRef = document.getElementById('movieAutocompleteList');
    wrapperElementRef = document.querySelector('.filter-input-wrapper');

    if (!inputElementRef || !clearBtnElementRef || !dropdownElementRef) {
        return;
    }

    // Estado inicial del botón (x)
    updateClearButtonVisibility();

    // 1. Botón (x) de borrado rápido
    clearBtnElementRef.addEventListener('click', (event) => {
        event.preventDefault();
        if (clearDebounce) clearDebounce();

        inputElementRef.value = '';
        updateClearButtonVisibility();
        closeDropdown();

        if (typeof onFilterChangeCallback === 'function') {
            onFilterChangeCallback('');
        }

        inputElementRef.focus();
    });

    // 2. Entrada de texto en #movieFilter
    inputElementRef.addEventListener('input', () => {
        updateClearButtonVisibility();

        const query = inputElementRef.value;
        if (query.trim().length >= 1) {
            const titles = getAvailableMovieTitles();
            const matches = getFilteredSuggestions(query, titles);
            if (matches.length > 0) {
                openDropdown(matches);
            } else {
                closeDropdown();
            }
        } else {
            closeDropdown();
        }
    });

    // 3. Foco en el input: si tiene texto y hay sugerencias, mostrar dropdown
    inputElementRef.addEventListener('focus', () => {
        const query = inputElementRef.value;
        if (query.trim().length >= 1 && !isDropdownOpen) {
            const titles = getAvailableMovieTitles();
            const matches = getFilteredSuggestions(query, titles);
            if (matches.length > 0) {
                openDropdown(matches);
            }
        }
    });

    // 4. Navegación accesible por teclado
    inputElementRef.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            if (!isDropdownOpen) {
                const query = inputElementRef.value;
                if (query.trim().length >= 1) {
                    const titles = getAvailableMovieTitles();
                    const matches = getFilteredSuggestions(query, titles);
                    if (matches.length > 0) {
                        openDropdown(matches);
                        updateActiveOption(0);
                    }
                }
            } else if (currentMatches.length > 0) {
                const nextIndex = activeIndex < currentMatches.length - 1 ? activeIndex + 1 : 0;
                updateActiveOption(nextIndex);
            }
            event.preventDefault();
        } else if (event.key === 'ArrowUp') {
            if (isDropdownOpen && currentMatches.length > 0) {
                const prevIndex = activeIndex > 0 ? activeIndex - 1 : currentMatches.length - 1;
                updateActiveOption(prevIndex);
                event.preventDefault();
            }
        } else if (event.key === 'Enter') {
            if (isDropdownOpen && activeIndex >= 0 && activeIndex < currentMatches.length) {
                event.preventDefault();
                if (clearDebounce) clearDebounce();
                selectSuggestion(currentMatches[activeIndex]);
            } else if (isDropdownOpen) {
                closeDropdown();
            }
        } else if (event.key === 'Escape') {
            if (isDropdownOpen) {
                event.preventDefault();
                event.stopPropagation();
                closeDropdown();
            }
        } else if (event.key === 'Tab') {
            closeDropdown();
        }
    });

    // 5. Interacción con el ratón en el dropdown
    dropdownElementRef.addEventListener('mousedown', (event) => {
        // Prevenir blur del input antes de procesar el clic
        event.preventDefault();
    });

    dropdownElementRef.addEventListener('click', (event) => {
        const item = event.target.closest('.autocomplete-item');
        if (!item) return;

        const title = item.getAttribute('data-title');
        if (title) {
            if (clearDebounce) clearDebounce();
            selectSuggestion(title);
        }
    });

    dropdownElementRef.addEventListener('mousemove', (event) => {
        const item = event.target.closest('.autocomplete-item');
        if (!item) return;
        const indexStr = item.getAttribute('data-index');
        if (indexStr !== null) {
            const idx = parseInt(indexStr, 10);
            if (idx !== activeIndex) {
                updateActiveOption(idx);
            }
        }
    });

    // 6. Clic fuera para cerrar
    document.addEventListener('pointerdown', (event) => {
        if (!isDropdownOpen) return;
        if (wrapperElementRef && !wrapperElementRef.contains(event.target)) {
            closeDropdown();
        }
    });

    // 7. Seguridad al perder el foco
    inputElementRef.addEventListener('blur', () => {
        setTimeout(() => {
            if (wrapperElementRef && !wrapperElementRef.contains(document.activeElement)) {
                closeDropdown();
            }
        }, 150);
    });

    // 8. Reaccionar a cambios de lock de filtros
    document.addEventListener('filterLock:changed', () => {
        syncAutocompleteUI();
    });
}
