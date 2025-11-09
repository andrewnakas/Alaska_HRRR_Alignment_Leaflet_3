// Initialize the map centered on Alaska
let map;
let hrrrOverlayPane = null;
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
        color: '#ff0000',
        weight: 3,
        fillOpacity: 0,
        dashArray: '10, 5',
        opacity: 0.8
    }).addTo(map).bindPopup('<strong>Alaska HRRR Grid Boundary</strong><br>3 km resolution<br>919 x 1299 grid points<br><br>RED boundary = HRRR grid extent');
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

// Load and display HRRR data on the map using iframe overlay
function loadHRRRData() {
    try {
        updateStatus('Loading HRRR 0-hour imagery...', true);

        // Clear existing overlay
        clearHRRRData();

        // Get latest run time
        const runtime = getLatestRunTime();

        // Get image URL for 0-hour forecast (analysis)
        const imageURL = getHRRRImageURL(currentPlotType, runtime, '000');

        // Create iframe overlay
        createIframeOverlay(imageURL, runtime);

        // Fit map to HRRR bounds
        const imageBounds = [
            [HRRR_BOUNDS.south, HRRR_BOUNDS.west],
            [HRRR_BOUNDS.north, HRRR_BOUNDS.east]
        ];
        map.fitBounds(imageBounds);

        updateStatus(`HRRR imagery loaded - Runtime: ${runtime} UTC`, false);
        updateInfoPanel(runtime, currentPlotType, imageURL);

    } catch (error) {
        console.error('Error loading HRRR data:', error);
        updateStatus('Error loading imagery. See console for details.', false);
    }
}

// Create an iframe overlay positioned over the map
function createIframeOverlay(imageURL, runtime) {
    // Calculate pixel bounds for the HRRR grid on the current map view
    const updateOverlayPosition = () => {
        if (!hrrrOverlayPane) return;

        const swPoint = map.latLngToContainerPoint([HRRR_BOUNDS.south, HRRR_BOUNDS.west]);
        const nePoint = map.latLngToContainerPoint([HRRR_BOUNDS.north, HRRR_BOUNDS.east]);

        hrrrOverlayPane.style.left = swPoint.x + 'px';
        hrrrOverlayPane.style.top = nePoint.y + 'px';
        hrrrOverlayPane.style.width = (nePoint.x - swPoint.x) + 'px';
        hrrrOverlayPane.style.height = (swPoint.y - nePoint.y) + 'px';
    };

    // Create overlay container
    hrrrOverlayPane = document.createElement('div');
    hrrrOverlayPane.id = 'hrrr-overlay-pane';
    hrrrOverlayPane.innerHTML = `
        <div class="overlay-controls">
            <label>
                Opacity: <input type="range" id="opacity-slider" min="0" max="100" value="70" />
                <span id="opacity-value">70%</span>
            </label>
            <button class="overlay-btn" onclick="clearHRRRData()">✕ Close</button>
        </div>
        <iframe src="${imageURL}" frameborder="0"></iframe>
    `;

    // Add to map container
    map.getContainer().appendChild(hrrrOverlayPane);

    // Set up opacity control
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    const iframe = hrrrOverlayPane.querySelector('iframe');

    opacitySlider.addEventListener('input', function() {
        const opacity = this.value / 100;
        iframe.style.opacity = opacity;
        opacityValue.textContent = this.value + '%';
    });

    // Update position on map move/zoom
    updateOverlayPosition();
    map.on('move zoom', updateOverlayPosition);
}

// Update info panel with current imagery details
function updateInfoPanel(runtime, plotType, imageURL) {
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
            <strong style="color: #ff0000;">RED boundary</strong> = HRRR grid extent<br>
            The HRRR imagery is overlaid to match the grid boundaries.
        </p>
        <p style="margin-top: 10px;">
            <a href="${imageURL}" target="_blank" class="image-link">Open in New Tab</a>
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

// Clear HRRR imagery overlay
function clearHRRRData() {
    if (hrrrOverlayPane) {
        map.off('move zoom');
        hrrrOverlayPane.remove();
        hrrrOverlayPane = null;
    }
    document.getElementById('point-info').innerHTML = '';
    updateStatus('Imagery cleared', false);
}

// Add CSS for overlay elements
const style = document.createElement('style');
style.textContent = `
    #hrrr-overlay-pane {
        position: absolute;
        z-index: 500;
        pointer-events: all;
        border: 3px solid #ff0000;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
        background: rgba(0, 0, 0, 0.1);
    }

    #hrrr-overlay-pane iframe {
        width: 100%;
        height: calc(100% - 40px);
        opacity: 0.7;
        display: block;
    }

    .overlay-controls {
        background: rgba(30, 60, 114, 0.95);
        color: white;
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        gap: 10px;
    }

    .overlay-controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    }

    .overlay-controls input[type="range"] {
        flex: 1;
        max-width: 150px;
    }

    .overlay-btn {
        background: white;
        color: #1e3c72;
        border: none;
        padding: 4px 12px;
        border-radius: 3px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
    }

    .overlay-btn:hover {
        background: #f0f0f0;
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
