# Google Maps 3D API Setup Guide

## Required Google Cloud Platform APIs

To implement the C2 3D Tactical System, you need to enable these APIs in your Google Cloud Platform project:

### 1. Essential APIs (Required)
- **Maps JavaScript API** - Core mapping functionality
- **Map Tiles API** - 3D photorealistic tiles and satellite imagery  
- **Places API** - Location identification and nearby search
- **Geocoding API** - Address to coordinate conversion

### 2. Supporting APIs (Recommended)
- **Maps Elevation API** - For LRAD beam trajectory calculations
- **Directions API** - Emergency evacuation routing

## Setup Instructions

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "C2-Tactical-System"
3. Enable billing (required for Maps APIs)

### 2. Enable APIs
```bash
# Using gcloud CLI (recommended)
gcloud services enable maps-backend.googleapis.com
gcloud services enable maptiles.googleapis.com  
gcloud services enable places-backend.googleapis.com
gcloud services enable geocoding-backend.googleapis.com
gcloud services enable elevation-backend.googleapis.com
gcloud services enable directions-backend.googleapis.com
```

Or enable manually in the [API Library](https://console.cloud.google.com/apis/library)

### 3. Create API Key
1. Go to **Credentials** in Google Cloud Console
2. Click **+ Create Credentials** → **API Key**
3. Copy the generated API key
4. **IMPORTANT**: Restrict the key for security

### 4. Configure API Key Restrictions
For production, restrict your API key:

**Application Restrictions:**
- HTTP referrers: `yourdomain.com/*`, `localhost:3000/*`

**API Restrictions:**
- Maps JavaScript API
- Map Tiles API  
- Places API
- Geocoding API
- Maps Elevation API
- Directions API

### 5. Create Map ID (Required for 3D)
1. Go to **Map Management** in Google Cloud Console
2. Click **Create Map ID**
3. Choose **JavaScript** as platform
4. Select **3D** map type
5. Copy the Map ID

### 6. Update Environment Variables
Add to your `.env.local`:

```env
# Google Maps Configuration
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_api_key_here
NEXT_PUBLIC_GOOGLE_MAP_ID=your_map_id_here
```

## Usage Quotas & Pricing

### Free Tier (Monthly)
- **Maps JavaScript API**: 28,500 loads
- **Map Tiles API**: 100,000 tiles  
- **Places API**: 20,000 requests
- **Geocoding API**: 40,000 requests

### Estimated Monthly Costs (After Free Tier)
Based on tactical system usage:

| API | Price per 1,000 | Est. Monthly Usage | Est. Cost |
|-----|-----------------|-------------------|-----------|
| Maps JavaScript API | $7.00 | 50,000 loads | $150 |
| Map Tiles API | $2.00 | 200,000 tiles | $200 |
| Places API | $17.00 | 10,000 requests | $0 (within free) |
| Geocoding API | $5.00 | 5,000 requests | $0 (within free) |

**Total Estimated: ~$350/month** for active tactical operations

## Testing Your Setup

1. Add your API keys to `.env.local`
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Navigate to the **3D Tactical System** in the C2 Dashboard
4. You should see:
   - Google Maps loading with satellite view
   - KML overlays from `/public/overlays/`
   - LRAD device markers and beam cones
   - Zone boundaries with policy states

## Troubleshooting

### Common Issues

**"This page can't load Google Maps correctly"**
- Check API key is valid and unrestricted for development
- Verify billing is enabled
- Ensure Maps JavaScript API is enabled

**"Google Maps JavaScript API error: RefererNotAllowedMapError"**  
- Add your domain to API key restrictions
- For development, add `localhost:3000`

**"Map tiles not loading"**
- Verify Map Tiles API is enabled
- Check if Map ID is configured correctly
- Ensure 3D map type is selected in Map ID settings

**KML files not displaying**
- Check files exist in `/public/overlays/`
- Verify KML format is valid
- Check browser console for parsing errors

### Development vs Production

**Development:**
- Use unrestricted API key for testing
- Monitor quota usage in Google Cloud Console

**Production:**
- Always restrict API keys by domain/IP
- Set up quota alerts
- Consider using server-side proxy for sensitive operations

## Security Best Practices

1. **Never commit API keys to source control**
2. **Use environment variables** for all credentials  
3. **Restrict API keys** by domain and API
4. **Monitor usage** for unusual spikes
5. **Rotate keys regularly** for production systems

## Support Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [3D Maps Developer Guide](https://developers.google.com/maps/documentation/javascript/3d-maps)
- [KML Reference](https://developers.google.com/kml/documentation/kmlreference)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)

---

Once configured, your C2 system will have:
- ✅ Real-time 3D photorealistic maps
- ✅ KML zone overlay with policy management  
- ✅ LRAD device visualization with beam cones
- ✅ OSHA compliance zones
- ✅ Offline tile caching capability