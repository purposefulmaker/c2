Build a comprehensive security command center dashboard for perimeter intrusion detection system with the following features:

## Layout
- Dark theme (background #0a0e27, cards #1a1f3a) with cyan (#00ffff) and red (#ff6b6b) accents
- Persistent left sidebar navigation (collapsible) with icons for: Dashboard, Zone Map, Video Wall, Automation Flows, System Status
- Top app bar with system status badges, notification bell with count, and connection status indicator

## Main Dashboard View
Split screen layout:
- Left 70%: Interactive Leaflet map with:
  - Dark tile layer (Carto dark theme)
  - KML polygon zones overlay with semi-transparent fills (red zones, yellow zones, restricted areas)
  - Pulsing markers for active events (gunshot=red pulse, thermal=orange pulse, fence=yellow pulse)
  - LRAD coverage circles (concentric rings showing dB levels: 120dB, 95dB, 85dB, 75dB)
  - Floating toolbar with: Edit Mode, Draw Zone, Toggle Layers, Grid Toggle, Measure Tool
  - Zone properties panel (slide-in from right) with sliders for: Day SPL (70-120dB), Night SPL (70-120dB), Auto-Response toggle, Color picker, Opacity slider
  - Real-time threat vectors as animated arrows showing direction/distance

- Right 30%: Stacked panels:
  - Event Feed: Scrollable list with timestamp, event type badge (color-coded), confidence percentage, location, action buttons (Acknowledge, Respond, Dismiss)
  - Quick Response Panel: LRAD activation button (red, prominent), Duration slider (1-30s), Pattern selector (Deterrent/Voice/Siren), SPL level slider with zone limit indicator
  - Device Status Grid: Small cards showing online/offline status for Boomerang, Thermal cameras, LRAD systems, Adam relays

## Video Wall View
- Grid layout (auto-adjusting 1x1, 2x2, 3x3, 4x4 based on camera count)
- Each video tile has: Live WebRTC stream, Camera name overlay, PTZ controls on hover (arrows for pan/tilt, +/- for zoom), Fullscreen button, Recording indicator
- Floating camera selector panel to add/remove streams
- Main focused view when clicking any camera with larger display

## Zone Editor View
- Full-screen Leaflet map with drawing tools
- Left panel with zone list (collapsible tree view)
- Each zone shows: Name (editable), Type badge (Red/Yellow/Restricted), Visibility toggle eye icon, Lock icon
- Drawing tools toolbar: Polygon, Rectangle, Circle, Edit vertices, Delete, Undo/Redo
- Real-time area calculation display (m²)
- Coverage analysis panel showing percentage of zone covered by each LRAD at different SPL levels
- Import/Export KML buttons

## Response Automation View
- Embedded iframe showing Node-RED flow editor (http://localhost:1880)
- Top bar with: Save Flow, Deploy, Debug toggle
- Quick templates dropdown for common flows (Gunshot Response, Thermal Tracking, Multi-Zone Correlation)

## System Status View
- Grid of metric cards showing:
  - Events Today (count with sparkline chart)
  - Active Alerts (count, red if > 0)
  - Camera Status (online/total)
  - LRAD Activations (count with last activation time)
  - System Uptime
  - Queue Sizes (Gunshot, Thermal, PTZ queues with color-coded bars)
- DragonflyDB stats (memory usage, operations/sec)
- Container status table (Name, Status, CPU%, Memory, Uptime, Restart button)

## Interactive Features
- WebSocket connection for real-time updates (show "Connected" with green dot or "Disconnected" with red dot)
- All events appear instantly on map with animation
- Clicking any event shows detailed popup with all metadata
- Drag-and-drop zones to reorder in editor
- Right-click context menus on map (Center Here, Measure Distance, Add Marker, Street View)
- Keyboard shortcuts: Space (pause/resume), G (toggle grid), L (toggle layers), Ctrl+Z (undo)
- Toast notifications for critical events (slide in from top-right)

## Data Visualization
- Event timeline at bottom (collapsible) showing 24-hour histogram
- Heatmap overlay toggle showing event density
- Response time metrics (time from detection to response)
- Zone statistics sidebar (events per zone, response effectiveness)

## Responsive Design
- Tablet: Stack panels vertically, maintain map prominence
- Mobile: Bottom tab navigation, swipeable views, simplified controls
- Touch-optimized PTZ controls for mobile

## Colors and Styling
- Red (#ff0000): Critical/alarms
- Orange (#ff6600): Warnings  
- Yellow (#ffff00): Caution
- Cyan (#00ffff): Info/systems
- Green (#00ff00): Safe/online
- Gray (#808080): Offline/restricted
- All panels have subtle backdrop-filter blur effect
- Smooth transitions and micro-animations
- Loading skeletons while data fetches

## Mock Data
Include mock data for:
- 5 zones with different types
- 10 recent events with variety of types
- 4 cameras (2 PTZ, 2 fixed)
- System metrics showing realistic values
- Sample Node-RED flow visible

Use Tailwind CSS, Lucide React icons, Leaflet for maps, Recharts for graphs, and Radix UI for components. Include connection to WebSocket for real-time updates. Add shadcn/ui components for consistent design. Make it production-ready with proper error handling and loading states.