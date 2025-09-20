import state from './state.js';
import { MAX_CACHE_DAYS } from './config.js';

export function hasCachedData(dateKey, sedeId) {
    return Boolean(state.cachedData[dateKey] && state.cachedData[dateKey][sedeId]);
}

export function getCachedData(dateKey, sedeId) {
    if (hasCachedData(dateKey, sedeId)) {
        return state.cachedData[dateKey][sedeId].data;
    }
    return null;
}

export function setCachedData(dateKey, sedeId, data) {
    if (!state.cachedData[dateKey]) {
        state.cachedData[dateKey] = {};
    }
    state.cachedData[dateKey][sedeId] = {
        data,
        date: new Date()
    };
}

export function cleanOldCache() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_CACHE_DAYS);

    for (const [dateKey, entries] of Object.entries(state.cachedData)) {
        const keyDate = new Date(dateKey);
        if (keyDate < cutoffDate) {
            delete state.cachedData[dateKey];
            continue;
        }

        for (const [sedeId, cacheEntry] of Object.entries(entries)) {
            if (!cacheEntry.date) continue;
            const cachedDate = new Date(cacheEntry.date);
            if (cachedDate < cutoffDate) {
                delete entries[sedeId];
            }
        }

        if (Object.keys(entries).length === 0) {
            delete state.cachedData[dateKey];
        }
    }
}
