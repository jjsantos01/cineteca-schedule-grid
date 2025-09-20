import { API_BASE_URL } from './config.js';
import { formatDateForAPI } from './utils.js';
import { parseMovieData } from './parser.js';

export async function fetchMoviesForSede(sedeId, date) {
    try {
        const formattedDate = formatDateForAPI(date);
        const url = API_BASE_URL
            .replace('{cinemaId}', sedeId)
            .replace('{fecha}', formattedDate);

        const response = await fetch(url);
        const data = await response.json();

        const movies = [];
        if (data && data.data) {
            if (data.data.length === 0) {
                console.log(`No movies found for sede ${sedeId} on ${formattedDate}`);
                return movies;
            }

            for (const item of data.data) {
                const movie = parseMovieData(item.text, sedeId, item.href);
                if (movie) {
                    movies.push(movie);
                }
            }
        }

        return movies;
    } catch (error) {
        console.error(`Error fetching data for sede ${sedeId}:`, error);
        return [];
    }
}
