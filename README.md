# Cartelera de la Cineteca Nacional - Vista en Grid

Una visualización interactiva y alternativa de la cartelera de la Cineteca Nacional de México (sedes XOCO, CENART y Chapultepec) que permite consultar fácilmente los horarios de todas las películas en un formato de cuadrícula temporal, armar itinerarios y evitar traslapes de horario.

![Vista de la aplicación](img/Cineteca%20Nacional%20-%20Schedule%20Grid.png)

## Características Principales

- ❓ **Botón de Ayuda y Guía Integrada**: Botón siempre visible en la esquina superior derecha con el desglose de todas las funciones y atajos.
- 🚀 **Tour de Onboarding Interactivo**: Recorrido paso a paso para aprender a usar la herramienta rápidamente.
- 📅 **Selector de Fechas**: Navegación diaria y selección de fechas con hasta 7 días de anticipación.
- 🏛️ **Multi-sede Simultánea**: Visualiza y compara horarios de **XOCO**, **CENART** y **CHAPULTEPEC** en una misma pantalla.
- 🎬 **Carrusel de Pósters**: Explora visualmente las películas del día; haz clic en cualquier póster para aislar sus funciones en el grid.
- 📊 **Cuadrícula Temporal por Sala**: Línea de tiempo visual con la duración exacta de cada película y distribución por salas.
- ⚡ **Planificador de Itinerario con Detección de Traslapes**: Selecciona varias películas y el sistema alertará visualmente si hay empalmes de horarios.
- ℹ️ **Ficha Completa de Película**: Sinopsis, director, país, clasificación, reparto y tabla completa de funciones.
- 🎥 **Tráiler Integrado**: Reproducción del tráiler oficial directamente desde la aplicación vía YouTube.
- 🎟️ **Enlaces de Compra**: Acceso directo al sitio oficial de la Cineteca para comprar boletos.
- 🗓️ **Agregar a Calendario**: Descarga de archivo `.ics` compatible con Google Calendar, Apple Calendar y Outlook.
- 🎦 **Búsqueda Externa**: Accesos directos a Letterboxd, IMDb y Google.
- 🔍 **Filtros Inteligentes**: Búsqueda por título y rango de horario con bloqueo coordinado para evitar filtros conflictivos.
- 🔗 **Compartir Cartelera**: Copia una URL con tu selección exacta de fecha, sedes y filtros para enviársela a amigos.
- 📱 **Diseño 100% Responsivo**: Optimizado para móviles, tablets y computadoras de escritorio.

## Atajos de Teclado y Gestos

| Atajo | Acción |
| :--- | :--- |
| `?` o `F1` | Abrir la ventana de Ayuda y Guía de Uso |
| `Esc` | Cerrar ventanas modales, tooltips o tour |
| `←` / `→` | Navegar entre películas en la ficha técnica o avanzar/retroceder en el tour |
| `Doble clic` | En un bloque del grid para filtrar de inmediato por esa película |

## Desarrollo Local

### Prerrequisitos

- Un navegador web moderno.
- Un servidor web local sencillo (ej. extensión Live Server de VS Code, Python HTTP server, etc.).

### Ejecución

1. Clona el repositorio:
```bash
git clone https://github.com/jjsantos01/cineteca-schedule-grid.git
cd cineteca-schedule-grid
```

2. Inicia un servidor web local:
```bash
# Con Python:
python -m http.server 8000
```

3. Abre en tu navegador `http://localhost:8000/`.

## Descargo de Responsabilidad

Este es un proyecto independiente y no tiene relación oficial con la Cineteca Nacional. Utiliza su información pública para ofrecer una mejor experiencia visual a los usuarios.

## Autor

- **Juan Santos** - [jjsantos01](https://github.com/jjsantos01)
