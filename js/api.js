import { API_FEED_URL } from './config.js';

let feedPromise = null;

/**
 * Descarga el feed consolidado semanal de Cineteca (una sola petición HTTP por sesión).
 * @param {boolean} forceRefresh Si es true, ignora la promesa en memoria y descarga de nuevo.
 * @returns {Promise<Object>}
 */
export async function fetchConsolidatedFeed(forceRefresh = false) {
    if (feedPromise && !forceRefresh) {
        return feedPromise;
    }

    feedPromise = (async () => {
        try {
            const response = await fetch(API_FEED_URL);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching consolidated feed:', error);
            feedPromise = null;
            throw error;
        }
    })();

    return feedPromise;
}

