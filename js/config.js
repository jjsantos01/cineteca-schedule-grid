export const SEDES = {
    '001': {
        nombre: 'CHAPULTEPEC',
        codigo: 'CNCH',
        color: '#b734dbff',
        className: 'chapultepec'
    },
    '002': {
        nombre: 'CENART',
        codigo: 'CNA',
        color: '#3498DB',
        className: 'cenart'
    },
    '003': {
        nombre: 'XOCO',
        codigo: 'XOCO',
        color: '#2ECC71',
        className: 'xoco'
    }
};

export const HOUR_WIDTH = 120;
export const API_BASE_URL = 'https://cinetk.jjsantosochoa.workers.dev/?cinemaId={cinemaId}&dia={fecha}';
export const SELECTED_SEDES_KEY = 'cinetkSelectedSedes';
export const VISITED_MOVIES_KEY = 'cinetkVisitedMovies';
export const MAX_CACHE_DAYS = 7;
export const DEFAULT_SEDES = ['003'];
