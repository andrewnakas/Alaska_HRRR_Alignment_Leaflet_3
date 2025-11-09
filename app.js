// Initialize the map centered on Alaska
let map;
let hrrrImageLayer = null;
let currentPlotType = 'cref_full_sfc';

// Alaska HRRR grid geographic bounds (lat/lon)
// These are the APPROXIMATE bounds - polar stereographic to Web Mercator has distortion
const HRRR_BOUNDS = {
    south: 40.0,  // Adjusted for better visual alignment
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

    updateStatus('Map initialized. Select a plot type and click "Load HRRR 0-Hour Imagery".');
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
    }).addTo(map).bindPopup('<strong>Alaska HRRR Image Bounds</strong><br>919 x 1299 grid points<br>3 km resolution<br><br>RED boundary = Image overlay area<br><br>Note: Polar stereographic to Web Mercator projection causes some distortion');
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
    // HRRR runs are hourly, go back 2 hours to ensure data is available
    now.setHours(now.getHours() - 2);

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hour = String(now.getUTCHours()).padStart(2, '0');

    return `${year}${month}${day}${hour}`;
}

// Get the direct PNG image URL from NOAA GSL
function getDirectImageURL(plotType, runtime, forecast = '000') {
    // Direct PNG image pattern from NOAA GSL
    const baseURL = 'https://gsl.noaa.gov/for_web/hrrrak_ncep_jet/';
    const forecastStr = forecast.padStart(3, '0');
    return `${baseURL}${runtime}/full/${plotType}_f${forecastStr}.png`;
}

// Construct NOAA page URL for reference
function getNOAAPageURL(plotType, runtime, forecast = '000') {
    const baseURL = 'https://rapidrefresh.noaa.gov/alaska/';
    const params = new URLSearchParams({
        keys: 'hrrrak_ncep_jet:',
        runtime: runtime,
        plot_type: plotType,
        fcst: forecast,
        time_inc: '60',
        num_times: '49',
        model: 'hrrr',
        ptitle: 'Alaska Model Graphics',
        maxFcstLen: '48',
        fcstStrLen: '-1',
        domain: 'full:hrrrak',
        adtfn: '1'
    });
    return `${baseURL}displayMapUpdated.cgi?${params.toString()}`;
}

// Load and display HRRR data on the map
async function loadHRRRData() {
    try {
        updateStatus('Loading HRRR 0-hour imagery...', true);

        // Clear existing imagery
        if (hrrrImageLayer) {
            map.removeLayer(hrrrImageLayer);
        }

        // Get latest run time
        const runtime = getLatestRunTime();

        // Get direct image URL
        const imageURL = getDirectImageURL(currentPlotType, runtime, '000');
        const noaaPageURL = getNOAAPageURL(currentPlotType, runtime, '000');

        console.log('Loading HRRR image:', imageURL);

        // Define the geographic bounds for the image overlay
        const imageBounds = [
            [HRRR_BOUNDS.south, HRRR_BOUNDS.west],  // Southwest corner
            [HRRR_BOUNDS.north, HRRR_BOUNDS.east]   // Northeast corner
        ];

        // Create image overlay with the direct PNG
        hrrrImageLayer = L.imageOverlay(imageURL, imageBounds, {
            opacity: 0.8,
            interactive: false,
            alt: `HRRR Alaska ${currentPlotType} - ${runtime}`,
            className: 'hrrr-image-layer',
            crossOrigin: 'anonymous'
        });

        hrrrImageLayer.on('load', function() {
            updateStatus(`HRRR imagery loaded - Runtime: ${runtime} UTC`, false);
            updateInfoPanel(runtime, currentPlotType, imageURL, noaaPageURL);
            console.log('HRRR image loaded successfully');
        });

        hrrrImageLayer.on('error', function(e) {
            console.error('Error loading HRRR image:', e);
            updateStatus('Image failed to load. Opening NOAA page...', false);
            window.open(noaaPageURL, '_blank');
            showImageError(runtime, noaaPageURL);
        });

        hrrrImageLayer.addTo(map);

        // Fit map to HRRR bounds
        map.fitBounds(imageBounds);

    } catch (error) {
        console.error('Error loading HRRR data:', error);
        updateStatus('Error loading imagery. See console for details.', false);
    }
}

// Show error message with link
function showImageError(runtime, noaaPageURL) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>Image Loading Error</h4>
        <p>The HRRR image could not be loaded directly.</p>
        <p><strong>Runtime:</strong> ${runtime} UTC</p>
        <p style="margin-top: 10px;">
            <a href="${noaaPageURL}" target="_blank" class="image-link">View on NOAA Website</a>
        </p>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
            The RED boundary shows the approximate HRRR grid coverage area.
        </p>
    `;
}

// Update info panel with current imagery details
function updateInfoPanel(runtime, plotType, imageURL, noaaPageURL) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>HRRR Imagery Loaded</h4>
        <p><strong>Runtime:</strong> ${runtime} UTC</p>
        <p><strong>Forecast Hour:</strong> 000 (Analysis)</p>
        <p><strong>Plot Type:</strong> ${getPlotTypeLabel(plotType)}</p>
        <p><strong>Grid:</strong> 919 x 1299 points</p>
        <p><strong>Resolution:</strong> 3 km</p>
        <p><strong>Projection:</strong> Polar Stereographic</p>
        <hr style="margin: 15px 0;">
        <p style="font-size: 12px; color: #666;">
            <strong style="color: #ff0000;">RED boundary</strong> = Image overlay area<br><br>
            <strong>Note:</strong> The HRRR image uses Polar Stereographic projection.
            When overlaid on this Web Mercator map, some distortion occurs, especially
            at the edges. The image includes NOAA's map background which helps verify alignment.
        </p>
        <div style="margin-top: 15px;">
            <a href="${noaaPageURL}" target="_blank" class="image-link">View on NOAA Website</a>
        </div>
        <div style="margin-top: 10px;">
            <a href="${imageURL}" target="_blank" class="image-link">Direct Image Link</a>
        </div>
    `;
}

// Get readable label for plot type
function getPlotTypeLabel(plotType) {
    const labels = {
        'cref_full_sfc': 'Composite Reflectivity',
        '1ref_full_1000m': '1 km AGL Reflectivity',
        'mref_full_sfc': 'Max 1km Reflectivity',
        'allfields': 'All Fields'
    };
    return labels[plotType] || plotType;
}

// Clear HRRR imagery from the map
function clearHRRRData() {
    if (hrrrImageLayer) {
        map.removeLayer(hrrrImageLayer);
        hrrrImageLayer = null;
    }
    document.getElementById('point-info').innerHTML = '';
    updateStatus('Imagery cleared', false);
}

// Add CSS for UI elements
const style = document.createElement('style');
style.textContent = `
    .hrrr-image-layer {
        pointer-events: none;
    }

    .image-link {
        display: inline-block;
        background: #1e3c72;
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.3s;
        text-align: center;
    }

    .image-link:hover {
        background: #2a5298;
    }

    hr {
        border: none;
        border-top: 1px solid #eee;
    }
`;
document.head.appendChild(style);
