import { extractFilmId } from './utils.js';
import { formatMovieTitle } from './movieUtils.js';

export function parseMovieData(text, sedeId, href) {
    try {
        const cleanText = text.replace(/\s+/g, ' ').trim();
        const titleMatch = cleanText.match(/^(.+?)(?:\s+(DOB|SUB))?\s*\(/);
        const durationMatch = cleanText.match(/Dur\.\s*:\s*(\d+)\s*mins?\.\)/i);
        const salaMatch = cleanText.match(/SALA\s+(\d+)\s+(CNA|XOCO|CNCH)\s*:\s*(.+)$/i);
        const foroMatch = cleanText.match(/FORO AL AIRE LIBRE\s*:\s*(.+)$/i);

        if (!titleMatch || !durationMatch || (!salaMatch && !foroMatch)) {
            console.error('Failed to parse:', cleanText);
            return null;
        }

        const title = titleMatch[1].trim();
        const version = titleMatch[2] || '';
        const duration = parseInt(durationMatch[1]);
        let sala;
        let salaCompleta;
        let sedeCodigo;
        let horariosStr;
        let sede;

        if (salaMatch) {
            sala = salaMatch[1];
            sedeCodigo = salaMatch[2];
            horariosStr = salaMatch[3];
            salaCompleta = `SALA ${sala} ${sedeCodigo}`;
            const horarios = horariosStr.trim().split(/[\s\n]+/).filter(h => h.match(/^\d{1,2}:\d{2}$/));
            if (sedeCodigo === 'CNA') {
                sede = 'CENART';
            } else if (sedeCodigo === 'XOCO') {
                sede = 'XOCO';
            } else if (sedeCodigo === 'CNCH') {
                sede = 'CHAPULTEPEC';
            } else {
                sede = sedeCodigo;
            }
            return {
                titulo: title,
                tipoVersion: version,
                sala: sala,
                salaCompleta: salaCompleta,
                horarios: horarios,
                duracion: duration,
                sede: sede,
                sedeId: sedeId,
                sedeCodigo: sedeCodigo,
                href: href,
                // Propiedades enriquecidas
                filmId: extractFilmId(href),
                displayTitle: formatMovieTitle(title, version, true),
                _enrichedShowtimes: new Map()
            };
        } else if (foroMatch) {
            sala = 'FORO AL AIRE LIBRE';
            salaCompleta = 'FORO AL AIRE LIBRE';
            sedeCodigo = sedeId === '001' ? 'CNCH' : sedeId === '002' ? 'CNA' : sedeId === '003' ? 'XOCO' : sedeId;
            horariosStr = foroMatch[1];
            const horarios = horariosStr.trim().split(/[\s\n]+/).filter(h => h.match(/^\d{1,2}:\d{2}$/));
            if (sedeCodigo === 'CNA') {
                sede = 'CENART';
            } else if (sedeCodigo === 'XOCO') {
                sede = 'XOCO';
            } else if (sedeCodigo === 'CNCH') {
                sede = 'CHAPULTEPEC';
            } else {
                sede = sedeCodigo;
            }
            return {
                titulo: title,
                tipoVersion: version,
                sala: sala,
                salaCompleta: salaCompleta,
                horarios: horarios,
                duracion: duration,
                sede: sede,
                sedeId: sedeId,
                sedeCodigo: sedeCodigo,
                href: href,
                // Propiedades enriquecidas
                filmId: extractFilmId(href),
                displayTitle: formatMovieTitle(title, version, true),
                _enrichedShowtimes: new Map()
            };
        }
    } catch (error) {
        console.error('Error in parseMovieData:', error);
        return null;
    }

    return null;
}
