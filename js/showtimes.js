import state, { getCurrentMovieData } from './state.js';
import { timeToMinutes, formatDateForAPI } from './utils.js';
import { SEDES } from './config.js';

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
                    salaCompleta: movie.salaCompleta,
                    ticketUrl: movie.ticketUrls?.[horario] || null,
                    href: movie.href || null
                });
            }
        }
    }

    showtimes.sort((a, b) => timeToMinutes(a.horario) - timeToMinutes(b.horario));
    return showtimes;
}

/**
 * Obtiene todas las funciones futuras de una película a partir de los datos en memoria
 * (sin realizar llamados adicionales a la API).
 */
export function getFutureShowtimesForMovie(movie, explicitFilmId = null, minDate = null) {
    const filmId = explicitFilmId || movie?.filmId;
    const title = (movie?.titulo || '').trim().toLowerCase();
    const allSessions = [];

    // Helper para procesar una lista de películas
    function collectFromMovieList(movieList, fallbackSedeId = null) {
        if (!Array.isArray(movieList)) return;
        for (const m of movieList) {
            const matchesFilmId = filmId && m.filmId && m.filmId === filmId;
            const matchesTitle = title && m.titulo && m.titulo.trim().toLowerCase() === title;
            if (!matchesFilmId && !matchesTitle) continue;

            const finalSedeId = m.sedeId || fallbackSedeId || '003';
            if (Array.isArray(m.allShowtimes) && m.allShowtimes.length > 0) {
                for (const session of m.allShowtimes) {
                    allSessions.push({
                        ...session,
                        sedeId: session.sedeId || finalSedeId,
                        sede: session.sede || m.sede || (SEDES[finalSedeId]?.nombre || finalSedeId),
                        sedeCodigo: session.sedeCodigo || m.sedeCodigo || (SEDES[finalSedeId]?.codigo || finalSedeId)
                    });
                }
            } else if (Array.isArray(m.horarios) && m.horarios.length > 0) {
                const dateKey = formatDateForAPI(state.currentDate);
                for (const h of m.horarios) {
                    allSessions.push({
                        date: dateKey,
                        time: h,
                        displayTime: h,
                        ticketUrl: m.ticketUrls?.[h] || null,
                        sessionId: null,
                        sedeId: finalSedeId,
                        sede: m.sede || (SEDES[finalSedeId]?.nombre || finalSedeId),
                        sedeCodigo: m.sedeCodigo || (SEDES[finalSedeId]?.codigo || finalSedeId)
                    });
                }
            }
        }
    }

    // 1. Agregar sesiones de movie directamente si las tiene
    if (Array.isArray(movie?.allShowtimes)) {
        for (const session of movie.allShowtimes) {
            const sId = session.sedeId || movie.sedeId || '003';
            allSessions.push({
                ...session,
                sedeId: sId,
                sede: session.sede || movie.sede || (SEDES[sId]?.nombre || sId),
                sedeCodigo: session.sedeCodigo || movie.sedeCodigo || (SEDES[sId]?.codigo || sId)
            });
        }
    }

    // 2. Recorrer todas las sedes cargadas en el estado
    for (const [sedeId, sedeMovies] of Object.entries(state.movieData)) {
        collectFromMovieList(sedeMovies, sedeId);
    }

    // 3. Recorrer la caché si existen datos de otras sedes cargadas previamente
    if (state.cachedData && typeof state.cachedData === 'object') {
        for (const entries of Object.values(state.cachedData)) {
            if (!entries || typeof entries !== 'object') continue;
            for (const [sedeId, cacheEntry] of Object.entries(entries)) {
                if (cacheEntry?.data) {
                    collectFromMovieList(cacheEntry.data, sedeId);
                }
            }
        }
    }

    // Filtrar a partir de la fecha mínima de referencia si se especifica
    let filtered = allSessions;
    if (minDate) {
        const minDateStr = formatDateForAPI(minDate);
        filtered = allSessions.filter(s => s.date && s.date >= minDateStr);
    }

    // Deduplicar
    const seen = new Set();
    const uniqueSessions = [];
    for (const session of filtered) {
        const key = `${session.date}_${session.time}_${session.sedeId}_${session.sessionId || session.ticketUrl || ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueSessions.push(session);
        }
    }

    // Ordenar cronológicamente
    uniqueSessions.sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return a.time.localeCompare(b.time);
    });

    return uniqueSessions;
}

const SPANISH_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SPANISH_MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Agrupa las funciones por fecha y por sede para su renderizado en el modal
 */
export function groupShowtimesByDay(showtimes) {
    if (!Array.isArray(showtimes) || showtimes.length === 0) {
        return [];
    }

    const todayStr = formatDateForAPI(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDateForAPI(tomorrow);

    const dayMap = new Map();

    for (const st of showtimes) {
        const dateKey = st.date;
        if (!dayMap.has(dateKey)) {
            dayMap.set(dateKey, []);
        }
        dayMap.get(dateKey).push(st);
    }

    const result = [];

    for (const [dateKey, dayShowtimes] of dayMap.entries()) {
        const [yearStr, monthStr, dayStr] = dateKey.split('-');
        const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));

        const dayName = SPANISH_DAYS[dateObj.getDay()] || '';
        const monthName = SPANISH_MONTHS[dateObj.getMonth()] || '';
        const dayNum = parseInt(dayStr, 10);

        let dateLabel = `${dayName} ${dayNum} de ${monthName}`;
        let tag = null;

        if (dateKey === todayStr) {
            tag = 'Hoy';
            dateLabel = `Hoy · ${dayName} ${dayNum} de ${monthName}`;
        } else if (dateKey === tomorrowStr) {
            tag = 'Mañana';
            dateLabel = `Mañana · ${dayName} ${dayNum} de ${monthName}`;
        }

        // Agrupar por sede dentro del día
        const sedeMap = new Map();
        for (const st of dayShowtimes) {
            const sedeId = st.sedeId || '003';
            if (!sedeMap.has(sedeId)) {
                const sedeInfo = SEDES[sedeId] || {
                    nombre: st.sede || sedeId,
                    codigo: st.sedeCodigo || sedeId,
                    color: '#34495e'
                };
                sedeMap.set(sedeId, {
                    sedeId,
                    sedeNombre: sedeInfo.nombre,
                    sedeCodigo: sedeInfo.codigo,
                    color: sedeInfo.color,
                    showtimes: []
                });
            }
            sedeMap.get(sedeId).showtimes.push(st);
        }

        result.push({
            date: dateKey,
            dateLabel,
            tag,
            isToday: dateKey === todayStr,
            isTomorrow: dateKey === tomorrowStr,
            totalShowtimes: dayShowtimes.length,
            sedes: Array.from(sedeMap.values())
        });
    }

    return result;
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

