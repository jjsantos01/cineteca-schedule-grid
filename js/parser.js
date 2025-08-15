// Data parsing functions
function parseMovieData(text, sedeId, href) {
    try {
        // Clean up the text first - normalize whitespace
        const cleanText = text.replace(/\s+/g, ' ').trim();
        
        // Improved regex patterns with more flexible matching
        const titleMatch = cleanText.match(/^(.+?)(?:\s+(DOB|SUB))?\s*\(/);
        const durationMatch = cleanText.match(/Dur\.\s*:\s*(\d+)\s*mins?\.\)/i);
        const salaMatch = cleanText.match(/SALA\s+(\d+)\s+(CNA|XOCO|CNCH)\s*:\s*(.+)$/i);
        
        if (!titleMatch || !durationMatch || !salaMatch) {
            console.error('Failed to parse:', cleanText);
            return null;
        }
        
        const title = titleMatch[1].trim();
        const version = titleMatch[2] || '';
        const duration = parseInt(durationMatch[1]);
        const sala = salaMatch[1];
        const sedeCodigo = salaMatch[2];
        const horariosStr = salaMatch[3];
        
        // Parse horarios - handle various whitespace formats
        const horarios = horariosStr.trim().split(/[\s\n]+/).filter(h => h.match(/^\d{1,2}:\d{2}$/));
        let sede;
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
            salaCompleta: `SALA ${sala} ${sedeCodigo}`,
            horarios: horarios,
            duracion: duration,
            sede: sede,
            sedeId: sedeId,
            sedeCodigo: sedeCodigo,
            href: href
        };
    } catch (error) {
        console.error('Error in parseMovieData:', error);
        return null;
    }
}