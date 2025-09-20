import state, { resetSelectionState } from './state.js';
import { getMovieUniqueId, timeToMinutes, doMoviesOverlap } from './utils.js';
import { hasActiveFilters } from './filters.js';
import { updateStateInURL } from './urlState.js';

export function toggleMovieSelection(movieData, horario) {
    if (hasActiveFilters()) {
        return { changed: false, selected: false };
    }

    const movieId = getMovieUniqueId(movieData, horario);
    const startMinutes = timeToMinutes(horario);
    const endMinutes = startMinutes + movieData.duracion;

    const movieInfo = {
        titulo: movieData.titulo,
        tipoVersion: movieData.tipoVersion || '',
        horario,
        duracion: movieData.duracion,
        sala: movieData.sala,
        sede: movieData.sede,
        sedeId: movieData.sedeId,
        startMinutes,
        endMinutes,
        uniqueId: movieId
    };

    const existingIndex = state.selectedMovies.findIndex(m => m.uniqueId === movieId);
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
        const movieId = getMovieUniqueId(movie, horario);
        const isSelected = state.selectedMovies.some(m => m.uniqueId === movieId);
        block.classList.toggle('selected', isSelected);

        if (!isSelected && state.selectedMovies.length > 0 && !hasActiveFilters()) {
            const startMinutes = timeToMinutes(horario);
            const endMinutes = startMinutes + movie.duracion;
            const overlapsWithSelected = state.selectedMovies.some(selected => {
                return startMinutes < selected.endMinutes && selected.startMinutes < endMinutes;
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
