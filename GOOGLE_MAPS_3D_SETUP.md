# Creating the Correct Google Maps 3D Map ID

## Your Current Issue
You have: `NEXT_PUBLIC_GOOGLE_MAP_ID=dc869aaa56807e144c172fa4`

But this might be a **2D map** or not configured for **3D photorealistic tiles**. For the C2 tactical system, you need a specific **3D-enabled Map ID**.

## Step-by-Step: Create Correct 3D Map ID

### 1. Go to Google Cloud Console
Visit: [Google Cloud Console - Map Management](https://console.cloud.google.com/google/maps-apis/studio/maps)

### 2. Create New Map ID
1. Click **"+ CREATE MAP ID"**
2. Set these **EXACT** settings:

**Map Name**: `C2-Tactical-3D-Map`

**Map Type**: ✅ **Vector** (NOT Raster)

**Platform**: ✅ **JavaScript**

### 3. Configure 3D Settings (CRITICAL)
In the Map ID configuration:

**Map Style**: 
- ✅ **Default** (or)
- ✅ **Satellite** 

**3D Features**: 
- ✅ **Enable 3D buildings**
- ✅ **Enable photorealistic 3D tiles** ⭐ **MOST IMPORTANT**
- ✅ **Enable tilt control**
- ✅ **Enable rotation control**

### 4. Copy the New Map ID
After creation, copy the Map ID (format: `a1b2c3d4e5f6g7h8`)

### 5. Update Your .env.local
```env
NEXT_PUBLIC_GOOGLE_MAP_ID=your_new_3d_map_id_here
```

## Alternative: Quick 3D Map ID Creation

If the Map Management interface is confusing, you can also create a 3D Map ID through the **Maps JavaScript API**:

### Option A: Using gcloud CLI
```bash
# Enable the required APIs
gcloud services enable maps-backend.googleapis.com
gcloud services enable maptiles.googleapis.com

# Create a 3D Map ID (replace PROJECT_ID)
gcloud alpha maps create-map-id \
  --display-name="C2-Tactical-3D" \
  --map-type="VECTOR" \
  --platform="JAVASCRIPT"
```

### Option B: Test with a Public 3D Map ID
For **testing only**, you can use Google's demo 3D Map ID:
```env
NEXT_PUBLIC_GOOGLE_MAP_ID=DEMO_MAP_ID
```
⚠️ **Don't use this in production**

## How to Verify Your Map ID Works

### 1. Check Map ID Type
In Google Cloud Console > Map Management:
- Find your Map ID
- Verify it shows **"Vector"** and **"JavaScript"**
- Check that **"3D"** features are enabled

### 2. Test with Simple HTML
Create a test file:
```html
<!DOCTYPE html>
<html>
<head>
  <script async defer
    src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap&v=weekly">
  </script>
</head>
<body>
  <div id="map" style="height: 400px;"></div>
  <script>
    function initMap() {
      new google.maps.Map(document.getElementById("map"), {
        center: { lat: 35.4015, lng: -119.4558 },
        zoom: 18,
        mapId: "YOUR_MAP_ID_HERE", // Test your Map ID
        tilt: 45, // Should work if 3D is enabled
        mapTypeId: 'satellite'
      });
    }
  </script>
</body>
</html>
```

### 3. Expected Results
**✅ Correct 3D Map ID**: 
- Shows photorealistic 3D buildings
- Tilt/rotation controls work
- Satellite imagery with 3D depth

**❌ Wrong Map ID**:
- Flat 2D view only
- No tilt/rotation
- Error: "This page can't load Google Maps correctly"

## Common Map ID Issues

### Issue 1: 2D Map ID
**Problem**: Created a "Raster" map instead of "Vector"
**Solution**: Create new Map ID with "Vector" type

### Issue 2: Wrong Platform
**Problem**: Created for "Android" or "iOS" instead of "JavaScript"
**Solution**: Create new Map ID for "JavaScript" platform

### Issue 3: 3D Features Not Enabled
**Problem**: Map loads but no 3D tilt/rotation
**Solution**: Enable "photorealistic 3D tiles" in Map ID settings

### Issue 4: API Restrictions
**Problem**: Map ID works in test but not in app
**Solution**: Check API key restrictions allow your domain

## Debug Your Current Map ID

Add this to your browser console when the tactical page loads:
```javascript
// Check if Map ID is working
console.log('Map ID:', process.env.NEXT_PUBLIC_GOOGLE_MAP_ID);

// Test if 3D features are available
if (window.google?.maps) {
  console.log('Google Maps loaded');
  const map = window.map3D;
  if (map) {
    console.log('Current tilt:', map.getTilt());
    console.log('Current heading:', map.getHeading());
    console.log('Max tilt:', map.get('maxTilt'));
  }
} else {
  console.error('Google Maps not loaded');
}
```

## What You Should See
With a **correct 3D Map ID**, your tactical system will show:
- 🌍 **Photorealistic 3D terrain** of Central California
- 🏢 **3D buildings** and structures
- 📡 **LRAD devices** positioned in 3D space
- 🎯 **Beam cones** with proper elevation angles
- 🗺️ **Tilt/rotation** controls working

Let me know what Map ID you create and I'll help verify it's configured correctly!