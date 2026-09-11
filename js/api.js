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
            if (API_FEED_URL !== 'https://cinetk.jjsantosochoa.workers.dev/feed') {
                console.warn('Fallo al obtener feed local, intentando producción como respaldo...', error);
                try {
                    const fallbackResp = await fetch('https://cinetk.jjsantosochoa.workers.dev/feed');
                    if (fallbackResp.ok) {
                        return await fallbackResp.json();
                    }
                } catch (fallbackError) {
                    console.error('Fallo también el respaldo de producción:', fallbackError);
                }
            }
            console.error('Error fetching consolidated feed:', error);
            feedPromise = null;
            throw error;
        }
    })();

    return feedPromise;
}

