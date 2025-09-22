# Fixing Container Element Not Found Error

## Common Causes and Solutions

### Issue: `Container element 'tactical-3d-map' not found`

This error occurs when the Google Maps builder tries to initialize before the React component has fully rendered the DOM element.

### Solution Implemented:

#### 1. Added DOM Element Wait Function
```typescript
const waitForElement = (elementId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const checkElement = () => {
      const element = document.getElementById(elementId);
      if (element) {
        console.log(`Found element: ${elementId}`);
        resolve();
      } else {
        console.log(`Waiting for element: ${elementId}`);
        setTimeout(checkElement, 100);
      }
    };
    
    checkElement();
    
    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error(`Element '${elementId}' not found after 10 seconds`));
    }, 10000);
  });
};
```

#### 2. Updated Initialization Sequence
```typescript
const initializeSystem = async () => {
  try {
    setLoading(true);
    setError(null);

    // Check API key first
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY) {
      throw new Error('Google Maps API key not configured.');
    }

    // WAIT for DOM element before initializing
    await waitForElement('tactical-3d-map');

    // Load KML data
    const kmlData = await loadAllKMLData();
    
    // Initialize 3D map (element is now guaranteed to exist)
    const builder = new Photorealistic3DMapBuilder();
    await builder.initialize(mockKML, 'tactical-3d-map');
    
    setLoading(false);
  } catch (err) {
    console.error('Failed to initialize tactical system:', err);
    setError(err.message);
    setLoading(false);
  }
};
```

### Expected Console Output:
```
Loading KML data...
Waiting for element: tactical-3d-map
Found element: tactical-3d-map
Initializing 3D map...
Extracted Model coordinates: lng=-119.4558, lat=35.4015, alt=0
Device T10: lat=35.4015, lng=-119.4558
Calculated KML center: lat=35.4015, lng=-119.4558
```

### Testing Steps:

1. **Clear Browser Cache**: `Ctrl+Shift+R` to force reload
2. **Check Console**: Look for "Found element: tactical-3d-map" message
3. **Verify Environment**: Ensure `.env.local` has Google Maps API key
4. **Monitor Network**: Check if Google Maps API loads successfully

### Alternative Container Reference:

If the issue persists, we can also use the React ref instead of getElementById:

```typescript
// Using React ref (backup approach)
const mapRef = useRef<HTMLDivElement>(null);

const initializeWithRef = async () => {
  if (!mapRef.current) {
    throw new Error('Map container ref not available');
  }
  
  // Pass the element directly instead of ID
  await builder.initializeWithElement(mockKML, mapRef.current);
};
```

### Troubleshooting Checklist:

- [ ] Google Maps API key is set in `.env.local`
- [ ] Element ID `tactical-3d-map` exists in rendered DOM
- [ ] React component has fully mounted
- [ ] No CSS display:none hiding the container
- [ ] Container has proper dimensions (height/width)
- [ ] Google Maps libraries are loaded

The fix ensures the DOM element exists before Google Maps tries to initialize, eliminating the "Container element not found" error.