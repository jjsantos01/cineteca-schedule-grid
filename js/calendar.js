export function generateCalendarLink(movie, horario, date) {
    const startDate = new Date(date);
    const [hours, minutes] = horario.split(':').map(Number);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + movie.duracion);

    const formatDateForCalendar = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const second = String(d.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}T${hour}${minute}${second}`;
    };

    const startFormatted = formatDateForCalendar(startDate);
    const endFormatted = formatDateForCalendar(endDate);

    const eventTitle = `Cineteca: ${movie.titulo} ${movie.tipoVersion || ''}`;
    const eventDescription = `Película en Cineteca Nacional\nSala: ${movie.salaCompleta}\nDuración: ${movie.duracion} minutos`;
    const eventLocation = `Cineteca Nacional - ${movie.sede}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startFormatted}/${endFormatted}&details=${encodeURIComponent(eventDescription)}&location=${encodeURIComponent(eventLocation)}&ctz=America/Mexico_City`;
}
