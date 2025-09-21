import { extractFilmId } from './utils.js';

const POSTER_BASE_URL = 'https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic';

export function renderPosterCarousel(movieData, { isLoading = false } = {}) {
    const container = document.getElementById('posterCarousel');
    if (!container) {
        return;
    }

    const uniqueMovies = collectUniqueMoviesWithPoster(movieData);
    container.innerHTML = '';

    if (uniqueMovies.length === 0) {
        const hasMovies = Object.values(movieData).some(movies => Array.isArray(movies) && movies.length > 0);
        const message = isLoading
            ? 'Cargando posters disponibles...'
            : hasMovies
                ? 'No se encontraron posters para las películas actuales.'
                : 'Selecciona una fecha y sede con funciones disponibles para ver los posters.';

        const emptyState = document.createElement('div');
        emptyState.className = 'poster-carousel-empty';
        emptyState.textContent = message;
        container.appendChild(emptyState);
        return;
    }

    const track = document.createElement('div');
    track.className = 'poster-carousel-track';
    track.setAttribute('role', 'list');

    for (const movie of uniqueMovies) {
        const card = createPosterCard(movie);
        track.appendChild(card);
    }

    container.appendChild(track);
}

function collectUniqueMoviesWithPoster(movieData) {
    const moviesByFilmId = new Map();

    for (const movies of Object.values(movieData)) {
        if (!Array.isArray(movies)) {
            continue;
        }

        for (const movie of movies) {
            const filmId = extractFilmId(movie.href);
            if (!filmId || moviesByFilmId.has(filmId)) {
                continue;
            }

            const displayTitle = movie.tipoVersion
                ? `${movie.titulo} (${movie.tipoVersion})`
                : movie.titulo;

            moviesByFilmId.set(filmId, {
                title: displayTitle,
                filmId
            });
        }
    }

    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    return Array.from(moviesByFilmId.values()).sort((a, b) => collator.compare(a.title, b.title));
}

function createPosterCard(movie) {
    const card = document.createElement('article');
    card.className = 'poster-card';
    card.setAttribute('role', 'listitem');

    const title = document.createElement('h3');
    title.className = 'poster-card-title';
    title.textContent = movie.title;

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'poster-card-image-wrapper';

    const image = document.createElement('img');
    image.className = 'poster-card-image';
    image.src = `${POSTER_BASE_URL}/${movie.filmId}`;
    image.alt = `Poster de ${movie.title}`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => handlePosterError(imageWrapper, image));

    imageWrapper.appendChild(image);
    card.appendChild(title);
    card.appendChild(imageWrapper);

    return card;
}

function handlePosterError(wrapper, image) {
    image.remove();
    wrapper.classList.add('poster-card-image-wrapper--error');
    const fallback = document.createElement('div');
    fallback.className = 'poster-card-image-fallback';
    fallback.textContent = 'Poster no disponible';
    wrapper.appendChild(fallback);
}







