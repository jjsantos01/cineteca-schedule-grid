# Cartelera de la Cineteca Nacional - Vista en Grid

Una visualización alternativa de la cartelera de la Cineteca Nacional de México que permite ver fácilmente los horarios de todas las películas en un formato de cuadrícula temporal.

![Vista de la aplicación](img/Cineteca%20Nacional%20-%20Schedule%20Grid.png)

## Características

- 📅 Vista en cuadrícula temporal de todas las funciones del día en diferentes sedes
- 🎬 Información detallada de cada película
- ⚡ Indicador visual de traslapes de horarios al seleccionar una o varias películas
- 🔗 Enlaces directos a las páginas de las películas para comprar boletos
- 🗓️ Añade un recordatorio de la películas en tu calendario
- 🔍 Filtros por:
  - Nombre de película
  - Rango de horario
  - Sede (XOCO/CENART)
- 📱 Diseño responsivo
- 🤝 Función de compartir URL con filtros
- 🔄 Caché de datos para mejor rendimiento

## Desarrollo Local

### Prerrequisitos

- Un servidor web local (puede ser el Live Server de VS Code o cualquier otro)
- Un navegador moderno

### Instalación

1. Clona el repositorio:
```powershell
git clone https://github.com/jjsantos01/cineteca-schedule-grid.git
cd cineteca-schedule-grid
```

2. Abre el proyecto en VS Code:
```powershell
code .
```

3. Si usas VS Code, instala la extensión "Live Server"

4. Inicia el servidor local:
   - En VS Code: Click derecho en `index.html` -> "Open with Live Server"
   - O usa tu servidor web preferido apuntando al directorio del proyecto

### Estructura del Proyecto

```
├── index.html           # Página principal
├── css/
│   └── styles.css      # Estilos de la aplicación
├── js/
│   ├── api.js         # Funciones de la API
│   ├── app.js         # Lógica principal de la aplicación
│   ├── config.js      # Configuraciones y constantes
│   ├── grid.js        # Renderizado de la cuadrícula
│   ├── parser.js      # Parsing de datos
│   └── utils.js       # Funciones utilitarias
└── img/               # Imágenes del proyecto
```

## API

La aplicación consume datos de un worker de Cloudflare que sirve como proxy para la información pública de la Cineteca Nacional. El endpoint base es:

```
https://cinetk.jjsantosochoa.workers.dev/?cinemaId={cinemaId}&dia={fecha}
```

Donde:
- `cinemaId`: ID de la sede (002 para CENART, 003 para XOCO)
- `fecha`: Fecha en formato YYYY-MM-DD

## Contribuir

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Haz commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Descargo de Responsabilidad

Este es un proyecto independiente y no tiene relación oficial con la Cineteca Nacional. Solo utiliza su información pública para una mejor visualización.

## Autor

- **Juan Santos** - [jjsantos01](https://github.com/jjsantos01)
