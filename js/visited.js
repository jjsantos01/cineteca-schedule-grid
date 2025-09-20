import { VISITED_MOVIES_KEY } from './config.js';
import { getMovieUniqueId } from './utils.js';

let visitedMovies = new Set();

export function initializeVisitedMovies() {
    try {
        const stored = localStorage.getItem(VISITED_MOVIES_KEY);
        if (stored) {
            visitedMovies = new Set(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Error loading visited movies from storage', error);
        visitedMovies = new Set();
    }
}

export function markMovieAsVisited(movie, horario) {
    const movieId = getMovieUniqueId(movie, horario);
    if (!visitedMovies.has(movieId)) {
        visitedMovies.add(movieId);
        try {
            localStorage.setItem(VISITED_MOVIES_KEY, JSON.stringify(Array.from(visitedMovies)));
        } catch (error) {
            console.error('Error saving visited movies', error);
        }
    }
}

export function isMovieVisited(movieId) {
    return visitedMovies.has(movieId);
}
