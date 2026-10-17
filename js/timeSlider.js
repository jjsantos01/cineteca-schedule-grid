/**
 * timeSlider.js - Dual Range Slider para selección de rango de horas
 * Vanilla JS sin dependencias externas.
 * Límites calculados dinámicamente según las funciones de la cartelera (floor y ceil).
 */

import state, { getCurrentMovieData } from './state.js';
import { minutesToTime, timeToMinutes } from './utils.js';

export const TIME_SLIDER_CONFIG = {
    MIN_MINUTES: 600,   // 10:00 (fallback inicial)
    MAX_MINUTES: 1440,  // 24:00 (fallback inicial)
    STEP_MINUTES: 10
};

let minInputEl = null;
let maxInputEl = null;
let trackHighlightEl = null;
let rangeDisplayEl = null;
let clearBtnEl = null;
let containerEl = null;
let wrapperEl = null;

let onTimeChangeCallback = null;
let rafId = null;

/**
 * Convierte minutos a porcentaje dentro del rango dinámico del slider [MIN_MINUTES, MAX_MINUTES].
 * @param {number} minutes
 * @returns {number} Porcentaje 0-100
 */
export function minutesToPercent(minutes) {
    const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;
    const clamped = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, minutes));
    const range = MAX_MINUTES - MIN_MINUTES;
    if (range <= 0) return 0;
    return ((clamped - MIN_MINUTES) / range) * 100;
}

/**
 * Normaliza un string de hora HH:MM a minutos dentro de los límites dinámicos del slider.
 * @param {string} timeStr
 * @param {number} defaultMinutes
 * @returns {number}
 */
export function parseTimeToMinutes(timeStr, defaultMinutes) {
    if (!timeStr || typeof timeStr !== 'string') {
        return defaultMinutes;
    }

    const trimmed = timeStr.trim();
    if (!trimmed) {
        return defaultMinutes;
    }

    // Caso especial para medianoche
    if (trimmed === '00:00' && defaultMinutes === TIME_SLIDER_CONFIG.MAX_MINUTES) {
        return TIME_SLIDER_CONFIG.MAX_MINUTES;
    }

    try {
        const mins = timeToMinutes(trimmed);
        if (Number.isNaN(mins)) return defaultMinutes;
        return Math.max(TIME_SLIDER_CONFIG.MIN_MINUTES, Math.min(TIME_SLIDER_CONFIG.MAX_MINUTES, mins));
    } catch {
        return defaultMinutes;
    }
}

/**
 * Formatea el texto legible del rango seleccionado.
 * @param {number} minVal
 * @param {number} maxVal
 * @returns {string} Ej: "10:00 - 24:00", "13:40 - 19:20", "14:00"
 */
export function formatTimeRangeDisplay(minVal, maxVal) {
    const minStr = minutesToTime(minVal);
    const maxStr = minutesToTime(maxVal);

    if (minVal === maxVal) {
        return minStr;
    }

    return `${minStr} - ${maxStr}`;
}

/**
 * Actualiza los elementos visuales del DOM (track highlight, label, botón limpiar, atributos ARIA).
 * @param {number} minVal
 * @param {number} maxVal
 */
export function updateVisuals(minVal, maxVal) {
    const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;

    const startPercent = minutesToPercent(minVal);
    const endPercent = minutesToPercent(maxVal);

    if (trackHighlightEl) {
        trackHighlightEl.style.left = `${startPercent}%`;
        trackHighlightEl.style.width = `${Math.max(0, endPercent - startPercent)}%`;
    }

    const displayText = formatTimeRangeDisplay(minVal, maxVal);
    if (rangeDisplayEl) {
        rangeDisplayEl.textContent = displayText;
    }

    // El filtro está activo si no abarca todo el rango dinámico [MIN_MINUTES, MAX_MINUTES]
    const isFilterActive = minVal > MIN_MINUTES || maxVal < MAX_MINUTES;

    if (clearBtnEl) {
        clearBtnEl.classList.toggle('visible', isFilterActive);
    }

    if (minInputEl) {
        minInputEl.setAttribute('aria-valuenow', minVal);
        minInputEl.setAttribute('aria-valuetext', minutesToTime(minVal));
    }
    if (maxInputEl) {
        maxInputEl.setAttribute('aria-valuenow', maxVal);
        maxInputEl.setAttribute('aria-valuetext', minutesToTime(maxVal));
    }
}

/**
 * Actualiza/regenera las etiquetas de referencia horaria en .time-slider-ticks según el rango.
 * @param {number} minMinutes
 * @param {number} maxMinutes
 */
export function updateTicks(minMinutes, maxMinutes) {
    const ticksContainer = document.querySelector('.time-slider-ticks');
    if (!ticksContainer) return;

    const totalMinutes = maxMinutes - minMinutes;
    if (totalMinutes <= 0) return;

    const totalHours = totalMinutes / 60;
    let hourStep = 2;
    if (totalHours >= 12) hourStep = 3;
    if (totalHours >= 15) hourStep = 4;
    if (totalHours <= 4) hourStep = 1;

    const ticks = [];
    ticks.push(minMinutes);

    const firstIntermediate = Math.ceil(minMinutes / (hourStep * 60)) * (hourStep * 60);
    for (let m = firstIntermediate; m < maxMinutes; m += hourStep * 60) {
        if (m > minMinutes + 45 && m < maxMinutes - 45) {
            ticks.push(m);
        }
    }

    if (!ticks.includes(maxMinutes)) {
        ticks.push(maxMinutes);
    }

    ticksContainer.innerHTML = ticks.map(m => {
        const percent = ((m - minMinutes) / totalMinutes) * 100;
        return `<span class="tick-label" style="left: ${percent.toFixed(2)}%;">${minutesToTime(m)}</span>`;
    }).join('');
}

/**
 * Actualiza dinámicamente los límites del slider (min/max), regenera los ticks y reposiciona los thumbs.
 * @param {number} minMinutes - Minutos mínimos redondeados al floor de la hora
 * @param {number} maxMinutes - Minutos máximos redondeados al ceil de la hora
 */
export function updateTimeSliderBounds(minMinutes, maxMinutes) {
    if (typeof minMinutes !== 'number' || typeof maxMinutes !== 'number' || isNaN(minMinutes) || isNaN(maxMinutes)) {
        minMinutes = 600;
        maxMinutes = 1440;
    }

    // Asegurar rango válido de al menos 1 hora (60 min)
    if (maxMinutes <= minMinutes) {
        maxMinutes = minMinutes + 60;
    }

    TIME_SLIDER_CONFIG.MIN_MINUTES = minMinutes;
    TIME_SLIDER_CONFIG.MAX_MINUTES = maxMinutes;

    if (!minInputEl) minInputEl = document.getElementById('timeSliderMin');
    if (!maxInputEl) maxInputEl = document.getElementById('timeSliderMax');

    if (minInputEl) {
        minInputEl.min = minMinutes;
        minInputEl.max = maxMinutes;
        minInputEl.setAttribute('aria-valuemin', minMinutes);
        minInputEl.setAttribute('aria-valuemax', maxMinutes);
    }
    if (maxInputEl) {
        maxInputEl.min = minMinutes;
        maxInputEl.max = maxMinutes;
        maxInputEl.setAttribute('aria-valuemin', minMinutes);
        maxInputEl.setAttribute('aria-valuemax', maxMinutes);
    }

    // Si hay filtros de tiempo activos en state, preservarlos dentro de los nuevos límites;
    // de lo contrario, colocar los thumbs en los nuevos extremos dinámicos.
    let currentMin = minMinutes;
    let currentMax = maxMinutes;

    if (state.timeFilterStart) {
        currentMin = parseTimeToMinutes(state.timeFilterStart, minMinutes);
    }
    if (state.timeFilterEnd) {
        currentMax = parseTimeToMinutes(state.timeFilterEnd, maxMinutes);
    }

    if (minInputEl) minInputEl.value = currentMin;
    if (maxInputEl) maxInputEl.value = currentMax;

    updateVisuals(currentMin, currentMax);
    updateTicks(minMinutes, maxMinutes);
}

/**
 * Calcula la hora mínima (floor) y máxima (ceil) de las funciones actualmente cargadas
 * y sincroniza los límites del slider.
 */
export function syncTimeSliderWithShowtimes() {
    let minShowtime = Infinity;
    let maxShowtime = -Infinity;
    let hasShowtimes = false;

    const isWeek = state.viewMode === 'week' || state.viewMode === 'movies';

    if (isWeek && state.multiDayData) {
        for (const sedes of Object.values(state.multiDayData)) {
            if (!sedes) continue;
            for (const [sedeId, movies] of Object.entries(sedes)) {
                if (state.activeSedes && !state.activeSedes.has(sedeId)) continue;
                if (!Array.isArray(movies)) continue;
                for (const movie of movies) {
                    if (!Array.isArray(movie.horarios)) continue;
                    for (const h of movie.horarios) {
                        const mins = timeToMinutes(h);
                        if (!isNaN(mins)) {
                            minShowtime = Math.min(minShowtime, mins);
                            maxShowtime = Math.max(maxShowtime, mins);
                            hasShowtimes = true;
                        }
                    }
                }
            }
        }
    } else {
        const movieData = getCurrentMovieData();
        if (movieData) {
            for (const [sedeId, movies] of Object.entries(movieData)) {
                if (state.activeSedes && !state.activeSedes.has(sedeId)) continue;
                if (!Array.isArray(movies)) continue;
                for (const movie of movies) {
                    if (!Array.isArray(movie.horarios)) continue;
                    for (const h of movie.horarios) {
                        const mins = timeToMinutes(h);
                        if (!isNaN(mins)) {
                            minShowtime = Math.min(minShowtime, mins);
                            maxShowtime = Math.max(maxShowtime, mins);
                            hasShowtimes = true;
                        }
                    }
                }
            }
        }
    }

    if (!hasShowtimes) {
        // Fallback default: 10:00 (600) a 24:00 (1440)
        updateTimeSliderBounds(600, 1440);
        return;
    }

    // Redondear hora mínima hacia abajo (floor) y hora máxima hacia arriba (ceil)
    let floorHourMin = Math.floor(minShowtime / 60) * 60;
    let ceilHourMax = Math.ceil(maxShowtime / 60) * 60;

    // Asegurar al menos 1 hora de rango
    if (ceilHourMax - floorHourMin < 60) {
        ceilHourMax = Math.min(1440, floorHourMin + 60);
    }

    // Limitar entre 00:00 y 24:00
    floorHourMin = Math.max(0, Math.min(1440, floorHourMin));
    ceilHourMax = Math.max(floorHourMin + 60, Math.min(1440, ceilHourMax));

    updateTimeSliderBounds(floorHourMin, ceilHourMax);
}

/**
 * Actualiza los valores del slider desde strings HH:MM o vacíos.
 * @param {string} startStr
 * @param {string} endStr
 */
export function setTimeSlider(startStr, endStr) {
    const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;

    let minVal = parseTimeToMinutes(startStr, MIN_MINUTES);
    let maxVal = parseTimeToMinutes(endStr, MAX_MINUTES);

    if (minVal > maxVal) {
        const temp = minVal;
        minVal = maxVal;
        maxVal = temp;
    }

    if (minInputEl) minInputEl.value = minVal;
    if (maxInputEl) maxInputEl.value = maxVal;

    updateVisuals(minVal, maxVal);
}

/**
 * Restablece los controles a sus valores por defecto dinámicos.
 */
export function resetTimeSlider() {
    const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;
    if (minInputEl) minInputEl.value = MIN_MINUTES;
    if (maxInputEl) maxInputEl.value = MAX_MINUTES;
    updateVisuals(MIN_MINUTES, MAX_MINUTES);
}

/**
 * Habilita o deshabilita los controles del slider y su botón de limpiar.
 * @param {boolean} disabled
 */
export function setTimeSliderDisabled(disabled) {
    if (minInputEl) minInputEl.disabled = disabled;
    if (maxInputEl) maxInputEl.disabled = disabled;
    if (clearBtnEl) {
        clearBtnEl.disabled = disabled;
        clearBtnEl.classList.toggle('clear-time-btn--locked', disabled);
    }
    if (wrapperEl) {
        wrapperEl.classList.toggle('time-slider--locked', disabled);
    }
}

/**
 * Obtiene los valores actuales del slider en formato de minutos y strings.
 * @returns {{ minMinutes: number, maxMinutes: number, start: string, end: string, isDefault: boolean }}
 */
export function getTimeSliderValues() {
    const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;
    const minVal = minInputEl ? parseInt(minInputEl.value, 10) : MIN_MINUTES;
    const maxVal = maxInputEl ? parseInt(maxInputEl.value, 10) : MAX_MINUTES;
    const isDefault = minVal === MIN_MINUTES && maxVal === MAX_MINUTES;

    return {
        minMinutes: minVal,
        maxMinutes: maxVal,
        start: isDefault ? '' : minutesToTime(minVal),
        end: isDefault ? '' : minutesToTime(maxVal),
        isDefault
    };
}

/**
 * Notifica el cambio al callback registrado (con requestAnimationFrame para suavidad a 60fps).
 */
function emitChange(minVal, maxVal) {
    if (typeof onTimeChangeCallback !== 'function') return;

    const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;
    const isDefault = minVal === MIN_MINUTES && maxVal === MAX_MINUTES;
    const startStr = isDefault ? '' : minutesToTime(minVal);
    const endStr = isDefault ? '' : minutesToTime(maxVal);

    if (rafId) {
        cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
        onTimeChangeCallback(startStr, endStr);
    });
}

/**
 * Inicializa el Dual Range Slider.
 * @param {Object} options
 * @param {Function} options.onTimeChange - Callback que recibe (startStr, endStr)
 */
export function initTimeSlider(options = {}) {
    onTimeChangeCallback = options.onTimeChange || null;

    minInputEl = document.getElementById('timeSliderMin');
    maxInputEl = document.getElementById('timeSliderMax');
    trackHighlightEl = document.getElementById('timeSliderTrackHighlight');
    rangeDisplayEl = document.getElementById('timeRangeDisplay');
    clearBtnEl = document.getElementById('clearTimeFilter');
    containerEl = document.getElementById('timeSliderContainer');
    wrapperEl = containerEl ? containerEl.closest('.time-slider-wrapper') : null;

    if (!minInputEl || !maxInputEl || !containerEl) {
        console.warn('initTimeSlider: elementos del DOM no encontrados.');
        return;
    }

    // Manejar interacción con el slider de inicio
    minInputEl.addEventListener('input', () => {
        let minVal = parseInt(minInputEl.value, 10);
        const maxVal = parseInt(maxInputEl.value, 10);

        if (minVal > maxVal) {
            minInputEl.value = maxVal;
            minVal = maxVal;
        }

        updateVisuals(minVal, maxVal);
        emitChange(minVal, maxVal);
    });

    // Manejar interacción con el slider de fin
    maxInputEl.addEventListener('input', () => {
        const minVal = parseInt(minInputEl.value, 10);
        let maxVal = parseInt(maxInputEl.value, 10);

        if (maxVal < minVal) {
            maxInputEl.value = minVal;
            maxVal = minVal;
        }

        updateVisuals(minVal, maxVal);
        emitChange(minVal, maxVal);
    });

    // Eventos change para sincronización final inmediata
    const handleChange = () => {
        const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;
        const minVal = parseInt(minInputEl.value, 10);
        const maxVal = parseInt(maxInputEl.value, 10);
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (typeof onTimeChangeCallback === 'function') {
            const isDefault = minVal === MIN_MINUTES && maxVal === MAX_MINUTES;
            onTimeChangeCallback(isDefault ? '' : minutesToTime(minVal), isDefault ? '' : minutesToTime(maxVal));
        }
    };

    minInputEl.addEventListener('change', handleChange);
    maxInputEl.addEventListener('change', handleChange);

    // Dynamic Z-Index y clic directo sobre la pista
    containerEl.addEventListener('pointermove', (e) => {
        if (minInputEl.disabled || maxInputEl.disabled) return;
        const rect = containerEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const { MIN_MINUTES, MAX_MINUTES } = TIME_SLIDER_CONFIG;
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const hoverMinutes = MIN_MINUTES + ratio * (MAX_MINUTES - MIN_MINUTES);
        const minVal = parseInt(minInputEl.value, 10);
        const maxVal = parseInt(maxInputEl.value, 10);

        if (Math.abs(hoverMinutes - minVal) < Math.abs(hoverMinutes - maxVal)) {
            minInputEl.style.zIndex = '3';
            maxInputEl.style.zIndex = '2';
        } else {
            maxInputEl.style.zIndex = '3';
            minInputEl.style.zIndex = '2';
        }
    });

    containerEl.addEventListener('pointerdown', (e) => {
        if (minInputEl.disabled || maxInputEl.disabled) return;
        const rect = containerEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const { MIN_MINUTES, MAX_MINUTES, STEP_MINUTES } = TIME_SLIDER_CONFIG;
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const rawMinutes = MIN_MINUTES + ratio * (MAX_MINUTES - MIN_MINUTES);
        const clickedMinutes = Math.round(rawMinutes / STEP_MINUTES) * STEP_MINUTES;

        const minVal = parseInt(minInputEl.value, 10);
        const maxVal = parseInt(maxInputEl.value, 10);

        const distToMin = Math.abs(clickedMinutes - minVal);
        const distToMax = Math.abs(clickedMinutes - maxVal);

        if (distToMin < distToMax || (distToMin === distToMax && clickedMinutes <= minVal)) {
            minInputEl.style.zIndex = '3';
            maxInputEl.style.zIndex = '2';
        } else {
            maxInputEl.style.zIndex = '3';
            minInputEl.style.zIndex = '2';
        }

        // Si se hizo clic directamente en la pista (no sobre los thumbs nativos)
        if (e.target === containerEl || e.target === trackHighlightEl || e.target.classList.contains('time-slider-track')) {
            if (distToMin < distToMax || (distToMin === distToMax && clickedMinutes <= minVal)) {
                const newMin = Math.min(clickedMinutes, maxVal);
                minInputEl.value = newMin;
                updateVisuals(newMin, maxVal);
                emitChange(newMin, maxVal);
            } else {
                const newMax = Math.max(clickedMinutes, minVal);
                maxInputEl.value = newMax;
                updateVisuals(minVal, newMax);
                emitChange(minVal, newMax);
            }
        }
    });

    // Sincronizar dinámicamente con las funciones si ya están cargadas
    syncTimeSliderWithShowtimes();
}
