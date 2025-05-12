// API functions
async function fetchMoviesForSede(sedeId, date) {
    try {
        const formattedDate = formatDateForAPI(date);
        const url = API_BASE_URL
            .replace('{cinemaId}', sedeId)
            .replace('{fecha}', formattedDate);
        
        const response = await fetch(url);
        const data = await response.json();
        
        const movies = [];
        if (data.result && data.result['div[class*="col-12 col-md-6"]']) {
            const movieTexts = data.result['div[class*="col-12 col-md-6"]'];
            
            // Handle empty array case
            if (movieTexts.length === 0) {
                console.log(`No movies found for sede ${sedeId} on ${formattedDate}`);
                return movies;
            }
            
            for (const movieText of movieTexts) {
                const movie = parseMovieData(movieText, sedeId);
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

async function loadMovies(activeSedes, currentDate) {
    const movieData = {};
    
    try {
        const promises = Array.from(activeSedes).map(sedeId => 
            fetchMoviesForSede(sedeId, currentDate)
        );
        
        const results = await Promise.all(promises);
        
        results.forEach((movies, index) => {
            const sedeId = Array.from(activeSedes)[index];
            movieData[sedeId] = movies;
        });
        
        return movieData;
    } catch (error) {
        console.error('Error loading movies:', error);
        throw error;
    }
}