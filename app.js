// Import GRIB2 parser
import Grib2class from 'https://cdn.skypack.dev/grib2class@1.0.7';

// Initialize the map centered on Alaska
let map;
let hrrrCanvasLayer = null;
let currentPlotType = 'REFC';

// Alaska HRRR grid geographic bounds
// These bounds are approximate - HRRR uses Lambert Conformal projection
const HRRR_BOUNDS = {
    south: 40.0,
    north: 72.5,
    west: -180.0,
    east: -110.0
};

// Alaska center coordinates
const ALASKA_CENTER = [64.0685, -152.2782];
const ALASKA_ZOOM = 5;

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupEventListeners();
});

function initMap() {
    // Create the map with standard Web Mercator projection
    map = L.map('map').setView(ALASKA_CENTER, ALASKA_ZOOM);

    // Add OpenStreetMap tile layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Add Esri World Imagery layer
    const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    // Add Esri Topo layer
    const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
        maxZoom: 19
    });

    // Add layer control
    const baseMaps = {
        "Street Map": osmLayer,
        "Satellite": esriImagery,
        "Topographic": esriTopo
    };

    L.control.layers(baseMaps).addTo(map);

    // Add scale control
    L.control.scale({
        imperial: true,
        metric: true
    }).addTo(map);

    // Draw Alaska HRRR grid boundary
    drawGridBoundary();

    updateStatus('Map initialized. Click "Load HRRR 0-Hour Data" to fetch composite reflectivity.');
}

function drawGridBoundary() {
    // Draw a rectangle showing the HRRR grid bounds
    const bounds = [
        [HRRR_BOUNDS.south, HRRR_BOUNDS.west],
        [HRRR_BOUNDS.north, HRRR_BOUNDS.east]
    ];

    L.rectangle(bounds, {
        color: '#ff0000',
        weight: 3,
        fillOpacity: 0,
        dashArray: '10, 5',
        opacity: 0.8
    }).addTo(map).bindPopup('<strong>Alaska HRRR Grid Bounds</strong><br>919 x 1299 grid points<br>3 km resolution<br><br>RED boundary = Approximate data coverage<br><br>Note: HRRR uses Lambert Conformal projection');
}

function setupEventListeners() {
    document.getElementById('loadDataBtn').addEventListener('click', loadHRRRData);
    document.getElementById('clearDataBtn').addEventListener('click', clearHRRRData);
    document.getElementById('plotTypeSelect').addEventListener('change', function(e) {
        currentPlotType = e.target.value;
    });
}

function updateStatus(message, isLoading = false) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    if (isLoading) {
        statusEl.classList.add('loading');
    } else {
        statusEl.classList.remove('loading');
    }
}

// Get the latest HRRR run time
function getLatestRunTime() {
    const now = new Date();
    // HRRR runs are hourly, go back 3 hours to ensure data is available
    const timeMs = now.getTime() - (3 * 60 * 60 * 1000); // Subtract 3 hours in milliseconds
    const targetDate = new Date(timeMs);

    const year = targetDate.getUTCFullYear();
    const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getUTCDate()).padStart(2, '0');
    const hour = String(targetDate.getUTCHours()).padStart(2, '0');

    return {
        dateString: `${year}${month}${day}`,
        hourString: hour,
        displayString: `${year}-${month}-${day} ${hour}:00 UTC`
    };
}

// Construct AWS S3 URL for HRRR Alaska GRIB2 file
function getHRRRGribURL(variable, runtime, forecast = '00') {
    const { dateString, hourString } = runtime;

    // AWS S3 bucket structure for HRRR Alaska
    // https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.YYYYMMDD/alaska/hrrr.tHHz.wrfsfcfFF.ak.grib2
    const baseURL = 'https://noaa-hrrr-bdp-pds.s3.amazonaws.com';
    const forecastPadded = forecast.padStart(2, '0');
    const file = `hrrr.t${hourString}z.wrfsfcf${forecastPadded}.ak.grib2`;
    const path = `hrrr.${dateString}/alaska/${file}`;

    return `${baseURL}/${path}`;
}

// Color scale for composite reflectivity (dBZ)
function getReflectivityColor(dbz) {
    if (dbz < 5) return [0, 0, 0, 0]; // Transparent for no echo
    if (dbz < 15) return [4, 233, 231, 180]; // Light blue
    if (dbz < 25) return [1, 159, 244, 200]; // Medium blue
    if (dbz < 35) return [3, 0, 244, 220]; // Dark blue
    if (dbz < 45) return [2, 253, 2, 230]; // Green
    if (dbz < 50) return [1, 197, 1, 240]; // Dark green
    if (dbz < 55) return [0, 142, 0, 250]; // Darker green
    if (dbz < 60) return [253, 248, 2, 255]; // Yellow
    if (dbz < 65) return [229, 188, 0, 255]; // Orange-yellow
    if (dbz < 70) return [253, 139, 0, 255]; // Orange
    if (dbz < 75) return [212, 0, 0, 255]; // Red
    return [255, 0, 255, 255]; // Magenta for very high values
}

// Load and display HRRR data on the map
async function loadHRRRData() {
    try {
        updateStatus('Fetching HRRR GRIB2 data from AWS...', true);

        // Clear existing layer
        if (hrrrCanvasLayer) {
            map.removeLayer(hrrrCanvasLayer);
        }

        // Get latest run time
        const runtime = getLatestRunTime();
        console.log('Fetching HRRR data for:', runtime.displayString);

        // Construct GRIB URL
        const gribURL = getHRRRGribURL(currentPlotType, runtime);
        console.log('GRIB URL:', gribURL);

        // Fetch GRIB2 data
        updateStatus('Downloading GRIB2 file...', true);
        const response = await fetch(gribURL, {
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('Downloaded GRIB2 file:', arrayBuffer.byteLength, 'bytes');

        // Parse GRIB2 data
        updateStatus('Parsing GRIB2 data...', true);
        const grib = new Grib2class(arrayBuffer);
        console.log('GRIB2 parsed, messages:', grib.messages.length);

        if (grib.messages.length === 0) {
            throw new Error('No GRIB messages found in file');
        }

        // Get the first message (should be our REFC data)
        const message = grib.messages[0];
        console.log('Message info:', {
            parameter: message.parameter,
            level: message.level,
            nx: message.nx,
            ny: message.ny,
            la1: message.la1,
            lo1: message.lo1,
            la2: message.la2,
            lo2: message.lo2
        });

        // Get grid data
        const gridData = message.getData();
        console.log('Grid data points:', gridData.length);

        // Get grid dimensions and bounds from GRIB metadata
        const nx = message.nx; // Number of points along x-axis
        const ny = message.ny; // Number of points along y-axis

        // Get geographic bounds from GRIB
        // la1, lo1 = first grid point (usually upper-left)
        // la2, lo2 = last grid point (usually lower-right)
        const lat1 = message.la1 / 1e6; // Convert from microdegrees
        const lon1 = message.lo1 / 1e6;
        const lat2 = message.la2 / 1e6;
        const lon2 = message.lo2 / 1e6;

        // Adjust longitudes if needed (GRIB uses 0-360 sometimes)
        const west = lon1 > 180 ? lon1 - 360 : lon1;
        const east = lon2 > 180 ? lon2 - 360 : lon2;
        const north = Math.max(lat1, lat2);
        const south = Math.min(lat1, lat2);

        console.log('Grid bounds:', { north, south, east, west });
        console.log('Grid dimensions:', { nx, ny });

        // Create canvas overlay
        updateStatus('Rendering data on map...', true);
        hrrrCanvasLayer = createCanvasOverlay(gridData, nx, ny, north, south, east, west);
        hrrrCanvasLayer.addTo(map);

        // Fit map to data bounds
        map.fitBounds([[south, west], [north, east]]);

        updateStatus(`HRRR data loaded - ${runtime.displayString}`, false);
        updateInfoPanel(runtime, currentPlotType, nx, ny);

    } catch (error) {
        console.error('Error loading HRRR data:', error);
        updateStatus(`Error: ${error.message}`, false);
        showErrorInfo(error);
    }
}

// Create a canvas overlay for the GRIB data
function createCanvasOverlay(data, nx, ny, north, south, east, west) {
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.width = nx;
    canvas.height = ny;
    const ctx = canvas.getContext('2d');

    // Create image data
    const imageData = ctx.createImageData(nx, ny);

    // Fill canvas with colored pixels based on reflectivity values
    for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
            const idx = y * nx + x;
            const value = data[idx];

            // Get color for this value
            const [r, g, b, a] = getReflectivityColor(value);

            // Set pixel color
            const pixelIdx = (y * nx + x) * 4;
            imageData.data[pixelIdx] = r;
            imageData.data[pixelIdx + 1] = g;
            imageData.data[pixelIdx + 2] = b;
            imageData.data[pixelIdx + 3] = a;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    // Create Leaflet image overlay with the canvas
    const bounds = [[south, west], [north, east]];
    const overlay = L.imageOverlay(canvas.toDataURL(), bounds, {
        opacity: 0.7,
        interactive: false,
        className: 'hrrr-canvas-layer'
    });

    return overlay;
}

// Update info panel with current data details
function updateInfoPanel(runtime, variable, nx, ny) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>HRRR Data Loaded</h4>
        <p><strong>Runtime:</strong> ${runtime.displayString}</p>
        <p><strong>Forecast Hour:</strong> 000 (Analysis)</p>
        <p><strong>Variable:</strong> ${getVariableLabel(variable)}</p>
        <p><strong>Grid:</strong> ${nx} x ${ny} points</p>
        <p><strong>Resolution:</strong> 3 km</p>
        <p><strong>Source:</strong> NOAA AWS S3 (noaa-hrrr-bdp-pds)</p>
        <hr style="margin: 15px 0;">
        <p style="font-size: 12px; color: #666;">
            <strong style="color: #ff0000;">RED boundary</strong> = Approximate coverage area<br><br>
            <strong>Note:</strong> HRRR uses Lambert Conformal projection.
            Some distortion may occur when displayed on Web Mercator map.
        </p>
        <h4 style="margin-top: 15px;">Reflectivity Scale (dBZ)</h4>
        <div style="font-size: 11px; line-height: 1.8;">
            <div style="background: rgb(4, 233, 231); padding: 3px;">5-15: Light</div>
            <div style="background: rgb(1, 159, 244); padding: 3px;">15-25: Moderate</div>
            <div style="background: rgb(3, 0, 244); color: white; padding: 3px;">25-35: Heavy</div>
            <div style="background: rgb(2, 253, 2); padding: 3px;">35-50: Very Heavy</div>
            <div style="background: rgb(253, 248, 2); padding: 3px;">50-60: Severe</div>
            <div style="background: rgb(253, 139, 0); padding: 3px;">60-70: Extreme</div>
            <div style="background: rgb(212, 0, 0); color: white; padding: 3px;">70+: Intense</div>
        </div>
    `;
}

// Get readable label for variable
function getVariableLabel(variable) {
    const labels = {
        'REFC': 'Composite Reflectivity',
        'REFD': 'Reflectivity',
        'TEMP': 'Temperature',
        'UGRD': 'U-Component Wind',
        'VGRD': 'V-Component Wind'
    };
    return labels[variable] || variable;
}

// Show error information
function showErrorInfo(error) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>Error Loading Data</h4>
        <p style="color: #d00;">${error.message}</p>
        <hr style="margin: 15px 0;">
        <h4>Troubleshooting</h4>
        <p style="font-size: 12px;">
            Common issues:<br>
            • Data not yet available for selected time<br>
            • Network connectivity issues<br>
            • Invalid GRIB2 format<br>
            • File not found on AWS S3
        </p>
        <p style="font-size: 12px; margin-top: 10px;">
            HRRR data is fetched from NOAA's AWS S3 bucket. Data is typically available
            within 1-2 hours of the model run time.
        </p>
    `;
}

// Clear HRRR data from the map
function clearHRRRData() {
    if (hrrrCanvasLayer) {
        map.removeLayer(hrrrCanvasLayer);
        hrrrCanvasLayer = null;
    }
    document.getElementById('point-info').innerHTML = '';
    updateStatus('Data cleared', false);
}

// Add CSS for UI elements
const style = document.createElement('style');
style.textContent = `
    .hrrr-canvas-layer {
        pointer-events: none;
    }

    hr {
        border: none;
        border-top: 1px solid #eee;
    }
`;
document.head.appendChild(style);
