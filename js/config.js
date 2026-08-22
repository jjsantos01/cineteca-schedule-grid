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
export const API_BASE_URL = 'https://cinetk.jjsantosochoa.workers.dev/?cinemaId={cinemaId}&dia={fecha}';
export const SELECTED_SEDES_KEY = 'cinetkSelectedSedes';
export const VISITED_MOVIES_KEY = 'cinetkVisitedMovies';
export const MAX_CACHE_DAYS = 7;
export const DEFAULT_SEDES = ['003'];
