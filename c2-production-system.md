# C2 Production System - Real Implementation

## Project Structure (Production Mirror)

```
c2-system/
├── docker-compose.yml           # Full stack with DragonflyDB
├── bun.lockb                    # Bun package lock
├── package.json                 # Bun dependencies
│
├── kml/                         # Site definitions
│   ├── sites/
│   │   ├── SUB-001/
│   │   │   ├── boundary.kml    # Site perimeter
│   │   │   ├── zones.kml       # Red/Yellow/Restricted zones
│   │   │   ├── coverage.kml    # LRAD SPL coverage areas
│   │   │   └── assets.kml      # Device locations
│   │   └── SUB-002/
│   │       └── ...
│   └── templates/
│       ├── zone_template.kml
│       └── coverage_calculator.kml
│
├── websocket-server/            # Bun WebSocket Server
│   ├── index.ts                # Bun entry point
│   ├── handlers/
│   │   ├── boomerang.ts        # UDP 4001 listener
│   │   ├── thermal.ts          # Webhook receiver
│   │   └── stream.ts           # WebRTC signaling
│   └── cache/
│       └── dragonfly.ts        # DragonflyDB client
│
├── backend/                     # FastAPI + PostGIS
│   ├── main.py
│   ├── kml_parser.py           # KML zone processor
│   ├── spatial_engine.py       # PostGIS queries
│   ├── policy_engine.py        # Zone-based rules
│   └── models/
│       ├── zones.py
│       ├── coverage.py
│       └── events.py
│
├── operator-hud/                # React Operator Interface
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TacticalMap.tsx       # Leaflet + KML
│   │   │   ├── VideoWall.tsx         # WebRTC streams
│   │   │   ├── ThreatOverlay.tsx     # Real-time vectors
│   │   │   ├── ZoneControl.tsx       # SPL management
│   │   │   ├── EventTimeline.tsx     # Temporal view
│   │   │   └── DebugPanel.tsx        # Raw data stream
│   │   ├── layers/
│   │   │   ├── KMLLayer.ts          # KML rendering
│   │   │   ├── HeatmapLayer.ts      # Threat density
│   │   │   ├── CoverageLayer.ts     # LRAD coverage
│   │   │   └── DeviceLayer.ts       # Asset positions
│   │   └── services/
│   │       ├── websocket.ts         # Bun WS client
│   │       ├── webrtc.ts            # Video streaming
│   │       └── kml.ts               # KML loader
│   │
│   └── public/
│       └── assets/
│           ├── icons/               # Device icons
│           └── sounds/              # Alert sounds
│
└── deployment/
    ├── docker-compose.prod.yml
    ├── k8s/                        # Kubernetes manifests
    └── ansible/                    # Site deployment
```

## Docker Compose - Production Stack

```yaml
version: '3.8'

services:
  # DragonflyDB - Redis compatible, faster
  dragonfly:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:latest
    ports:
      - "6380:6379"
    volumes:
      - dragonfly_data:/data
    command: >
      --logtostderr
      --cache_mode=true
      --max_memory=4gb
      --hz=100
      --snapshot_cron="0 */6 * * *"

  # PostgreSQL with PostGIS
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: c2_prod
      POSTGRES_USER: c2_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_EXTENSIONS: postgis,pg_cron,timescaledb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./sql/zones.sql:/docker-entrypoint-initdb.d/02-zones.sql

  # Bun WebSocket Server
  websocket:
    build:
      context: ./websocket-server
      dockerfile: Dockerfile.bun
    ports:
      - "8080:8080"      # WebSocket
      - "4001:4001/udp"  # Boomerang UDP
      - "8081:8081"      # Thermal webhooks
    environment:
      DRAGONFLY_URL: redis://dragonfly:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      - dragonfly
    volumes:
      - ./kml:/app/kml:ro

  # FastAPI Backend
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://c2_user:${DB_PASSWORD}@postgres/c2_prod
      DRAGONFLY_URL: redis://dragonfly:6379
      KML_PATH: /app/kml
    depends_on:
      - postgres
      - dragonfly
    volumes:
      - ./kml:/app/kml:ro

  # Operator HUD Frontend
  hud:
    build:
      context: ./operator-hud
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      REACT_APP_WS_URL: ws://localhost:8080
      REACT_APP_API_URL: http://localhost:8000
      REACT_APP_MAPBOX_TOKEN: ${MAPBOX_TOKEN}

  # NGINX for production
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - hud
      - api
      - websocket

volumes:
  postgres_data:
  dragonfly_data:
```

## Bun WebSocket Server Implementation

```typescript
// websocket-server/index.ts
import { serve, ServerWebSocket } from "bun";
import { createClient } from "redis";
import { handleBoomerangUDP } from "./handlers/boomerang";
import { handleThermalWebhook } from "./handlers/thermal";
import { KMLZoneEngine } from "./spatial/kml-engine";

// DragonflyDB client
const dragonfly = createClient({
  url: process.env.DRAGONFLY_URL || "redis://localhost:6379",
});

await dragonfly.connect();

// Zone engine with KML
const zoneEngine = new KMLZoneEngine("/app/kml");
await zoneEngine.loadSiteKML(process.env.SITE_ID || "SUB-001");

// WebSocket clients
const clients = new Map<string, ServerWebSocket>();

// Bun WebSocket Server
const server = serve({
  port: 8080,
  
  fetch(req, server) {
    // Upgrade to WebSocket
    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req);
      if (!success) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return;
    }

    // Handle HTTP webhooks
    const url = new URL(req.url);
    
    if (url.pathname === "/webhook/thermal" && req.method === "POST") {
      return handleThermalWebhook(req, dragonfly, clients);
    }

    return new Response("C2 WebSocket Server", { status: 200 });
  },

  websocket: {
    open(ws) {
      const id = crypto.randomUUID();
      ws.data = { id };
      clients.set(id, ws);
      
      console.log(`Client connected: ${id}`);
      
      // Send initial zone data
      ws.send(JSON.stringify({
        type: "zones",
        data: zoneEngine.getZones()
      }));
    },

    message(ws, message) {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case "subscribe":
          ws.data.subscriptions = data.channels;
          break;
          
        case "command":
          handleOperatorCommand(data, ws);
          break;
          
        case "webrtc":
          handleWebRTCSignaling(data, ws);
          break;
      }
    },

    close(ws) {
      const id = ws.data.id;
      clients.delete(id);
      console.log(`Client disconnected: ${id}`);
    }
  }
});

// UDP listener for Boomerang
const udpSocket = Bun.udpSocket({
  port: 4001,
  handler: {
    data(socket, buf, port, addr) {
      handleBoomerangUDP(buf, addr, dragonfly, clients, zoneEngine);
    }
  }
});

console.log(`C2 WebSocket Server running on :${server.port}`);

// websocket-server/handlers/boomerang.ts
export async function handleBoomerangUDP(
  buffer: Buffer,
  addr: string,
  cache: any,
  clients: Map<string, any>,
  zoneEngine: any
) {
  // Parse Boomerang protocol
  const event = parseBoomerangPacket(buffer);
  
  // Check which zone the gunshot is in
  const zone = zoneEngine.getZoneForPoint(event.lat, event.lon);
  
  // Get LRAD coverage for this point
  const coverage = zoneEngine.getLRADCoverage(event.lat, event.lon);
  
  // Determine response based on zone
  const response = determineResponse(zone, coverage, event);
  
  // Cache event
  await cache.set(`event:${event.id}`, JSON.stringify(event), "EX", 3600);
  
  // Broadcast to all clients
  const message = {
    type: "gunshot",
    data: {
      ...event,
      zone: zone?.name,
      coverage: coverage?.spl,
      response: response
    }
  };
  
  for (const [id, client] of clients) {
    client.send(JSON.stringify(message));
  }
  
  // Auto-trigger LRAD if in red zone
  if (zone?.type === "red" && coverage?.spl >= 95) {
    await triggerLRAD(response);
  }
}

// websocket-server/spatial/kml-engine.ts
import { parseKML } from "@tmcw/togeojson";
import * as turf from "@turf/turf";

export class KMLZoneEngine {
  private zones: Map<string, any> = new Map();
  private coverage: Map<string, any> = new Map();
  private boundary: any;
  
  async loadSiteKML(siteId: string) {
    // Load boundary
    const boundaryKML = await Bun.file(`${this.basePath}/${siteId}/boundary.kml`).text();
    this.boundary = this.parseKMLToGeoJSON(boundaryKML);
    
    // Load zones
    const zonesKML = await Bun.file(`${this.basePath}/${siteId}/zones.kml`).text();
    const zonesGeoJSON = this.parseKMLToGeoJSON(zonesKML);
    
    for (const feature of zonesGeoJSON.features) {
      this.zones.set(feature.properties.name, {
        ...feature,
        polygon: turf.polygon(feature.geometry.coordinates)
      });
    }
    
    // Load LRAD coverage
    const coverageKML = await Bun.file(`${this.basePath}/${siteId}/coverage.kml`).text();
    const coverageGeoJSON = this.parseKMLToGeoJSON(coverageKML);
    
    for (const feature of coverageGeoJSON.features) {
      const spl = parseInt(feature.properties.spl);
      this.coverage.set(`spl_${spl}`, {
        ...feature,
        polygon: turf.polygon(feature.geometry.coordinates)
      });
    }
  }
  
  getZoneForPoint(lat: number, lon: number): any {
    const point = turf.point([lon, lat]);
    
    // Check each zone
    for (const [name, zone] of this.zones) {
      if (turf.booleanPointInPolygon(point, zone.polygon)) {
        return {
          name,
          type: zone.properties.type,
          restrictions: zone.properties.restrictions
        };
      }
    }
    
    return null;
  }
  
  getLRADCoverage(lat: number, lon: number): any {
    const point = turf.point([lon, lat]);
    
    // Check coverage levels (highest SPL first)
    for (let spl = 120; spl >= 70; spl -= 5) {
      const coverage = this.coverage.get(`spl_${spl}`);
      if (coverage && turf.booleanPointInPolygon(point, coverage.polygon)) {
        return { spl, effective: true };
      }
    }
    
    return { spl: 0, effective: false };
  }
}
```

## KML Files Structure

```xml
<!-- kml/sites/SUB-001/zones.kml -->
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SUB-001 Security Zones</name>
    
    <!-- Red Zone - Immediate Response -->
    <Placemark>
      <name>Red Zone</name>
      <ExtendedData>
        <Data name="type"><value>red</value></Data>
        <Data name="day_spl"><value>95</value></Data>
        <Data name="night_spl"><value>85</value></Data>
        <Data name="auto_response"><value>true</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -122.4194,37.7749,0
              -122.4184,37.7749,0
              -122.4184,37.7759,0
              -122.4194,37.7759,0
              -122.4194,37.7749,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    
    <!-- Yellow Zone - Alert Only -->
    <Placemark>
      <name>Yellow Zone</name>
      <ExtendedData>
        <Data name="type"><value>yellow</value></Data>
        <Data name="day_spl"><value>90</value></Data>
        <Data name="night_spl"><value>80</value></Data>
        <Data name="auto_response"><value>false</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -122.4204,37.7739,0
              -122.4174,37.7739,0
              -122.4174,37.7769,0
              -122.4204,37.7769,0
              -122.4204,37.7739,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    
    <!-- Restricted Zone - No LRAD -->
    <Placemark>
      <name>Restricted Zone</name>
      <ExtendedData>
        <Data name="type"><value>restricted</value></Data>
        <Data name="lrad_enabled"><value>false</value></Data>
        <Data name="reason"><value>residential</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -122.4214,37.7729,0
              -122.4204,37.7729,0
              -122.4204,37.7739,0
              -122.4214,37.7739,0
              -122.4214,37.7729,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>

<!-- kml/sites/SUB-001/coverage.kml -->
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>LRAD Coverage Areas</name>
    
    <!-- 120 dB Coverage -->
    <Placemark>
      <name>120dB Coverage</name>
      <ExtendedData>
        <Data name="spl"><value>120</value></Data>
        <Data name="range_m"><value>50</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              <!-- Circle around LRAD position -->
              -122.4189,37.7754,0
              -122.4188,37.7755,0
              -122.4187,37.7754,0
              -122.4188,37.7753,0
              -122.4189,37.7754,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
    
    <!-- 95 dB Coverage -->
    <Placemark>
      <name>95dB Coverage</name>
      <ExtendedData>
        <Data name="spl"><value>95</value></Data>
        <Data name="range_m"><value>300</value></Data>
      </ExtendedData>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              <!-- Larger circle -->
              -122.4194,37.7749,0
              -122.4184,37.7749,0
              -122.4184,37.7759,0
              -122.4194,37.7759,0
              -122.4194,37.7749,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
```

## Operator HUD - React Frontend

```typescript
// operator-hud/src/components/TacticalMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { kml } from '@tmcw/togeojson';
import 'leaflet/dist/leaflet.css';
import './TacticalMap.css';

interface TacticalMapProps {
  events: any[];
  zones: any;
  onZoneEdit?: (zone: any) => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({ 
  events, 
  zones,
  onZoneEdit 
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const eventsLayerRef = useRef<L.LayerGroup | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map with tactical style
      mapRef.current = L.map('tactical-map', {
        zoomControl: false,
        attributionControl: false,
      }).setView([37.7749, -122.4194], 16);

      // Dark tactical tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);

      // Layer groups
      zonesLayerRef.current = L.layerGroup().addTo(mapRef.current);
      coverageLayerRef.current = L.layerGroup().addTo(mapRef.current);
      eventsLayerRef.current = L.layerGroup().addTo(mapRef.current);

      // Add drawing controls
      mapRef.current.pm.addControls({
        position: 'topleft',
        drawCircle: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
      });

      // Load KML zones
      loadKMLZones();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const loadKMLZones = async () => {
    try {
      // Fetch site KML
      const response = await fetch('/api/kml/current-site');
      const kmlData = await response.json();

      // Parse and render zones
      renderZones(kmlData.zones);
      renderCoverage(kmlData.coverage);
      renderAssets(kmlData.assets);
    } catch (error) {
      console.error('Failed to load KML:', error);
    }
  };

  const renderZones = (zonesGeoJSON: any) => {
    if (!zonesLayerRef.current) return;
    zonesLayerRef.current.clearLayers();

    zonesGeoJSON.features.forEach((feature: any) => {
      const style = getZoneStyle(feature.properties.type);
      
      const layer = L.geoJSON(feature, {
        style,
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(feature.properties.name, {
            permanent: true,
            direction: 'center',
            className: 'zone-label'
          });

          // Enable editing in edit mode
          if (editMode) {
            layer.on('pm:edit', (e) => {
              onZoneEdit?.(e.layer.toGeoJSON());
            });
          }
        }
      }).addTo(zonesLayerRef.current!);
    });
  };

  const getZoneStyle = (type: string) => {
    switch (type) {
      case 'red':
        return {
          fillColor: '#ff0000',
          fillOpacity: 0.2,
          color: '#ff0000',
          weight: 2,
          dashArray: '5, 5'
        };
      case 'yellow':
        return {
          fillColor: '#ffff00',
          fillOpacity: 0.15,
          color: '#ffff00',
          weight: 2,
          dashArray: '10, 5'
        };
      case 'restricted':
        return {
          fillColor: '#808080',
          fillOpacity: 0.3,
          color: '#808080',
          weight: 1,
          dashArray: '2, 8'
        };
      default:
        return {
          fillColor: '#00ff00',
          fillOpacity: 0.1,
          color: '#00ff00',
          weight: 1
        };
    }
  };

  const renderCoverage = (coverageGeoJSON: any) => {
    if (!coverageLayerRef.current) return;
    coverageLayerRef.current.clearLayers();

    coverageGeoJSON.features.forEach((feature: any) => {
      const spl = feature.properties.spl;
      const opacity = Math.max(0.05, (120 - spl) / 100);
      
      L.geoJSON(feature, {
        style: {
          fillColor: '#00ffff',
          fillOpacity: opacity,
          color: '#00ffff',
          weight: 1,
          dashArray: '1, 3'
        }
      }).addTo(coverageLayerRef.current!);
    });
  };

  // Render live events
  useEffect(() => {
    if (!eventsLayerRef.current) return;
    eventsLayerRef.current.clearLayers();

    events.forEach(event => {
      if (event.location) {
        // Threat ring animation
        const pulseIcon = L.divIcon({
          className: 'pulse-icon',
          html: `
            <div class="pulse-ring pulse-${event.type}"></div>
            <div class="pulse-dot"></div>
          `,
          iconSize: [30, 30]
        });

        const marker = L.marker([event.location.lat, event.location.lon], {
          icon: pulseIcon
        }).addTo(eventsLayerRef.current!);

        // Threat vector line
        if (event.direction) {
          const endPoint = calculateEndpoint(
            event.location.lat,
            event.location.lon,
            event.direction,
            event.distance_m || 100
          );

          L.polyline([
            [event.location.lat, event.location.lon],
            endPoint
          ], {
            color: '#ff0000',
            weight: 2,
            opacity: 0.8,
            dashArray: '10, 5'
          }).addTo(eventsLayerRef.current!);
        }

        // Info popup
        marker.bindPopup(`
          <div class="event-popup">
            <h4>${event.type.toUpperCase()}</h4>
            <p>Confidence: ${(event.confidence * 100).toFixed(0)}%</p>
            <p>Zone: ${event.zone || 'Unknown'}</p>
            <p>Coverage: ${event.coverage?.spl || 0} dB</p>
            <button onclick="respondToEvent('${event.id}')">RESPOND</button>
          </div>
        `);
      }
    });
  }, [events]);

  return (
    <div className="tactical-map-container">
      <div id="tactical-map" />
      
      {/* Map Controls Overlay */}
      <div className="map-controls">
        <button 
          className={`control-btn ${editMode ? 'active' : ''}`}
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? 'SAVE ZONES' : 'EDIT ZONES'}
        </button>
        
        <div className="layer-toggles">
          <label>
            <input type="checkbox" defaultChecked /> Zones
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Coverage
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Events
          </label>
          <label>
            <input type="checkbox" /> Heatmap
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-color red"></span> Red Zone (Auto-response)
        </div>
        <div className="legend-item">
          <span className="legend-color yellow"></span> Yellow Zone (Alert)
        </div>
        <div className="legend-item">
          <span className="legend-color gray"></span> Restricted (No LRAD)
        </div>
        <div className="legend-item">
          <span className="legend-color cyan"></span> LRAD Coverage
        </div>
      </div>
    </div>
  );
};

// operator-hud/src/components/VideoWall.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Grid, Paper, IconButton, Box, Typography } from '@mui/material';
import { 
  Fullscreen, 
  VolumeUp, 
  VolumeOff,
  FiberManualRecord,
  GridView
} from '@mui/icons-material';

interface VideoWallProps {
  streams: any[];
}

export const VideoWall: React.FC<VideoWallProps> = ({ streams }) => {
  const [layout, setLayout] = useState<'grid' | 'focus'>('grid');
  const [focusedStream, setFocusedStream] = useState<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    // Initialize WebRTC connections for each stream
    streams.forEach((stream, index) => {
      if (stream.type === 'webrtc') {
        initWebRTC(stream.url, index);
      } else if (stream.type === 'hls') {
        initHLS(stream.url, index);
      }
    });
  }, [streams]);

  const initWebRTC = async (url: string, index: number) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      if (videoRefs.current[index]) {
        videoRefs.current[index]!.srcObject = event.streams[0];
      }
    };

    // Signaling via WebSocket
    const ws = new WebSocket(process.env.REACT_APP_WS_URL!);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'webrtc',
        action: 'subscribe',
        stream: url
      }));
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'offer') {
        await pc.setRemoteDescription(message.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        ws.send(JSON.stringify({
          type: 'webrtc',
          action: 'answer',
          answer
        }));
      } else if (message.type === 'ice') {
        await pc.addIceCandidate(message.candidate);
      }
    };
  };

  const initHLS = (url: string, index: number) => {
    // Use HLS.js for HLS streams
    import('hls.js').then(({ default: Hls }) => {
      if (Hls.isSupported() && videoRefs.current[index]) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(videoRefs.current[index]!);
      }
    });
  };

  const getGridSize = () => {
    const count = streams.length;
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: 4 };
  };

  const { cols, rows } = getGridSize();

  return (
    <Box className="video-wall">
      <Box className="video-wall-header">
        <Typography variant="h6">Live Feeds</Typography>
        <IconButton onClick={() => setLayout(layout === 'grid' ? 'focus' : 'grid')}>
          <GridView />
        </IconButton>
      </Box>

      <Grid container spacing={1} style={{ height: '100%' }}>
        {streams.map((stream, index) => (
          <Grid 
            item 
            xs={layout === 'focus' && focusedStream === index ? 12 : 12 / cols}
            key={stream.id}
            style={{ 
              height: layout === 'focus' && focusedStream === index 
                ? '100%' 
                : `${100 / rows}%` 
            }}
          >
            <Paper className="video-container">
              <video
                ref={el => videoRefs.current[index] = el}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%' }}
              />
              
              <div className="video-overlay">
                <Typography variant="caption">{stream.name}</Typography>
                <Box>
                  <IconButton size="small">
                    <VolumeOff />
                  </IconButton>
                  <IconButton 
                    size="small"
                    onClick={() => setFocusedStream(index)}
                  >
                    <Fullscreen />
                  </IconButton>
                </Box>
              </div>

              {stream.recording && (
                <FiberManualRecord 
                  className="recording-indicator"
                  style={{ color: '#ff0000' }}
                />
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// operator-hud/src/components/DebugPanel.tsx
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Switch, 
  FormControlLabel,
  Tabs,
  Tab,
  TextField
} from '@mui/material';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

export const DebugPanel: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false);
  const [tab, setTab] = useState(0);
  const [wsMessages, setWsMessages] = useState<any[]>([]);
  const [apiCalls, setApiCalls] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>({});

  useEffect(() => {
    // Intercept WebSocket messages
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
      setWsMessages(prev => [...prev, { 
        direction: 'OUT', 
        data: JSON.parse(data),
        timestamp: new Date().toISOString()
      }].slice(-100));
      return originalSend.call(this, data);
    };

    // Intercept fetch calls
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const start = performance.now();
      const response = await originalFetch(...args);
      const duration = performance.now() - start;
      
      setApiCalls(prev => [...prev, {
        url: args[0],
        method: args[1]?.method || 'GET',
        status: response.status,
        duration: duration.toFixed(2),
        timestamp: new Date().toISOString()
      }].slice(-100));
      
      return response;
    };

    // System stats polling
    const interval = setInterval(async () => {
      const stats = await fetch('/api/system/stats').then(r => r.json());
      setSystemStats(stats);
    }, 5000);

    return () => {
      clearInterval(interval);
      WebSocket.prototype.send = originalSend;
      window.fetch = originalFetch;
    };
  }, []);

  if (!showDebug) {
    return (
      <Box 
        sx={{ 
          position: 'fixed', 
          bottom: 20, 
          right: 20,
          zIndex: 9999
        }}
      >
        <FormControlLabel
          control={
            <Switch 
              checked={showDebug} 
              onChange={(e) => setShowDebug(e.target.checked)}
              color="warning"
            />
          }
          label="Debug"
        />
      </Box>
    );
  }

  return (
    <Paper 
      sx={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40vh',
        zIndex: 9998,
        overflow: 'hidden',
        backgroundColor: '#0a0a0a'
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="WebSocket" />
          <Tab label="API Calls" />
          <Tab label="System" />
          <Tab label="Console" />
        </Tabs>
        <IconButton 
          size="small" 
          onClick={() => setShowDebug(false)}
          sx={{ position: 'absolute', right: 10, top: 10 }}
        >
          <Close />
        </IconButton>
      </Box>

      <Box sx={{ p: 2, height: 'calc(100% - 48px)', overflow: 'auto' }}>
        {tab === 0 && (
          <Box>
            {wsMessages.map((msg, i) => (
              <Box key={i} sx={{ mb: 1, fontFamily: 'monospace' }}>
                <Typography variant="caption" color={msg.direction === 'OUT' ? 'primary' : 'secondary'}>
                  [{msg.timestamp}] {msg.direction}
                </Typography>
                <JsonView data={msg.data} style={{ fontSize: '0.8rem' }} />
              </Box>
            ))}
          </Box>
        )}

        {tab === 1 && (
          <Box>
            {apiCalls.map((call, i) => (
              <Box key={i} sx={{ mb: 1, fontFamily: 'monospace' }}>
                <Typography variant="caption">
                  {call.method} {call.url} - {call.status} ({call.duration}ms)
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {tab === 2 && (
          <JsonView data={systemStats} style={{ fontSize: '0.9rem' }} />
        )}

        {tab === 3 && (
          <TextField
            fullWidth
            multiline
            rows={10}
            placeholder="JavaScript console..."
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                try {
                  const result = eval(e.target.value);
                  console.log(result);
                } catch (error) {
                  console.error(error);
                }
              }
            }}
          />
        )}
      </Box>
    </Paper>
  );
};
```

## Deployment Files

```dockerfile
# websocket-server/Dockerfile.bun
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 8080 4001/udp 8081

CMD ["bun", "run", "index.ts"]
```

```yaml
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream websocket {
        server websocket:8080;
    }

    upstream api {
        server api:8000;
    }

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://hud;
        }

        location /ws {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        location /api {
            proxy_pass http://api;
        }

        location /stream {
            proxy_pass http://websocket;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```
