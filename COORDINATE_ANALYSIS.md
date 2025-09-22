# Real KML Coordinate Analysis - Your Midway Substation

## Actual Device Locations from Your KML Files

### T10 LRAD Device (From Midway Sub LRAD V1.8.kml):
```xml
<Placemark>
  <name>T10</name>
  <Model>
    <Location>
      <longitude>-119.4558144461364</longitude>
      <latitude>35.40151546826687</latitude>
      <altitude>0</altitude>
    </Location>
    <Orientation>
      <heading>-15.22913427383327</heading>  <!-- Device bearing -->
      <tilt>0</tilt>
      <roll>0</roll>
    </Orientation>
  </Model>
</Placemark>
```

### Geographic Location Analysis:
- **Longitude**: -119.4558° W (California)
- **Latitude**: 35.4015° N (Central California)
- **Real Location**: This is approximately **Bakersfield/Kern County area**
- **NOT Florida**: The mock coordinates (-81.5472, 28.8797) were incorrect

## How the 3D Scene Gets Positioned:

### 1. KML Center Calculation
```typescript
private calculateKMLCenter(): { lat: number, lng: number } {
  if (!this.kmlData || (!this.kmlData.zones.length && !this.kmlData.devices.length)) {
    // WRONG: Default to mock Florida coordinates
    return { lat: 28.8797, lng: -81.5472 };
  }

  // CORRECT: Calculate from actual KML data
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;

  // Sum all device and zone coordinates
  this.kmlData.devices.forEach(device => {
    totalLat += device.position[0];   // 35.4015
    totalLng += device.position[1];   // -119.4558
    count++;
  });

  return { 
    lat: totalLat / count,    // ~35.40°N 
    lng: totalLng / count     // ~-119.46°W
  };
}
```

### 2. Google Maps 3D Initialization
```typescript
this.map3D = new google.maps.Map(mapElement, {
  center: { 
    lat: 35.4015,      // Your actual site latitude
    lng: -119.4558     // Your actual site longitude  
  },
  zoom: 18,           // Building-level detail
  mapTypeId: 'satellite',
  tilt: 45,           // 3D perspective
  heading: 0,         // North orientation
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
});
```

### 3. Device Marker Placement
```typescript
// T10 LRAD Device at actual coordinates
const t10Marker = new google.maps.Marker({
  position: { 
    lat: 35.40151546826687,    // From your KML
    lng: -119.4558144461364    // From your KML
  },
  map: this.map3D,
  title: "T10",
  icon: {
    url: '/lrad-device-icon.svg',
    scaledSize: new google.maps.Size(32, 32)
  }
});
```

### 4. Beam Cone Calculation
```typescript
// Using real device orientation from KML
const deviceBearing = -15.22913427383327;  // From <heading> in KML
const beamWidth = 30;  // Default or from ExtendedData
const range = 300;     // Effective range in meters

// Calculate beam cone polygon for actual location
const origin = new google.maps.LatLng(35.4015, -119.4558);
const beamCone = this.calculateBeamCone(origin, deviceBearing, beamWidth, range);
```

## Real Site Identification

### Based on coordinates (-119.4558, 35.4015):
- **State**: California
- **Region**: Central Valley / Kern County
- **Nearest City**: Bakersfield area
- **Terrain**: Valley floor, agricultural/industrial area
- **Elevation**: ~400 feet above sea level

### Google Maps 3D View Will Show:
- Photorealistic satellite imagery of actual site
- Real buildings and terrain features
- Accurate shadows and 3D structures
- True geographical context

## Why Mock Data Was Used

The system includes fallback mock data because:
```typescript
if (kmlData.zones.length === 0 && kmlData.devices.length === 0) {
  console.warn('No KML data loaded, using mock data for demo');
  const mockData = createMockData();  // Creates Florida coordinates
  setZones(mockData.zones);
  setDevices(mockData.devices);
}
```

## Fixing the Coordinate System

### Current Issue:
- KML parser correctly extracts real coordinates: `(-119.4558, 35.4015)`
- But if KML loading fails, system falls back to mock Florida data
- Need to ensure KML files load properly and real coordinates are used

### Solution Steps:
1. **Verify KML Loading**: Ensure `/overlays/Midway Sub LRAD V1.8.kml` loads correctly
2. **Fix Coordinate Conversion**: Ensure `[lng, lat, alt]` → `[lat, lng, alt]` conversion is correct
3. **Update Scene Center**: Use real California coordinates for map center
4. **Test Photorealistic View**: Verify Google Maps shows actual site location

### Debug Commands:
```javascript
// Check if real KML data loaded
console.log('KML Load Status:', window.kmlData);
console.log('Device Positions:', window.kmlData?.devices?.map(d => d.position));
console.log('Map Center:', window.map3D?.getCenter()?.toJSON());
```

## Expected 3D Scene Result

When working correctly, you should see:
- **Google Maps centered on Central California**
- **T10 device marker at exact KML coordinates**
- **Photorealistic 3D terrain of your actual site**
- **Beam cone pointing at -15.2° bearing (northwest)**
- **Zone boundaries overlaid on real satellite imagery**

The key is ensuring your real KML coordinates (`-119.4558, 35.4015`) are used instead of the mock Florida coordinates (`-81.5472, 28.8797`)!