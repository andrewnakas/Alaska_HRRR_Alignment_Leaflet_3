// Initialize the map centered on Alaska
let map;
let hrrrMarkers = [];
let hrrrLayer;

// Alaska center coordinates
const ALASKA_CENTER = [64.0685, -152.2782];
const ALASKA_ZOOM = 5;

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupEventListeners();
});

function initMap() {
    // Create the map
    map = L.map('map').setView(ALASKA_CENTER, ALASKA_ZOOM);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Add a second layer option - Esri World Imagery
    const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // Add layer control
    const baseMaps = {
        "Street Map": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map),
        "Satellite": esriImagery
    };

    L.control.layers(baseMaps).addTo(map);

    // Create layer group for HRRR markers
    hrrrLayer = L.layerGroup().addTo(map);

    updateStatus('Map initialized. Click "Load HRRR Reference Points" to display data.');
}

function setupEventListeners() {
    document.getElementById('loadDataBtn').addEventListener('click', loadHRRRData);
    document.getElementById('clearDataBtn').addEventListener('click', clearHRRRData);
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

// Generate HRRR reference grid points for Alaska
function generateHRRRReferencePoints() {
    const points = [];

    // Alaska bounding box (approximate)
    const bounds = {
        north: 71.5,
        south: 54.5,
        west: -169,
        east: -130
    };

    // HRRR-Alaska resolution is 3km
    // For display purposes, we'll create a grid with ~0.3 degree spacing (approximately every 30km)
    // This creates a manageable number of points for visualization
    const latStep = 0.3;
    const lonStep = 0.5;

    let pointId = 0;

    for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
        for (let lon = bounds.west; lon <= bounds.east; lon += lonStep) {
            // Add some variation to simulate real HRRR data points
            const point = {
                id: `HRRR_${pointId++}`,
                lat: lat + (Math.random() - 0.5) * 0.05,
                lon: lon + (Math.random() - 0.5) * 0.05,
                // Simulated HRRR data values
                temperature: Math.round((Math.random() * 40 - 20) * 10) / 10, // -20 to 20°C
                windSpeed: Math.round(Math.random() * 30 * 10) / 10, // 0-30 m/s
                pressure: Math.round((1000 + Math.random() * 40) * 10) / 10, // 1000-1040 hPa
                elevation: Math.round(Math.random() * 2000) // 0-2000m
            };
            points.push(point);
        }
    }

    return points;
}

// Fetch HRRR data from AWS S3 or generate sample data
async function fetchHRRRData() {
    updateStatus('Fetching HRRR reference data...', true);

    // In a real implementation, you would fetch from AWS S3:
    // const response = await fetch('https://noaa-hrrr-bdp-pds.s3.amazonaws.com/...');
    // For this demo, we'll generate sample reference points

    return new Promise((resolve) => {
        setTimeout(() => {
            const data = generateHRRRReferencePoints();
            resolve(data);
        }, 1000); // Simulate network delay
    });
}

// Load and display HRRR data on the map
async function loadHRRRData() {
    try {
        updateStatus('Loading HRRR data...', true);

        // Clear existing markers
        clearHRRRData();

        // Fetch the data
        const hrrrPoints = await fetchHRRRData();

        // Add markers to the map
        hrrrPoints.forEach(point => {
            // Create custom icon
            const marker = L.circleMarker([point.lat, point.lon], {
                radius: 6,
                fillColor: getColorByTemperature(point.temperature),
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });

            // Create popup content
            const popupContent = `
                <div class="hrrr-popup">
                    <h4>${point.id}</h4>
                    <p><strong>Location:</strong> ${point.lat.toFixed(4)}°N, ${Math.abs(point.lon).toFixed(4)}°W</p>
                    <p><strong>Temperature:</strong> ${point.temperature}°C</p>
                    <p><strong>Wind Speed:</strong> ${point.windSpeed} m/s</p>
                    <p><strong>Pressure:</strong> ${point.pressure} hPa</p>
                    <p><strong>Elevation:</strong> ${point.elevation} m</p>
                </div>
            `;

            marker.bindPopup(popupContent);

            // Add click event to show info in panel
            marker.on('click', function() {
                showPointInfo(point);
            });

            hrrrLayer.addLayer(marker);
            hrrrMarkers.push(marker);
        });

        updateStatus(`Loaded ${hrrrPoints.length} HRRR reference points`, false);

        // Update info panel
        document.getElementById('point-info').innerHTML = `
            <p><strong>Total Points:</strong> ${hrrrPoints.length}</p>
            <p>Click on any point to view detailed information.</p>
        `;

    } catch (error) {
        console.error('Error loading HRRR data:', error);
        updateStatus('Error loading data. Please try again.', false);
    }
}

// Color scale based on temperature
function getColorByTemperature(temp) {
    if (temp < -15) return '#2b4f81';
    if (temp < -10) return '#4575b4';
    if (temp < -5) return '#74add1';
    if (temp < 0) return '#abd9e9';
    if (temp < 5) return '#e0f3f8';
    if (temp < 10) return '#fee090';
    if (temp < 15) return '#fdae61';
    if (temp < 20) return '#f46d43';
    return '#d73027';
}

// Clear all HRRR markers from the map
function clearHRRRData() {
    hrrrLayer.clearLayers();
    hrrrMarkers = [];
    document.getElementById('point-info').innerHTML = '';
    updateStatus('Data cleared', false);
}

// Show detailed point information
function showPointInfo(point) {
    const infoDiv = document.getElementById('point-info');
    infoDiv.innerHTML = `
        <h4>Selected Point</h4>
        <p><strong>ID:</strong> ${point.id}</p>
        <p><strong>Coordinates:</strong><br>${point.lat.toFixed(4)}°N, ${Math.abs(point.lon).toFixed(4)}°W</p>
        <p><strong>Temperature:</strong> ${point.temperature}°C</p>
        <p><strong>Wind Speed:</strong> ${point.windSpeed} m/s</p>
        <p><strong>Pressure:</strong> ${point.pressure} hPa</p>
        <p><strong>Elevation:</strong> ${point.elevation} m</p>
    `;
}

// Add scale control
L.control.scale({
    imperial: true,
    metric: true
}).addTo(map);
