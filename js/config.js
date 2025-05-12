// Configuration constants
const SEDES = {
    "002": {
        nombre: "CENART",
        codigo: "CNA",
        color: "#3498DB",
        className: "cenart"
    },
    "003": {
        nombre: "XOCO",
        codigo: "XOCO",
        color: "#2ECC71",
        className: "xoco"
    }
};

const START_HOUR = 13;
const END_HOUR = 21;
const HOUR_WIDTH = 120; // pixels per hour

const API_BASE_URL = 'https://web.scraper.workers.dev/?url=https%3A%2F%2Fwww.cinetecanacional.net%2Fsedes%2Fcartelera.php%3FcinemaId%3D{cinemaId}%26dia%3D{fecha}%23gsc.tab%3D0&selector=div%5Bclass*%3D%22col-12+col-md-6%22%5D+&scrape=text&pretty=true';