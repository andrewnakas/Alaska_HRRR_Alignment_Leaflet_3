# Alaska HRRR Alignment Leaflet Map

An interactive web application for visualizing High-Resolution Rapid Refresh (HRRR) model 0-hour imagery for Alaska using Leaflet.js with proper grid alignment.

## Features

- **Interactive Map**: Explore Alaska with pan and zoom capabilities
- **HRRR 0-Hour Imagery**: Display actual HRRR model forecast imagery from NOAA
- **Proper Grid Alignment**: Alaska HRRR grid boundary overlay showing exact polar stereographic projection bounds
- **Multiple Plot Types**: Choose from composite reflectivity, 1km AGL reflectivity, and more
- **Real-time Data**: Automatically fetches the latest available HRRR run
- **Multiple Base Layers**: Switch between street map, satellite imagery, and topographic views
- **Geographic Bounds**: Accurate lat/lon bounds for Alaska HRRR grid (41.61°N to 76.35°N, -174.9°W to -115.8°W)

## HRRR-Alaska Model Specifications

- **Resolution**: 3 km
- **Grid Dimensions**: 919 x 1299 points
- **Coverage**: Alaska region and surrounding areas
- **Update Frequency**: Hourly
- **Projection**: Polar Stereographic (standard parallel: 60.0°, central longitude: -135.0°)
- **Data Source**: NOAA High-Resolution Rapid Refresh

## Usage

1. **Select Plot Type**: Choose a visualization type from the dropdown (e.g., Composite Reflectivity)
2. **Load Imagery**: Click the "Load HRRR 0-Hour Imagery" button to fetch and display the latest analysis
3. **View Grid Boundary**: The blue dashed rectangle shows the exact Alaska HRRR grid bounds
4. **Switch Views**: Use the layer control to switch between street map, satellite, and topographic views
5. **Clear Data**: Click "Clear Data" to remove the HRRR imagery overlay
6. **Check Details**: View runtime and grid information in the info panel on the right

## GitHub Pages Deployment

This project is automatically deployed to GitHub Pages when pushing to any `claude/*` branch or the `main` branch.

### Live Demo

After deployment, the application will be available at:
```
https://[your-username].github.io/Alaska_HRRR_Alignment_Leaflet_3/
```

## Technology Stack

- **Leaflet.js**: Interactive mapping library (v1.9.4)
- **Proj4js**: Coordinate transformation library for handling polar stereographic projection
- **Proj4Leaflet**: Leaflet plugin for custom CRS support
- **OpenStreetMap**: Base map tiles
- **Esri World Imagery**: Satellite imagery and topographic map options
- **Vanilla JavaScript**: No framework dependencies
- **GitHub Actions**: Automated deployment to GitHub Pages

## Technical Details

### Grid Alignment

The Alaska HRRR grid uses a **Polar Stereographic projection** with the following parameters:
- **Projection**: `stere` (Stereographic)
- **Latitude of origin**: 90° (North Pole)
- **Central longitude**: -135° (225° from pole)
- **Standard parallel**: 60°
- **Grid bounds** (lat/lon):
  - South: 41.61°N
  - North: 76.35°N
  - West: -174.9°W
  - East: -115.8°W

The application displays these bounds as an overlay rectangle on the Leaflet map (which uses Web Mercator projection). While there is some distortion when reprojecting from polar stereographic to Web Mercator, the imagery is georeferenced to align as accurately as possible with the HRRR grid.

### CORS Handling

NOAA serves HRRR imagery through CGI scripts which may have CORS (Cross-Origin Resource Sharing) restrictions. The application uses a CORS proxy (allOrigins) to fetch images. If the proxy fails, the app provides a direct link to view the imagery in a new tab.

## Data Source

HRRR data is available from NOAA via AWS S3:
- AWS S3 Bucket: `noaa-hrrr-bdp-pds`
- Documentation: [NOAA HRRR on AWS](https://registry.opendata.aws/noaa-hrrr-pds/)

## Development

To run locally:
1. Clone the repository
2. Open `index.html` in a web browser
3. No build process required!

## Future Enhancements

- Real-time HRRR data fetching from AWS S3
- Time series animation
- Additional weather parameters (precipitation, cloud cover, etc.)
- Export functionality
- Mobile optimization

## License

This project uses publicly available HRRR data from NOAA.

## Contact

For questions about HRRR data, contact: nodd@noaa.gov
