export const SEDES = {
    '001': {
        nombre: 'CHAPULTEPEC',
        codigo: 'CNCH',
        color: '#28714f',
        className: 'chapultepec'
    },
    '002': {
        nombre: 'CENART',
        codigo: 'CNA',
        color: '#642f90',
        className: 'cenart'
    },
    '003': {
        nombre: 'XOCO',
        codigo: 'XOCO',
        color: '#eb1c23',
        className: 'xoco'
    }
};

export const HOUR_WIDTH = 120;
export const POSTER_BASE_URL = 'https://rbvfcn.cinetecanacional.net/CDN/media/entity/get/FilmPosterGraphic';
export const DEFAULT_API_VERSION = 'v2';

export function getAPIVersion() {
    return 'v2';
}

export const API_BASE_URL = 'https://cinetk.jjsantosochoa.workers.dev/v2?cinemaId={cinemaId}&dia={fecha}';
export const MOVIE_DETAILS_API_URL = 'https://cinetk.jjsantosochoa.workers.dev/movie-details?filmId={filmId}';
export const SELECTED_SEDES_KEY = 'cinetkSelectedSedes';
export const VISITED_MOVIES_KEY = 'cinetkVisitedMovies';
export const MAX_CACHE_DAYS = 7;
export const DEFAULT_SEDES = ['003'];


