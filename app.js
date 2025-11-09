// Initialize the map centered on Alaska
let map;
let hrrrImageLayer = null;
let currentPlotType = 'cref_full_sfc';
let imageWindow = null;

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

// Try multiple CORS proxies
async function tryLoadImageWithProxies(imageURL) {
    const proxies = [
        // Try direct first
        null,
        // Fallback proxies
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];

    for (let i = 0; i < proxies.length; i++) {
        const proxyFn = proxies[i];
        const urlToTry = proxyFn ? proxyFn(imageURL) : imageURL;

        try {
            // Test if image loads
            const testImg = new Image();
            const loadPromise = new Promise((resolve, reject) => {
                testImg.onload = () => resolve(urlToTry);
                testImg.onerror = () => reject();
                setTimeout(() => reject(), 5000); // 5 second timeout
            });
            testImg.src = urlToTry;

            const successUrl = await loadPromise;
            console.log(`Image loaded successfully with ${proxyFn ? 'proxy' : 'direct'} method`);
            return successUrl;
        } catch (e) {
            console.log(`Failed with ${proxyFn ? 'proxy' : 'direct'} method, trying next...`);
            continue;
        }
    }

    return null;
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

        // Define the geographic bounds for the image overlay
        const imageBounds = [
            [HRRR_BOUNDS.south, HRRR_BOUNDS.west],  // Southwest corner
            [HRRR_BOUNDS.north, HRRR_BOUNDS.east]   // Northeast corner
        ];

        // Try to load image with various methods
        updateStatus('Attempting to load imagery...', true);
        const workingURL = await tryLoadImageWithProxies(imageURL);

        if (workingURL) {
            // Successfully found a working URL
            hrrrImageLayer = L.imageOverlay(workingURL, imageBounds, {
                opacity: 0.7,
                interactive: true,
                alt: `HRRR Alaska ${currentPlotType} - ${runtime}`,
                className: 'hrrr-image-layer'
            });

            hrrrImageLayer.on('load', function() {
                updateStatus(`HRRR imagery loaded - Runtime: ${runtime} UTC`, false);
                updateInfoPanel(runtime, currentPlotType);
            });

            hrrrImageLayer.on('error', function(e) {
                console.error('Error displaying HRRR image:', e);
                updateStatus('Image display failed. Opening in new window...', false);
                showImageInNewWindow(imageURL, runtime);
            });

            hrrrImageLayer.addTo(map);
            map.fitBounds(imageBounds);
        } else {
            // All methods failed, show alternative view
            updateStatus('Direct image loading not available. Opening in new window...', false);
            showImageInNewWindow(imageURL, runtime);
            updateInfoPanel(runtime, currentPlotType);
        }

    } catch (error) {
        console.error('Error loading HRRR data:', error);
        updateStatus('Error loading imagery. See alternative view.', false);
        const runtime = getLatestRunTime();
        const imageURL = getHRRRImageURL(currentPlotType, runtime, '000');
        showImageInNewWindow(imageURL, runtime);
    }
}

// Show HRRR image in a new window
function showImageInNewWindow(url, runtime) {
    const infoDiv = document.getElementById('point-info');

    // Close previous window if open
    if (imageWindow && !imageWindow.closed) {
        imageWindow.close();
    }

    // Open new window
    imageWindow = window.open(url, 'HRRR_Image', 'width=1200,height=900,scrollbars=yes,resizable=yes');

    infoDiv.innerHTML = `
        <h4>HRRR Imagery</h4>
        <p>Due to CORS restrictions, the HRRR imagery has been opened in a new window.</p>
        <p><strong>Runtime:</strong> ${runtime} UTC</p>
        <p><strong>Forecast Hour:</strong> 000 (Analysis)</p>
        <p><strong>Plot Type:</strong> ${getPlotTypeLabel(currentPlotType)}</p>
        <p><strong>Grid:</strong> 919 x 1299 points</p>
        <p><strong>Resolution:</strong> 3 km</p>
        <p><strong>Projection:</strong> Polar Stereographic</p>
        <hr style="margin: 15px 0;">
        <p style="font-size: 12px; color: #666;">
            The blue dashed rectangle on the map shows the exact Alaska HRRR grid bounds.
        </p>
        <p><button onclick="window.open('${url}', 'HRRR_Image', 'width=1200,height=900,scrollbars=yes,resizable=yes')" class="btn" style="margin-top: 10px; width: 100%;">Reopen Image Window</button></p>
    `;

    // Fit map to HRRR bounds
    const imageBounds = [
        [HRRR_BOUNDS.south, HRRR_BOUNDS.west],
        [HRRR_BOUNDS.north, HRRR_BOUNDS.east]
    ];
    map.fitBounds(imageBounds);
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
        <hr style="margin: 15px 0;">
        <p style="font-size: 12px; color: #666;">
            The blue dashed rectangle shows the exact Alaska HRRR grid bounds aligned with the map.
        </p>
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
    if (imageWindow && !imageWindow.closed) {
        imageWindow.close();
        imageWindow = null;
    }
    document.getElementById('point-info').innerHTML = '';
    updateStatus('Imagery cleared', false);
}

// Add CSS for UI elements
const style = document.createElement('style');
style.textContent = `
    .hrrr-image-layer {
        pointer-events: auto;
    }
    .btn {
        cursor: pointer;
    }
    hr {
        border: none;
        border-top: 1px solid #eee;
    }
`;
document.head.appendChild(style);
