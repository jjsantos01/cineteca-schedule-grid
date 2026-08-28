import { extractFilmId } from './utils.js';
import { formatMovieTitle } from './movieUtils.js';

export function parseMovieData(textOrItem, sedeId, href, ticketUrls = {}) {
    try {
        if (typeof textOrItem === 'object' && textOrItem !== null) {
            const item = textOrItem;
            const finalSedeId = item.sedeId || sedeId;
            const itemHref = item.href || href;
            const filmId = item.filmId || extractFilmId(itemHref);
            const title = item.titulo || '';
            const version = item.tipoVersion || '';
            const duracion = typeof item.duracion === 'number' ? item.duracion : parseInt(item.duracion, 10) || 90;
            const sala = String(item.sala || '1');
            const sedeCodigo = item.sedeCodigo || (finalSedeId === '001' ? 'CNCH' : finalSedeId === '002' ? 'CNA' : 'XOCO');
            const salaCompleta = item.salaCompleta || (sala.includes('FORO') ? sala : `SALA ${sala} ${sedeCodigo}`);
            const horarios = Array.isArray(item.horarios) ? item.horarios : [];
            const sede = item.sede || (finalSedeId === '001' ? 'CHAPULTEPEC' : finalSedeId === '002' ? 'CENART' : 'XOCO');
            const itemTicketUrls = item.ticketUrls || (Array.isArray(item.sessions) ? Object.fromEntries(item.sessions.filter(s => s.time && s.ticketUrl).map(s => [s.time, s.ticketUrl])) : ticketUrls) || {};

            if (title && horarios.length > 0 && duracion) {
                return {
                    titulo: title,
                    tipoVersion: version,
                    sala: sala,
                    salaCompleta: salaCompleta,
                    horarios: horarios,
                    duracion: duracion,
                    sede: sede,
                    sedeId: finalSedeId,
                    sedeCodigo: sedeCodigo,
                    href: itemHref,
                    ticketUrls: itemTicketUrls,
                    filmId: filmId,
                    posterUrl: item.posterUrl,
                    displayTitle: formatMovieTitle(title, version, true),
                    _enrichedShowtimes: new Map()
                };
            }
        }

        const text = typeof textOrItem === 'string' ? textOrItem : textOrItem?.text;
        if (!text) return null;

        const cleanText = text.replace(/\s+/g, ' ').trim();
        const titleMatch = cleanText.match(/^(.+?)(?:\s+(DOB|SUB))?\s*\(/);
        const durationMatch = cleanText.match(/Dur\.\s*:\s*(\d+)\s*mins?\.\)/i);
        const salaMatch = cleanText.match(/SALA\s+(\d+)\s+(CNA|XOCO|CNCH)\s*:\s*(.+)$/i);
        const foroMatch = cleanText.match(/FORO AL AIRE LIBRE\s*:\s*(.+)$/i);

        if (!salaMatch && !foroMatch) {
            console.error('Failed to parse:', cleanText);
            return null;
        }

        let title = '';
        let version = '';
        let duration = 90;

        if (titleMatch) {
            title = titleMatch[1].trim();
            version = titleMatch[2] || '';
        } else {
            const eventTitleMatch = cleanText.match(/^(.+?)(?:\s+(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo|\d{1,2}\s+de\s+[a-z]+|SALA|FORO))/i);
            title = eventTitleMatch ? eventTitleMatch[1].trim() : cleanText.split(/SALA|FORO/)[0].trim();
        }

        if (durationMatch) {
            duration = parseInt(durationMatch[1], 10);
        }
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
                ticketUrls: ticketUrls || {},
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
                ticketUrls: ticketUrls || {},
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
