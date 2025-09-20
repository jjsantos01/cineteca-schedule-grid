import state, { getCurrentMovieData } from './state.js';
import { timeToMinutes } from './utils.js';

export function findAllShowtimesForMovie(movieTitle, currentSedeId, currentSala, currentHorario) {
    const showtimes = [];

    for (const sedeId of state.activeSedes) {
        const sedeMovies = state.movieData[sedeId];
        if (!sedeMovies) continue;

        const matchingMovies = sedeMovies.filter(movie =>
            movie.titulo.toLowerCase() === movieTitle.toLowerCase()
        );

        for (const movie of matchingMovies) {
            for (const horario of movie.horarios) {
                if (sedeId === currentSedeId && movie.sala === currentSala && horario === currentHorario) {
                    continue;
                }

                showtimes.push({
                    sede: movie.sede,
                    sala: movie.sala,
                    horario,
                    sedeId,
                    salaCompleta: movie.salaCompleta
                });
            }
        }
    }

    showtimes.sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));
    return showtimes;
}

export function parseAllShowtimes(showtimesText) {
    if (!showtimesText) return [];

    const dayPattern = /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s+(\d+)\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/gi;
    const parts = showtimesText.split(dayPattern);
    const showtimes = [];

    for (let i = 1; i < parts.length; i += 5) {
        if (i + 4 >= parts.length) break;

        const dayName = parts[i];
        const day = parts[i + 1];
        const month = parts[i + 2];
        const year = parts[i + 3];
        const content = parts[i + 4];

        const dateStr = `${dayName} ${day} de ${month} de ${year}`;
        const salaMatches = content.matchAll(/SALA\s+(\d+)\s+(CNA|Xoco|CNCH):\s*((?:\d{1,2}:\d{2}(?:\s+|$|\n))+)/gi);

        for (const match of salaMatches) {
            const sala = match[1];
            let sede;
            if (match[2] === 'CNA') {
                sede = 'CENART';
            } else if (match[2] === 'XOCO') {
                sede = 'XOCO';
            } else if (match[2] === 'CNCH') {
                sede = 'CHAPULTEPEC';
            } else {
                sede = match[2];
            }

            const horariosBlock = match[3];
            const timePattern = /\d{1,2}:\d{2}/g;
            let timeMatch;

            while ((timeMatch = timePattern.exec(horariosBlock)) !== null) {
                const horario = timeMatch[0];
                showtimes.push({
                    date: dateStr,
                    sala,
                    sede,
                    horario
                });
            }
        }
    }

    const months = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    return showtimes.sort((a, b) => {
        const aDateParts = a.date.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);
        const bDateParts = b.date.match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/);

        const aDate = new Date(aDateParts[3], months[aDateParts[2]], aDateParts[1]);
        const bDate = new Date(bDateParts[3], months[bDateParts[2]], bDateParts[1]);

        if (aDate.getTime() !== bDate.getTime()) {
            return aDate.getTime() - bDate.getTime();
        }

        if (a.sede !== b.sede) {
            return a.sede.localeCompare(b.sede);
        }

        if (a.sala !== b.sala) {
            return parseInt(a.sala, 10) - parseInt(b.sala, 10);
        }

        return timeToMinutes(a.horario) - timeToMinutes(b.horario);
    });
}

export function buildMovieNavigationArray() {
    const movies = [];
    const currentData = getCurrentMovieData();

    for (const [, sedeMovies] of Object.entries(currentData)) {
        for (const movie of sedeMovies) {
            for (const horario of movie.horarios) {
                movies.push({
                    movie,
                    horario,
                    startMinutes: timeToMinutes(horario)
                });
            }
        }
    }

    movies.sort((a, b) => a.startMinutes - b.startMinutes);
    return movies;
}
