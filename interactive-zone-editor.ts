// operator-hud/src/components/InteractiveZoneEditor.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import * as turf from '@turf/turf';
import { 
  Box, 
  Paper, 
  Button, 
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Typography,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Divider,
  Alert,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Fab
} from '@mui/material';
import {
  Layers,
  Edit,
  Save,
  Cancel,
  AddCircle,
  Delete,
  Visibility,
  VisibilityOff,
  Warning,
  VolumeUp,
  LocationOn,
  Timeline,
  Calculate,
  CloudUpload,
  CloudDownload,
  Undo,
  Redo,
  FormatShapes,
  GridOn
} from '@mui/icons-material';
import { HexColorPicker } from 'react-colorful';
import './InteractiveZoneEditor.css';

interface Zone {
  id: string;
  name: string;
  type: 'red' | 'yellow' | 'restricted' | 'custom';
  polygon: L.Polygon;
  properties: {
    day_spl: number;
    night_spl: number;
    auto_response: boolean;
    color: string;
    opacity: number;
    restrictions?: string[];
  };
  visible: boolean;
  locked: boolean;
}

interface LRADDevice {
  id: string;
  position: [number, number];
  maxSPL: number;
  coverageCircles?: L.Circle[];
}

export const InteractiveZoneEditor: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'draw'>('view');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showCoverage, setShowCoverage] = useState(true);
  const [lradDevices, setLradDevices] = useState<LRADDevice[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      initializeMap();
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const initializeMap = () => {
    // Create map with dark theme
    mapRef.current = L.map('zone-editor-map', {
      center: [37.7749, -122.4194],
      zoom: 16,
      zoomControl: false
    });

    // Dark tactical basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', {
      maxZoom: 20
    }).addTo(mapRef.current);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    // Initialize layer groups
    gridLayerRef.current = L.layerGroup().addTo(mapRef.current);
    coverageLayerRef.current = L.layerGroup().addTo(mapRef.current);

    // Initialize Leaflet-Geoman controls
    mapRef.current.pm.addControls({
      position: 'topright',
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      cutPolygon: true,
      removalMode: true,
      rotateMode: true
    });

    // Custom toolbar styling
    mapRef.current.pm.Toolbar.changeActionsOfControl('Polygon', [
      'finish',
      'removeLastVertex',
      'cancel'
    ]);

    // Listen for drawing events
    mapRef.current.on('pm:create', handleShapeCreated);
    mapRef.current.on('pm:edit', handleShapeEdited);
    mapRef.current.on('pm:remove', handleShapeRemoved);

    // Load initial zones
    loadDefaultZones();
    
    // Load LRAD positions
    loadLRADDevices();
  };

  const handleShapeCreated = (e: any) => {
    const layer = e.layer;
    
    // Create new zone
    const newZone: Zone = {
      id: `zone_${Date.now()}`,
      name: `Zone ${zones.length + 1}`,
      type: 'custom',
      polygon: layer,
      properties: {
        day_spl: 90,
        night_spl: 80,
        auto_response: false,
        color: '#00ff00',
        opacity: 0.3,
        restrictions: []
      },
      visible: true,
      locked: false
    };

    // Apply initial styling
    layer.setStyle({
      fillColor: newZone.properties.color,
      fillOpacity: newZone.properties.opacity,
      color: newZone.properties.color,
      weight: 2,
      dashArray: '5,10'
    });

    // Add click handler
    layer.on('click', () => selectZone(newZone));

    // Add hover effect
    layer.on('mouseover', () => {
      if (!newZone.locked) {
        layer.setStyle({ weight: 4, fillOpacity: newZone.properties.opacity + 0.1 });
      }
    });

    layer.on('mouseout', () => {
      layer.setStyle({ weight: 2, fillOpacity: newZone.properties.opacity });
    });

    // Add to zones
    setZones(prev => [...prev, newZone]);
    setSelectedZone(newZone);
    
    // Add to history
    addToHistory({ type: 'create', zone: newZone });
    
    // Calculate coverage intersection
    calculateCoverageIntersection(layer);
  };

  const handleShapeEdited = (e: any) => {
    const layers = e.layers;
    layers.eachLayer((layer: L.Layer) => {
      const zone = zones.find(z => z.polygon === layer);
      if (zone) {
        // Recalculate coverage
        calculateCoverageIntersection(layer);
        
        // Add to history
        addToHistory({ type: 'edit', zone });
      }
    });
  };

  const handleShapeRemoved = (e: any) => {
    const layers = e.layers;
    layers.eachLayer((layer: L.Layer) => {
      const zone = zones.find(z => z.polygon === layer);
      if (zone) {
        setZones(prev => prev.filter(z => z.id !== zone.id));
        if (selectedZone?.id === zone.id) {
          setSelectedZone(null);
        }
        addToHistory({ type: 'remove', zone });
      }
    });
  };

  const calculateCoverageIntersection = (zoneLayer: L.Layer) => {
    if (!showCoverage) return;

    const zoneGeoJSON = (zoneLayer as L.Polygon).toGeoJSON();
    const zonePolygon = turf.polygon(zoneGeoJSON.geometry.coordinates);

    lradDevices.forEach(device => {
      // Calculate SPL at different distances
      const distances = [50, 100, 200, 300, 500];
      const splLevels = [120, 110, 95, 85, 75];

      distances.forEach((distance, i) => {
        const circle = turf.circle(device.position, distance, { units: 'meters' });
        const intersection = turf.intersect(zonePolygon, circle);

        if (intersection) {
          // Zone intersects with this SPL level
          console.log(`Zone intersects with ${splLevels[i]}dB coverage at ${distance}m`);
        }
      });
    });
  };

  const selectZone = (zone: Zone) => {
    setSelectedZone(zone);
    
    // Highlight selected zone
    zones.forEach(z => {
      if (z.id === zone.id) {
        z.polygon.setStyle({ weight: 4, dashArray: '' });
      } else {
        z.polygon.setStyle({ weight: 2, dashArray: '5,10' });
      }
    });
  };

  const updateZoneProperty = (property: string, value: any) => {
    if (!selectedZone) return;

    setZones(prev => prev.map(zone => {
      if (zone.id === selectedZone.id) {
        const updated = { ...zone };
        
        if (property.includes('.')) {
          const [parent, child] = property.split('.');
          (updated as any)[parent][child] = value;
        } else {
          (updated as any)[property] = value;
        }

        // Update polygon style
        if (property === 'properties.color' || property === 'properties.opacity') {
          zone.polygon.setStyle({
            fillColor: updated.properties.color,
            fillOpacity: updated.properties.opacity,
            color: updated.properties.color
          });
        }

        // Update visibility
        if (property === 'visible') {
          if (value) {
            zone.polygon.addTo(mapRef.current!);
          } else {
            zone.polygon.remove();
          }
        }

        setSelectedZone(updated);
        return updated;
      }
      return zone;
    }));

    addToHistory({ type: 'update', zone: selectedZone, property, value });
  };

  const loadDefaultZones = () => {
    // Load some example zones
    const defaultZones = [
      {
        name: "Red Zone - Critical",
        type: "red" as const,
        coords: [
          [37.7749, -122.4194],
          [37.7759, -122.4194],
          [37.7759, -122.4184],
          [37.7749, -122.4184]
        ],
        properties: {
          day_spl: 95,
          night_spl: 85,
          auto_response: true,
          color: '#ff0000',
          opacity: 0.3
        }
      },
      {
        name: "Yellow Zone - Warning",
        type: "yellow" as const,
        coords: [
          [37.7739, -122.4204],
          [37.7749, -122.4204],
          [37.7749, -122.4194],
          [37.7739, -122.4194]
        ],
        properties: {
          day_spl: 90,
          night_spl: 80,
          auto_response: false,
          color: '#ffff00',
          opacity: 0.2
        }
      }
    ];

    defaultZones.forEach(zoneData => {
      const polygon = L.polygon(zoneData.coords as L.LatLngExpression[], {
        fillColor: zoneData.properties.color,
        fillOpacity: zoneData.properties.opacity,
        color: zoneData.properties.color,
        weight: 2,
        dashArray: '5,10'
      }).addTo(mapRef.current!);

      const zone: Zone = {
        id: `zone_${Date.now()}_${Math.random()}`,
        name: zoneData.name,
        type: zoneData.type,
        polygon,
        properties: {
          ...zoneData.properties,
          restrictions: []
        },
        visible: true,
        locked: false
      };

      polygon.on('click', () => selectZone(zone));
      setZones(prev => [...prev, zone]);
    });
  };

  const loadLRADDevices = () => {
    // Example LRAD positions
    const devices: LRADDevice[] = [
      {
        id: 'lrad_01',
        position: [37.7754, -122.4189],
        maxSPL: 162
      },
      {
        id: 'lrad_02',
        position: [37.7744, -122.4199],
        maxSPL: 162
      }
    ];

    devices.forEach(device => {
      // Add LRAD marker
      const icon = L.divIcon({
        className: 'lrad-marker',
        html: `
          <div class="lrad-icon">
            <svg width="30" height="30" viewBox="0 0 30 30">
              <circle cx="15" cy="15" r="10" fill="#00ffff" opacity="0.5"/>
              <circle cx="15" cy="15" r="5" fill="#00ffff"/>
              <path d="M20 15 L25 10 M20 15 L25 15 M20 15 L25 20" 
                stroke="#00ffff" stroke-width="2" fill="none"/>
            </svg>
          </div>
        `,
        iconSize: [30, 30]
      });

      L.marker(device.position, { icon }).addTo(mapRef.current!);

      // Add coverage circles
      if (showCoverage) {
        const coverageRanges = [
          { distance: 50, spl: 120, color: '#ff0000', opacity: 0.3 },
          { distance: 100, spl: 110, color: '#ff6600', opacity: 0.25 },
          { distance: 200, spl: 95, color: '#ffcc00', opacity: 0.2 },
          { distance: 300, spl: 85, color: '#ffff00', opacity: 0.15 },
          { distance: 500, spl: 75, color: '#ccff00', opacity: 0.1 }
        ];

        device.coverageCircles = [];
        coverageRanges.forEach(range => {
          const circle = L.circle(device.position, {
            radius: range.distance,
            fillColor: range.color,
            fillOpacity: range.opacity,
            color: range.color,
            weight: 1,
            dashArray: '3,6'
          }).addTo(coverageLayerRef.current!);

          circle.bindTooltip(`${range.spl} dB`, {
            permanent: false,
            direction: 'top'
          });

          device.coverageCircles!.push(circle);
        });
      }
    });

    setLradDevices(devices);
  };

  const toggleGrid = () => {
    if (!gridLayerRef.current) return;

    if (showGrid) {
      gridLayerRef.current.clearLayers();
      setShowGrid(false);
    } else {
      // Create grid overlay
      const bounds = mapRef.current!.getBounds();
      const gridSize = 0.001; // ~100m

      for (let lat = Math.floor(bounds.getSouth() / gridSize) * gridSize; 
           lat < bounds.getNorth(); 
           lat += gridSize) {
        L.polyline([[lat, bounds.getWest()], [lat, bounds.getEast()]], {
          color: '#333',
          weight: 0.5,
          opacity: 0.5
        }).addTo(gridLayerRef.current);
      }

      for (let lng = Math.floor(bounds.getWest() / gridSize) * gridSize; 
           lng < bounds.getEast(); 
           lng += gridSize) {
        L.polyline([[bounds.getSouth(), lng], [bounds.getNorth(), lng]], {
          color: '#333',
          weight: 0.5,
          opacity: 0.5
        }).addTo(gridLayerRef.current);
      }

      setShowGrid(true);
    }
  };

  const exportZones = () => {
    const kml = generateKML(zones);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zones_${Date.now()}.kml`;
    a.click();
  };

  const generateKML = (zones: Zone[]): string => {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Security Zones</name>`;

    zones.forEach(zone => {
      const coords = zone.polygon.getLatLngs()[0].map(
        (ll: L.LatLng) => `${ll.lng},${ll.lat},0`
      ).join(' ');

      kml += `
    <Placemark>
      <name>${zone.name}</name>
      <ExtendedData>
        <Data name="type"><value>${zone.type}</value></Data>
        <Data name="day_spl"><value>${zone.properties.day_spl}</value></Data>
        <Data name="night_spl"><value>${zone.properties.night_spl}</value></Data>
        <Data name="auto_response"><value>${zone.properties.auto_response}</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
    });

    kml += `
  </Document>
</kml>`;

    return kml;
  };

  const addToHistory = (action: any) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
    setHistoryIndex(prev => prev + 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      // Implement undo logic
      setHistoryIndex(prev => prev - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      // Implement redo logic
      setHistoryIndex(prev => prev + 1);
    }
  };

  return (
    <Box className="zone-editor-container">
      {/* Main Map */}
      <Box id="zone-editor-map" className="zone-map" />

      {/* Floating Toolbar */}
      <Paper className="floating-toolbar" elevation={3}>
        <ToggleButtonGroup
          value={editMode}
          exclusive
          onChange={(_, mode) => mode && setEditMode(mode)}
          size="small"
        >
          <ToggleButton value="view">
            <Tooltip title="View Mode">
              <Visibility />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="edit">
            <Tooltip title="Edit Mode">
              <Edit />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="draw">
            <Tooltip title="Draw Mode">
              <FormatShapes />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <IconButton onClick={toggleGrid} color={showGrid ? 'primary' : 'default'}>
          <Tooltip title="Toggle Grid">
            <GridOn />
          </Tooltip>
        </IconButton>

        <IconButton 
          onClick={() => setShowCoverage(!showCoverage)} 
          color={showCoverage ? 'primary' : 'default'}
        >
          <Tooltip title="Toggle LRAD Coverage">
            <VolumeUp />
          </Tooltip>
        </IconButton>

        <IconButton onClick={() => setShowSidebar(!showSidebar)}>
          <Tooltip title="Toggle Sidebar">
            <Layers />
          </Tooltip>
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <IconButton onClick={undo} disabled={historyIndex <= 0}>
          <Tooltip title="Undo">
            <Undo />
          </Tooltip>
        </IconButton>

        <IconButton onClick={redo} disabled={historyIndex >= history.length - 1}>
          <Tooltip title="Redo">
            <Redo />
          </Tooltip>
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <IconButton onClick={exportZones}>
          <Tooltip title="Export KML">
            <CloudDownload />
          </Tooltip>
        </IconButton>
      </Paper>

      {/* Sidebar */}
      <Drawer
        anchor="left"
        open={showSidebar}
        variant="persistent"
        PaperProps={{
          sx: {
            width: 350,
            backgroundColor: '#1a1a2e',
            color: 'white'
          }
        }}
      >
        <Box className="zone-sidebar">
          <Typography variant="h6" gutterBottom>
            Zone Management
          </Typography>

          {/* Zone List */}
          <Paper elevation={1} sx={{ p: 1, mb: 2, backgroundColor: '#16213e' }}>
            <Typography variant="subtitle2" gutterBottom>
              Active Zones ({zones.length})
            </Typography>
            <List dense>
              {zones.map(zone => (
                <ListItem
                  key={zone.id}
                  button
                  selected={selectedZone?.id === zone.id}
                  onClick={() => selectZone(zone)}
                >
                  <ListItemIcon>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        backgroundColor: zone.properties.color,
                        opacity: zone.properties.opacity * 2,
                        borderRadius: 1
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={zone.name}
                    secondary={`${zone.type} • ${zone.properties.day_spl}dB day`}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateZoneProperty('visible', !zone.visible);
                    }}
                  >
                    {zone.visible ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </ListItem>
              ))}
            </List>
            
            <Button
              variant="outlined"
              startIcon={<AddCircle />}
              fullWidth
              sx={{ mt: 1 }}
              onClick={() => {
                mapRef.current?.pm.enableDraw('Polygon');
                setEditMode('draw');
              }}
            >
              Add New Zone
            </Button>
          </Paper>

          {/* Zone Properties */}
          {selectedZone && (
            <Paper elevation={1} sx={{ p: 2, backgroundColor: '#16213e' }}>
              <Typography variant="subtitle2" gutterBottom>
                Zone Properties
              </Typography>

              <TextField
                fullWidth
                size="small"
                label="Zone Name"
                value={selectedZone.name}
                onChange={(e) => updateZoneProperty('name', e.target.value)}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Zone Type</InputLabel>
                <Select
                  value={selectedZone.type}
                  onChange={(e) => updateZoneProperty('type', e.target.value)}
                >
                  <MenuItem value="red">Red - Critical</MenuItem>
                  <MenuItem value="yellow">Yellow - Warning</MenuItem>
                  <MenuItem value="restricted">Restricted - No LRAD</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="caption" display="block" gutterBottom>
                Day SPL Limit: {selectedZone.properties.day_spl} dB
              </Typography>
              <Slider
                value={selectedZone.properties.day_spl}
                onChange={(_, v) => updateZoneProperty('properties.day_spl', v)}
                min={70}
                max={120}
                marks={[
                  { value: 80, label: '80' },
                  { value: 95, label: '95' },
                  { value: 110, label: '110' }
                ]}
                sx={{ mb: 2 }}
              />

              <Typography variant="caption" display="block" gutterBottom>
                Night SPL Limit: {selectedZone.properties.night_spl} dB
              </Typography>
              <Slider
                value={selectedZone.properties.night_spl}
                onChange={(_, v) => updateZoneProperty('properties.night_spl', v)}
                min={70}
                max={120}
                marks={[
                  { value: 75, label: '75' },
                  { value: 85, label: '85' },
                  { value: 95, label: '95' }
                ]}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedZone.properties.auto_response}
                      onChange={(e) => updateZoneProperty('properties.auto_response', e.target.checked)}
                    />
                  }
                  label="Auto-Response Enabled"
                />
              </FormControl>

              <Typography variant="caption" display="block" gutterBottom>
                Zone Color
              </Typography>
              <HexColorPicker
                color={selectedZone.properties.color}
                onChange={(color) => updateZoneProperty('properties.color', color)}
                style={{ width: '100%', height: 150, marginBottom: 16 }}
              />

              <Typography variant="caption" display="block" gutterBottom>
                Opacity: {(selectedZone.properties.opacity * 100).toFixed(0)}%
              </Typography>
              <Slider
                value={selectedZone.properties.opacity}
                onChange={(_, v) => updateZoneProperty('properties.opacity', v)}
                min={0.1}
                max={0.8}
                step={0.1}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => {
                    selectedZone.polygon.remove();
                    setZones(prev => prev.filter(z => z.id !== selectedZone.id));
                    setSelectedZone(null);
                  }}
                >
                  Delete Zone
                </Button>
                
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={() => {
                    // Save to backend
                    console.log('Saving zone:', selectedZone);
                  }}
                >
                  Save
                </Button>
              </Box>
            </Paper>
          )}

          {/* Coverage Analysis */}
          <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: '#16213e' }}>
            <Typography variant="subtitle2" gutterBottom>
              Coverage Analysis
            </Typography>
            
            {selectedZone && (
              <Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Zone Area: {calculateZoneArea(selectedZone)} m²
                </Alert>
                
                {lradDevices.map(device => {
                  const coverage = calculateLRADCoverage(device, selectedZone);
                  return (
                    <Box key={device.id} sx={{ mb: 1 }}>
                      <Typography variant="caption">
                        {device.id} Coverage
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {coverage.map(c => (
                          <Chip
                            key={c.spl}
                            label={`${c.spl}dB: ${c.percentage.toFixed(0)}%`}
                            size="small"
                            color={c.percentage > 50 ? 'success' : 'default'}
                          />
                        ))}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Box>
      </Drawer>

      {/* Status Bar */}
      <Paper className="status-bar" elevation={2}>
        <Typography variant="caption">
          Mode: {editMode.toUpperCase()} | 
          Zones: {zones.length} | 
          Selected: {selectedZone?.name || 'None'} |
          Coordinates: {mapRef.current?.getCenter().lat.toFixed(4)}, {mapRef.current?.getCenter().lng.toFixed(4)}
        </Typography>
      </Paper>
    </Box>
  );
};

// Helper functions
const calculateZoneArea = (zone: Zone): number => {
  const coords = zone.polygon.getLatLngs()[0];
  const polygon = turf.polygon([coords.map(ll => [ll.lng, ll.lat])]);
  return turf.area(polygon);
};

const calculateLRADCoverage = (device: LRADDevice, zone: Zone) => {
  const zoneCoords = zone.polygon.getLatLngs()[0];
  const zonePolygon = turf.polygon([zoneCoords.map(ll => [ll.lng, ll.lat])]);
  
  const coverageData = [
    { spl: 120, radius: 50 },
    { spl: 110, radius: 100 },
    { spl: 95, radius: 200 },
    { spl: 85, radius: 300 },
    { spl: 75, radius: 500 }
  ];

  return coverageData.map(coverage => {
    const circle = turf.circle(device.position, coverage.radius, { units: 'meters' });
    const intersection = turf.intersect(zonePolygon, circle);
    const percentage = intersection 
      ? (turf.area(intersection) / turf.area(zonePolygon)) * 100 
      : 0;
    
    return {
      spl: coverage.spl,
      percentage
    };
  });
};

// CSS Styles (InteractiveZoneEditor.css)
const styles = `
.zone-editor-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.zone-map {
  width: 100%;
  height: 100%;
  background: #0a0a0a;
}

.floating-toolbar {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 8px;
}

.zone-sidebar {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.status-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 16px;
  background: rgba(26, 26, 46, 0.95);
  backdrop-filter: blur(10px);
  z-index: 999;
}

.lrad-marker {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

.zone-label {
  background: rgba(0, 0, 0, 0.7) !important;
  border: 1px solid currentColor !important;
  font-size: 11px !important;
  font-weight: bold !important;
}

/* Leaflet PM custom styling */
.leaflet-pm-toolbar {
  background: rgba(26, 26, 46, 0.95) !important;
  border-radius: 4px !important;
}

.leaflet-pm-icon {
  color: #00ffff !important;
}
`;