/**
 * Cloudflare Worker: cinetk
 * Módulo de Configuración y Constantes Compartidas
 */

export const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
};

export const SEDE_CODES = {
    '001': 'CNCH',
    '002': 'CNA',
    '003': 'XOCO'
};

export const SEDE_NAMES = {
    '001': 'CHAPULTEPEC',
    '002': 'CENART',
    '003': 'XOCO'
};

export const ALL_SEDES = ['001', '002', '003'];
export const SYNC_DAYS_AHEAD = 7;
