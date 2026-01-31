import state, { resetSelectionState } from './state.js';
import { doMoviesOverlap } from './utils.js';
import { hasActiveFilters } from './filters.js';
import { updateStateInURL } from './urlState.js';
import { getEnrichedShowtime } from './movieUtils.js';

export function toggleMovieSelection(movieData, horario) {
    if (hasActiveFilters()) {
        return { changed: false, selected: false };
    }

    const enriched = getEnrichedShowtime(movieData, horario);

    const movieInfo = {
        titulo: movieData.titulo,
        tipoVersion: movieData.tipoVersion || '',
        horario,
        duracion: movieData.duracion,
        sala: movieData.sala,
        sede: movieData.sede,
        sedeId: movieData.sedeId,
        startMinutes: enriched.startMinutes,
        endMinutes: enriched.endMinutes,
        uniqueId: enriched.uniqueId
    };

    const existingIndex = state.selectedMovies.findIndex(m => m.uniqueId === enriched.uniqueId);
    let isSelected = false;

    if (existingIndex !== -1) {
        state.selectedMovies.splice(existingIndex, 1);
    } else {
        const hasOverlap = state.selectedMovies.some(selected => doMoviesOverlap(selected, movieInfo));
        if (!hasOverlap) {
            state.selectedMovies.push(movieInfo);
            isSelected = true;
        } else {
            return { changed: false, selected: false };
        }
    }

    updateSelectionDisplay();
    updateMovieBlocksVisuals();
    updateStateInURL();
    return { changed: true, selected: isSelected };
}

export function updateMovieBlocksVisuals() {
    const movieBlocks = document.querySelectorAll('.movie-block');

    movieBlocks.forEach(block => {
        const movieDataStr = block.dataset.movie.replace(/&quot;/g, '"');
        const movie = JSON.parse(movieDataStr);
        const horario = block.dataset.horario;
        const enriched = getEnrichedShowtime(movie, horario);
        const isSelected = state.selectedMovies.some(m => m.uniqueId === enriched.uniqueId);
        block.classList.toggle('selected', isSelected);

        if (!isSelected && state.selectedMovies.length > 0 && !hasActiveFilters()) {
            const overlapsWithSelected = state.selectedMovies.some(selected => {
                return enriched.startMinutes < selected.endMinutes && selected.startMinutes < enriched.endMinutes;
            });
            block.classList.toggle('filtered-out', overlapsWithSelected);
        } else if (!hasActiveFilters()) {
            block.classList.remove('filtered-out');
        }
    });
}

export function updateSelectionDisplay() {
    const container = document.getElementById('scheduleContainer');
    let selectionInfo = document.getElementById('selectionInfo');

    if (state.selectedMovies.length === 0) {
        if (selectionInfo) selectionInfo.remove();
        return;
    }

    if (!selectionInfo) {
        selectionInfo = document.createElement('div');
        selectionInfo.id = 'selectionInfo';
        selectionInfo.className = 'selection-info';
        container.insertBefore(selectionInfo, container.firstChild);
    }

    const movieTitles = state.selectedMovies
        .map(m => `${m.titulo} (${m.horario})`)
        .join(', ');

    selectionInfo.innerHTML = `
        <div class="selected-movies-list">
            <strong>Películas seleccionadas:</strong> ${movieTitles}
        </div>
        <button class="clear-selection-btn" id="clearSelectionButton">
            Borrar selección
        </button>
    `;

    const clearButton = selectionInfo.querySelector('#clearSelectionButton');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            clearSelection();
        });
    }
}

export function clearSelection() {
    resetSelectionState();
    updateSelectionDisplay();
    updateMovieBlocksVisuals();
    updateStateInURL();
}
