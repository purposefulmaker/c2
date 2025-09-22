# Testing KML Coordinate Mapping

## How to Test Your Real Site Coordinates

### 1. Open Browser Developer Console
When you load the 3D Tactical System:
1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Look for coordinate debug messages

### 2. Expected Console Output (Real Coordinates):
```
Extracted Model coordinates: lng=-119.4558144461364, lat=35.40151546826687, alt=0
Parsed LRAD device: T10 at [35.40151546826687, -119.4558144461364, 0] with bearing -15.22913427383327°
Device T10: lat=35.40151546826687, lng=-119.4558144461364
Calculated KML center from 1 coordinates: lat=35.4015, lng=-119.4558
```

### 3. What This Means:
- **Latitude**: 35.4015° N (Central California)
- **Longitude**: -119.4558° W (Central California) 
- **Location**: Bakersfield/Kern County area
- **Bearing**: -15.23° (pointing northwest)

### 4. Google Maps 3D View Should Show:
- **Real satellite imagery** of your actual site
- **3D photorealistic terrain** of Central California
- **T10 device marker** at exact KML coordinates
- **Beam cone** pointing northwest at -15.2° bearing
- **NOT Florida** - if you see Orlando area, KML loading failed

### 5. Debug Commands to Run:
```javascript
// Check if KML data loaded correctly
console.log('KML Data:', window.kmlData);

// Verify device coordinates
console.log('Devices:', window.kmlData?.devices?.map(d => ({
  name: d.name,
  lat: d.position[0],
  lng: d.position[1],
  bearing: d.bearing
})));

// Check map center
console.log('Map Center:', window.map3D?.getCenter()?.toJSON());

// Verify we're in California, not Florida
const center = window.map3D?.getCenter();
if (center) {
  console.log(`Map centered at: ${center.lat().toFixed(4)}, ${center.lng().toFixed(4)}`);
  if (center.lng() > -90) {
    console.error('❌ WRONG: Map centered in Florida, KML coordinates not loaded properly');
  } else {
    console.log('✅ CORRECT: Map centered in California using real KML coordinates');
  }
}
```

### 6. Troubleshooting Coordinate Issues:

**If you see Florida coordinates (28.88, -81.55):**
- KML files failed to load
- System fell back to mock data
- Check `/overlays/` folder exists and contains your KML files
- Verify Google Maps API key is set

**If you see (0, 0) coordinates:**
- KML parsing succeeded but no valid coordinates found
- Check KML file format and Model/Point structure
- Verify placemark names contain "LRAD" or device indicators

**If you see wrong California coordinates:**
- KML loaded but coordinate conversion is incorrect
- Check longitude/latitude order in parsing
- Verify Model Location vs Point coordinates

### 7. Real vs Mock Data Comparison:

| Source | Latitude | Longitude | Location |
|--------|----------|-----------|----------|
| **Real KML** | 35.4015°N | -119.4558°W | California |
| **Mock Data** | 28.8797°N | -81.5472°W | Florida |
| **Failed Load** | 0.0000° | 0.0000° | Ocean/Error |

### 8. Expected 3D Scene Features:
- ✅ **Photorealistic terrain** of actual site location
- ✅ **T10 LRAD marker** at precise coordinates
- ✅ **Beam cone overlay** pointing northwest (-15°)
- ✅ **Zone boundaries** from other KML files
- ✅ **Interactive controls** for zone policy changes

### 9. Site Location Verification:
Your T10 device coordinates place it at:
- **Central California** (Kern County area)
- **Approximately near Bakersfield**
- **Valley floor elevation** (~400 feet)
- **Industrial/agricultural setting**

This matches the coordinate format and geographic context of a utility substation location.

---

**Next Steps**: Once coordinates load correctly, you can proceed with LRAD beam cone visualization and OSHA compliance zones based on the real site layout!