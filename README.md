# Alaska HRRR Alignment Leaflet Map

An interactive web application for visualizing High-Resolution Rapid Refresh (HRRR) model reference points for Alaska using Leaflet.js.

## Features

- **Interactive Map**: Explore Alaska with pan and zoom capabilities
- **HRRR Reference Points**: Display HRRR model grid reference points across Alaska
- **Data Visualization**: Color-coded markers based on temperature data
- **Detailed Information**: Click on any point to view detailed weather data
- **Multiple Base Layers**: Switch between street map and satellite imagery

## HRRR-Alaska Model Specifications

- **Resolution**: 3 km
- **Coverage**: Alaska region
- **Update Frequency**: Hourly
- **Data Source**: NOAA High-Resolution Rapid Refresh

## Usage

1. **Load Data**: Click the "Load HRRR Reference Points" button to display reference points
2. **Explore**: Click on any marker to view detailed information
3. **Switch Views**: Use the layer control to switch between map types
4. **Clear Data**: Click "Clear Data" to remove all markers

## GitHub Pages Deployment

This project is automatically deployed to GitHub Pages when pushing to any `claude/*` branch or the `main` branch.

### Live Demo

After deployment, the application will be available at:
```
https://[your-username].github.io/Alaska_HRRR_Alignment_Leaflet_3/
```

## Technology Stack

- **Leaflet.js**: Interactive mapping library
- **OpenStreetMap**: Base map tiles
- **Esri World Imagery**: Satellite imagery option
- **Vanilla JavaScript**: No framework dependencies
- **GitHub Actions**: Automated deployment

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
