import state, { setNavigationData, setNavigating } from './state.js';
import { minutesToTime, timeToMinutes, extractFilmId } from './utils.js';
import { parseAllShowtimes, buildMovieNavigationArray } from './showtimes.js';

export function initModal() {
    document.addEventListener('click', (event) => {
        const modal = document.getElementById('movieInfoModal');
        if (event.target === modal) {
            closeMovieInfoModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        const modal = document.getElementById('movieInfoModal');
        if (modal.style.display === 'flex') {
            if (!state.isNavigating && event.key === 'ArrowLeft') {
                event.preventDefault();
                navigateToPrevMovie();
            } else if (!state.isNavigating && event.key === 'ArrowRight') {
                event.preventDefault();
                navigateToNextMovie();
            } else if (event.key === 'Escape') {
                closeMovieInfoModal();
            }
        }
    });
}

export async function showMovieInfoModal(movie, horario = null) {
    const movies = buildMovieNavigationArray();
    let index = 0;

    if (horario) {
        index = movies.findIndex(item =>
            item.movie.titulo === movie.titulo &&
            item.movie.sedeId === movie.sedeId &&
            item.movie.sala === movie.sala &&
            item.horario === horario
        );
    } else {
        index = movies.findIndex(item =>
            item.movie.titulo === movie.titulo &&
            item.movie.sedeId === movie.sedeId
        );
    }

    if (index === -1) {
        index = 0;
    }

    setNavigationData(movies, index);
    await displayMovieInModal(index);
}

export function navigateToNextMovie() {
    if (state.isNavigating || state.currentMovieIndex >= state.allMoviesForNavigation.length - 1) {
        return;
    }

    setNavigating(true);
    disableNavigationButtons(true);
    state.currentMovieIndex += 1;
    displayMovieInModal(state.currentMovieIndex).finally(() => {
        setNavigating(false);
        disableNavigationButtons(false);
        updateNavigationButtons();
    });
}

export function navigateToPrevMovie() {
    if (state.isNavigating || state.currentMovieIndex <= 0) {
        return;
    }

    setNavigating(true);
    disableNavigationButtons(true);
    state.currentMovieIndex -= 1;
    displayMovieInModal(state.currentMovieIndex).finally(() => {
        setNavigating(false);
        disableNavigationButtons(false);
        updateNavigationButtons();
    });
}

export function closeMovieInfoModal() {
    const modal = document.getElementById('movieInfoModal');
    const trailerFrame = document.getElementById('trailerFrame');
    const playButton = document.getElementById('playButton');
    const videoContainer = document.getElementById('videoContainer');
    const moviePoster = document.getElementById('moviePoster');

    if (trailerFrame) {
        trailerFrame.src = '';
    }
    if (videoContainer) {
        videoContainer.style.display = 'none';
    }
    if (moviePoster) {
        moviePoster.style.display = 'block';
    }
    if (playButton) {
        playButton.style.display = 'flex';
    }

    modal.style.display = 'none';
}

export function playTrailer(embedUrl) {
    const playButton = document.getElementById('playButton');
    const videoContainer = document.getElementById('videoContainer');
    const trailerFrame = document.getElementById('trailerFrame');
    const moviePoster = document.getElementById('moviePoster');

    if (playButton) playButton.style.display = 'none';
    if (moviePoster) moviePoster.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'block';
    if (trailerFrame) trailerFrame.src = embedUrl;
}

async function displayMovieInModal(index) {
    if (index < 0 || index >= state.allMoviesForNavigation.length) {
        return;
    }

    state.currentMovieIndex = index;
    const currentItem = state.allMoviesForNavigation[index];
    const movie = currentItem.movie;
    const horario = currentItem.horario;
    const modal = document.getElementById('movieInfoModal');
    const modalTitle = modal.querySelector('.movie-modal-title');
    const modalInfo = modal.querySelector('.movie-modal-info');
    const modalLoading = modal.querySelector('.movie-modal-loading');

    updateNavigationButtons();

    const endTime = minutesToTime(timeToMinutes(horario) + movie.duracion);
    modalTitle.innerHTML = `
        <div class="modal-title-content">
            <div class="movie-title-main">${movie.titulo}${movie.tipoVersion ? ` ${movie.tipoVersion}` : ''}</div>
            <div class="movie-title-details">${horario} - ${endTime} | ${movie.salaCompleta}</div>
        </div>
    `;

    if (state.isNavigating) {
        showLoadingOverlay();
    } else {
        modalInfo.style.display = 'none';
        modalLoading.style.display = 'block';
        modal.style.display = 'flex';
    }

    const filmId = extractFilmId(movie.href);
    if (!filmId) {
        updateModalContent('No hay información detallada disponible para esta película.');
        return;
    }

    const [movieDetails, imageUrl, trailerUrl] = await Promise.all([
        fetchMovieDetails(filmId),
        fetchMovieImage(filmId),
        fetchMovieTrailer(filmId)
    ]);

    const paragraphs = movieDetails?.info || [];
    const allShowtimesText = movieDetails?.showtimes;

    if (!paragraphs || paragraphs.length === 0) {
        updateModalContent('No se pudo obtener información adicional para esta película.');
        return;
    }

    const decodedParagraphs = paragraphs.map(text =>
        text
            .replace(/&nbsp;/g, ' ')
            .replace(/&oacute;/g, 'ó')
            .replace(/&eacute;/g, 'é')
            .replace(/&iacute;/g, 'í')
            .replace(/&aacute;/g, 'á')
            .replace(/&uacute;/g, 'ú')
            .replace(/&ntilde;/g, 'ñ')
            .replace(/&Aacute;/g, 'Á')
            .replace(/&Eacute;/g, 'É')
            .replace(/&Iacute;/g, 'Í')
            .replace(/&Oacute;/g, 'Ó')
            .replace(/&Uacute;/g, 'Ú')
            .replace(/&Ntilde;/g, 'Ñ')
    );

    let year = '';
    let originalTitle = '';
    if (decodedParagraphs[0]) {
        const parenthesisMatch = decodedParagraphs[0].match(/\(([^)]+)\)/);
        if (parenthesisMatch && parenthesisMatch[1]) {
            const content = parenthesisMatch[1];
            const titleCommaCount = (movie.titulo.match(/,/g) || []).length;
            const parts = content.split(',');
            if (parts.length > titleCommaCount) {
                originalTitle = parts.slice(0, titleCommaCount + 1).join(',').trim();
            } else {
                originalTitle = parts[0].trim();
            }
            const yearMatch = content.match(/\b(19\d{2}|20\d{2})\b/);
            if (yearMatch) {
                year = yearMatch[0];
            }
        } else {
            const yearMatch = decodedParagraphs[0].match(/\b(19\d{2}|20\d{2})\b/);
            if (yearMatch) {
                year = yearMatch[0];
            }
        }
    }

    let formattedInfo = '';
    if (imageUrl || trailerUrl) {
        const embedUrl = getYouTubeEmbedUrl(trailerUrl);
        formattedInfo += `
            <div class="movie-image-container">
                <div class="media-wrapper" id="mediaWrapper">
        `;
        if (imageUrl) {
            formattedInfo += `<img src="${imageUrl}" alt="${movie.titulo}" class="movie-poster" id="moviePoster">`;
        }
        if (trailerUrl && embedUrl) {
            formattedInfo += `
                <div class="play-button-overlay" id="playButton" data-embed="${embedUrl}">
                    <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </div>
                <div class="video-container" id="videoContainer" style="display: none;">
                    <iframe id="trailerFrame" width="100%" height="315" frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen></iframe>
                </div>
            `;
        }
        formattedInfo += '</div></div>';
    }

    if (decodedParagraphs[0]) {
        formattedInfo += `<p class="movie-info-general">${decodedParagraphs[0]}</p>`;
    }

    if (decodedParagraphs[1]) {
        formattedInfo += `<p class="movie-info-credits">${decodedParagraphs[1]}</p>`;
    }

    if (decodedParagraphs[2]) {
        formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[2]}</p>`;
    }

    if (decodedParagraphs.length > 3) {
        for (let i = 3; i < decodedParagraphs.length; i++) {
            formattedInfo += `<p class="movie-info-synopsis">${decodedParagraphs[i]}</p>`;
        }
    }

    if (allShowtimesText) {
        const parsedShowtimes = parseAllShowtimes(allShowtimesText);
        if (parsedShowtimes.length > 0) {
            formattedInfo += `
                <div class="all-showtimes-container">
                    <button id="toggleAllShowtimes" class="toggle-showtimes-btn" data-count="${parsedShowtimes.length}">
                        Ver todas las funciones (${parsedShowtimes.length})
                    </button>
                    <div id="allShowtimesTable" class="all-showtimes-table" style="display: none;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Sede</th>
                                    <th>Sala</th>
                                    <th>Horario</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parsedShowtimes.map(showtime => `
                                    <tr>
                                        <td>${showtime.date}</td>
                                        <td>${showtime.sede}</td>
                                        <td>SALA ${showtime.sala}</td>
                                        <td>${showtime.horario}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }

    const searchTitle = originalTitle || movie.titulo.trim();
    const imdbUrl = year
        ? `https://www.imdb.com/es/search/title/?title=${encodeURIComponent(searchTitle)}&title_type=feature,short&release_date=${year}-01-01,${year}-12-31`
        : `https://www.imdb.com/es/search/title/?title=${encodeURIComponent(searchTitle)}&title_type=feature,short`;
    const letterboxdUrl = `https://letterboxd.com/search/films/${searchTitle.replace(/\s+/g, '+')}${year ? '+' + year : ''}/`;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${searchTitle} ${year ? year + ' ' : ''}trailer`)}`;

    formattedInfo += `
        <div class="movie-search-links">
            <p class="search-links-title">Buscar con:</p>
            <div class="search-buttons">
                <a href="${imdbUrl}" target="_blank" rel="noopener noreferrer" class="search-button imdb-button">IMDB</a>
                <a href="${letterboxdUrl}" target="_blank" rel="noopener noreferrer" class="search-button letterboxd-button">Letterboxd</a>
                <a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" class="search-button youtube-button">YouTube</a>
            </div>
        </div>
    `;

    updateModalContent(formattedInfo);

    setTimeout(() => {
        const toggleBtn = document.getElementById('toggleAllShowtimes');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const tableElement = document.getElementById('allShowtimesTable');
                if (tableElement.style.display === 'none') {
                    tableElement.style.display = 'block';
                    toggleBtn.textContent = 'Ocultar funciones';
                } else {
                    tableElement.style.display = 'none';
                    const count = toggleBtn.getAttribute('data-count');
                    toggleBtn.textContent = `Ver todas las funciones (${count})`;
                }
            });
        }

        const playBtn = document.getElementById('playButton');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const embedUrl = playBtn.getAttribute('data-embed');
                if (embedUrl) {
                    playTrailer(embedUrl);
                }
            });
        }
    }, 100);
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevMovieBtn');
    const nextBtn = document.getElementById('nextMovieBtn');
    const counter = document.getElementById('movieCounter');

    if (!state.isNavigating) {
        if (prevBtn) prevBtn.disabled = state.currentMovieIndex <= 0;
        if (nextBtn) nextBtn.disabled = state.currentMovieIndex >= state.allMoviesForNavigation.length - 1;
    }

    if (counter) {
        counter.textContent = `${state.currentMovieIndex + 1} de ${state.allMoviesForNavigation.length}`;
    }
}

function disableNavigationButtons(disabled) {
    const prevBtn = document.getElementById('prevMovieBtn');
    const nextBtn = document.getElementById('nextMovieBtn');
    if (prevBtn) prevBtn.disabled = disabled;
    if (nextBtn) nextBtn.disabled = disabled;
}

function showLoadingOverlay() {
    const modalBody = document.querySelector('.movie-modal-body');
    let overlay = document.getElementById('modalLoadingOverlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalLoadingOverlay';
        overlay.className = 'modal-loading-overlay';
        overlay.innerHTML = `
            <div class="modal-loading-spinner">
                <div class="spinner"></div>
                <span>Cargando...</span>
            </div>
        `;
        modalBody.appendChild(overlay);
    }

    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('modalLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function updateModalContent(newContent) {
    const modalInfo = document.querySelector('.movie-modal-info');
    const modalLoading = document.querySelector('.movie-modal-loading');

    modalLoading.style.display = 'none';
    hideLoadingOverlay();
    modalInfo.innerHTML = newContent;
    modalInfo.style.display = 'block';
    modalInfo.scrollTop = 0;
}


async function fetchMovieDetails(filmId) {
    if (!filmId) return { info: [], showtimes: null };
    try {
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2FdetallePelicula.php%3FFilmId%3D${filmId}%26cinemaId%3D000&selector=p%5Bclass*%3D%22lh-1%22%5D%2C+div%5Bclass%3D%22col-12+col-md-3+float-left+small%22%5D&scrape=text&pretty=true`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        const result = { info: [], showtimes: null };
        if (data && data.result) {
            if (data.result['p[class*="lh-1"]'] && data.result['p[class*="lh-1"]'].length > 0) {
                result.info = data.result['p[class*="lh-1"]'];
            }
            if (data.result['div[class="col-12 col-md-3 float-left small"]'] &&
                data.result['div[class="col-12 col-md-3 float-left small"]'].length > 0) {
                result.showtimes = data.result['div[class="col-12 col-md-3 float-left small"]'][0];
            }
        }
        return result;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return { info: [], showtimes: null };
    }
}

async function fetchMovieImage(filmId) {
    if (!filmId) return null;
    try {
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2FdetallePelicula.php%3FFilmId%3D${filmId}%26cinemaId%3D000&selector=img%5Bclass%3D%22img-fluid%22%5D&scrape=attr&attr=src&pretty=true`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data && data.result) {
            return data.result;
        }
        return null;
    } catch (error) {
        console.error('Error fetching movie image:', error);
        return null;
    }
}

async function fetchMovieTrailer(filmId) {
    if (!filmId) return null;
    try {
        const apiUrl = `https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2Fsedes%2FdetallePelicula.php%3FFilmId%3D${filmId}&selector=%5Bclass%3D%22float-left+ml-2%22%5D+%3E+a&scrape=attr&attr=href&pretty=true`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data && data.result) {
            return data.result;
        }
        return null;
    } catch (error) {
        console.error('Error fetching movie trailer:', error);
        return null;
    }
}

function getYouTubeEmbedUrl(youtubeUrl) {
    if (!youtubeUrl) return null;
    let videoId = null;
    if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
    } else if (youtubeUrl.includes('youtube.com/watch?v=')) {
        videoId = youtubeUrl.split('v=')[1].split('&')[0];
    } else if (youtubeUrl.includes('youtube.com/embed/')) {
        videoId = youtubeUrl.split('embed/')[1].split('?')[0];
    }
    if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    return null;
}

