// Initialize the map centered on Alaska
let map;
let hrrrImageLayer = null;
let currentPlotType = 'cref_full_sfc';

// Alaska HRRR grid geographic bounds (lat/lon)
// Based on polar stereographic projection bounds
const HRRR_BOUNDS = {
    south: 41.61,
    north: 76.35,
    west: -174.9,
    east: -115.8
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
        color: '#1e3c72',
        weight: 2,
        fillOpacity: 0,
        dashArray: '5, 10'
    }).addTo(map).bindPopup('<strong>Alaska HRRR Grid Boundary</strong><br>3 km resolution<br>919 x 1299 grid points');
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

// Construct HRRR image URL
function getHRRRImageURL(plotType, runtime, forecast = '000') {
    // NOAA Alaska HRRR graphics URL pattern
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

// Create a CORS proxy URL
function getCORSProxyURL(url) {
    // Using allOrigins as CORS proxy
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
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

        // Get image URL for 0-hour forecast (analysis)
        const imageURL = getHRRRImageURL(currentPlotType, runtime, '000');

        // For direct image display, we'll use a proxy to handle CORS
        // Note: This may not work for all plot types due to how NOAA serves the images
        // The images are actually generated dynamically by a CGI script

        // Since the NOAA images are served via CGI and may have CORS issues,
        // we'll create an iframe approach or use a different method

        // For now, let's create a workaround by displaying the image with proper bounds
        const proxyURL = getCORSProxyURL(imageURL);

        // Define the geographic bounds for the image overlay
        const imageBounds = [
            [HRRR_BOUNDS.south, HRRR_BOUNDS.west],  // Southwest corner
            [HRRR_BOUNDS.north, HRRR_BOUNDS.east]   // Northeast corner
        ];

        // Create image overlay
        hrrrImageLayer = L.imageOverlay(proxyURL, imageBounds, {
            opacity: 0.7,
            interactive: true,
            errorOverlayUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E',
            alt: `HRRR Alaska ${currentPlotType} - ${runtime}`,
            className: 'hrrr-image-layer'
        });

        hrrrImageLayer.on('load', function() {
            updateStatus(`HRRR imagery loaded - Runtime: ${runtime} UTC`, false);
            updateInfoPanel(runtime, currentPlotType);
        });

        hrrrImageLayer.on('error', function(e) {
            console.error('Error loading HRRR image:', e);
            // Try alternative approach: open in new layer or provide link
            updateStatus('Image load failed. Showing link instead.', false);
            showImageLink(imageURL, runtime);
        });

        hrrrImageLayer.addTo(map);

        // Fit map to HRRR bounds
        map.fitBounds(imageBounds);

    } catch (error) {
        console.error('Error loading HRRR data:', error);
        updateStatus('Error loading imagery. See console for details.', false);
    }
}

// Show a link to the image if direct loading fails
function showImageLink(url, runtime) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>HRRR Image Link</h4>
        <p>Direct image loading encountered CORS restrictions.</p>
        <p><strong>Runtime:</strong> ${runtime} UTC</p>
        <p><strong>Plot Type:</strong> ${getPlotTypeLabel(currentPlotType)}</p>
        <p><a href="${url}" target="_blank" class="image-link">Open HRRR Image in New Tab</a></p>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
            Note: The image is served by NOAA's CGI script and may have CORS restrictions.
            You can view it directly by clicking the link above.
        </p>
    `;
}

// Update info panel with current imagery details
function updateInfoPanel(runtime, plotType) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>Current Imagery</h4>
        <p><strong>Runtime:</strong> ${runtime} UTC</p>
        <p><strong>Forecast Hour:</strong> 000 (Analysis)</p>
        <p><strong>Plot Type:</strong> ${getPlotTypeLabel(plotType)}</p>
        <p><strong>Grid:</strong> 919 x 1299 points</p>
        <p><strong>Resolution:</strong> 3 km</p>
        <p><strong>Projection:</strong> Polar Stereographic</p>
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

// Add CSS for image links
const style = document.createElement('style');
style.textContent = `
    .hrrr-image-layer {
        pointer-events: auto;
    }
    .image-link {
        color: #1e3c72;
        text-decoration: none;
        font-weight: bold;
        padding: 8px 12px;
        background-color: #f0f0f0;
        border-radius: 4px;
        display: inline-block;
        margin-top: 10px;
        transition: background-color 0.3s;
    }
    .image-link:hover {
        background-color: #e0e0e0;
    }
`;
document.head.appendChild(style);
