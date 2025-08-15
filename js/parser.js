// Data parsing functions
function parseMovieData(text, sedeId, href) {
    try {
        // Clean up the text first - normalize whitespace
        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        // Improved regex patterns with more flexible matching
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
        let sala, salaCompleta, sedeCodigo, horariosStr, sede;

        if (salaMatch) {
            sala = salaMatch[1];
            sedeCodigo = salaMatch[2];
            horariosStr = salaMatch[3];
            salaCompleta = `SALA ${sala} ${sedeCodigo}`;
            // Parse horarios - handle various whitespace formats
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
                href: href
            };
        } else if (foroMatch) {
            sala = 'FORO AL AIRE LIBRE';
            salaCompleta = 'FORO AL AIRE LIBRE';
            sedeCodigo = sedeId === '001' ? 'CNCH' : sedeId === '002' ? 'CNA' : sedeId === '003' ? 'XOCO' : sedeId;
            horariosStr = foroMatch[1];
            // Parse horarios - handle various whitespace formats
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
                href: href
            };
        }
    } catch (error) {
        console.error('Error in parseMovieData:', error);
        return null;
    }
}