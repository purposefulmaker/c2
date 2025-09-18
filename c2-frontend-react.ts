// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './hooks/useAuth';
import './App.css';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff6b6b',
    },
    secondary: {
      main: '#4ecdc4',
    },
    background: {
      default: '#0a0e27',
      paper: '#1a1f3a',
    },
  },
});

function App() {
  const { isConnected, lastMessage } = useWebSocket();
  const { user, login } = useAuth();

  useEffect(() => {
    // Auto-login for demo
    if (!user) {
      login('admin@pgne.com', 'demo');
    }
  }, []);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Toaster position="top-right" />
      <div className="App">
        <Dashboard isConnected={isConnected} lastMessage={lastMessage} />
      </div>
    </ThemeProvider>
  );
}

export default App;

// frontend/src/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Security,
  WifiTethering,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import Map from './Map';
import EventFeed from './EventFeed';
import DevicePanel from './DevicePanel';
import VideoGrid from './VideoGrid';
import ResponsePanel from './ResponsePanel';
import StatsPanel from './StatsPanel';

interface DashboardProps {
  isConnected: boolean;
  lastMessage: any;
}

const Dashboard: React.FC<DashboardProps> = ({ isConnected, lastMessage }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    // Handle incoming WebSocket messages
    if (lastMessage) {
      if (lastMessage.type === 'gunshot_detection') {
        setEvents(prev => [lastMessage.data, ...prev].slice(0, 100));
      }
    }
  }, [lastMessage]);

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <Security sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            C2 Perimeter Security
          </Typography>
          <Chip
            icon={isConnected ? <CheckCircle /> : <WifiTethering />}
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            size="small"
          />
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* Left Column - Map */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ height: '60vh', p: 1 }}>
              <Map events={events} devices={devices} onEventClick={setSelectedEvent} />
            </Paper>
            
            {/* Video Grid Below Map */}
            <Paper sx={{ mt: 2, height: '30vh', p: 1 }}>
              <VideoGrid />
            </Paper>
          </Grid>

          {/* Right Column - Controls & Feed */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              {/* Stats */}
              <Grid item xs={12}>
                <StatsPanel events={events} />
              </Grid>

              {/* Response Controls */}
              <Grid item xs={12}>
                <ResponsePanel selectedEvent={selectedEvent} />
              </Grid>

              {/* Event Feed */}
              <Grid item xs={12}>
                <Paper sx={{ height: '40vh', overflow: 'auto' }}>
                  <EventFeed events={events} onEventSelect={setSelectedEvent} />
                </Paper>
              </Grid>

              {/* Device Status */}
              <Grid item xs={12}>
                <DevicePanel devices={devices} />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;

// frontend/src/components/Map.tsx
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  events: any[];
  devices: any[];
  onEventClick: (event: any) => void;
}

const Map: React.FC<MapProps> = ({ events, devices, onEventClick }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    // Initialize map
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([37.7749, -122.4194], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapRef.current);

      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Update event markers
    if (markersRef.current && mapRef.current) {
      markersRef.current.clearLayers();

      events.forEach(event => {
        if (event.location) {
          const icon = L.divIcon({
            className: `event-marker event-${event.type}`,
            html: `<div class="pulse"></div>`,
            iconSize: [20, 20],
          });

          const marker = L.marker([event.location.lat, event.location.lon], { icon })
            .addTo(markersRef.current!);

          marker.on('click', () => onEventClick(event));

          // Add popup
          marker.bindPopup(`
            <strong>${event.type}</strong><br/>
            Confidence: ${(event.confidence * 100).toFixed(0)}%<br/>
            Time: ${new Date(event.timestamp).toLocaleTimeString()}
          `);
        }
      });
    }
  }, [events, onEventClick]);

  return <div id="map" style={{ height: '100%', width: '100%' }} />;
};

export default Map;

// frontend/src/components/EventFeed.tsx
import React from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  Warning,
  CameraAlt,
  VolumeUp,
  Security,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface EventFeedProps {
  events: any[];
  onEventSelect: (event: any) => void;
}

const EventFeed: React.FC<EventFeedProps> = ({ events, onEventSelect }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'gunshot':
        return <Warning color="error" />;
      case 'thermal_detection':
        return <CameraAlt color="warning" />;
      case 'fence_cut':
        return <Security color="error" />;
      default:
        return <VolumeUp />;
    }
  };

  const getEventColor = (confidence: number) => {
    if (confidence > 0.9) return 'error';
    if (confidence > 0.7) return 'warning';
    return 'info';
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ p: 2 }}>
        Event Feed
      </Typography>
      <List>
        {events.map((event, index) => (
          <ListItem
            key={event.event_id || index}
            button
            onClick={() => onEventSelect(event)}
            sx={{
              borderLeft: 3,
              borderColor: `${getEventColor(event.confidence)}.main`,
              mb: 1,
            }}
          >
            <ListItemIcon>{getEventIcon(event.type)}</ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2">
                    {event.type.replace('_', ' ').toUpperCase()}
                  </Typography>
                  <Chip
                    label={`${(event.confidence * 100).toFixed(0)}%`}
                    size="small"
                    color={getEventColor(event.confidence)}
                  />
                </Box>
              }
              secondary={
                <>
                  <Typography variant="caption" display="block">
                    {event.device_id} • {format(new Date(event.timestamp), 'HH:mm:ss')}
                  </Typography>
                  {event.classification && (
                    <Typography variant="caption">
                      Type: {event.classification}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default EventFeed;

// frontend/src/components/ResponsePanel.tsx
import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  VolumeUp,
  FlashOn,
  Videocam,
  Warning,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { api } from '../services/api';

interface ResponsePanelProps {
  selectedEvent: any;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({ selectedEvent }) => {
  const [duration, setDuration] = useState(10);
  const [pattern, setPattern] = useState('deterrent');
  const [spl, setSpl] = useState(95);

  const handleLRADActivation = async () => {
    try {
      await api.post('/api/actuators/lrad/activate', {
        duration,
        pattern,
        spl,
      });
      toast.success('LRAD Activated');
    } catch (error) {
      toast.error('Failed to activate LRAD');
    }
  };

  const handleSpotlight = async () => {
    try {
      await api.post('/api/actuators/spotlight/on', {
        target: selectedEvent?.location,
      });
      toast.success('Spotlight Activated');
    } catch (error) {
      toast.error('Failed to activate spotlight');
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Response Controls
      </Typography>

      {selectedEvent && (
        <Box sx={{ mb: 2, p: 1, bgcolor: 'error.dark', borderRadius: 1 }}>
          <Typography variant="caption">
            Active Event: {selectedEvent.type} @ {selectedEvent.device_id}
          </Typography>
        </Box>
      )}

      <Grid container spacing={2}>
        {/* LRAD Controls */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            LRAD System
          </Typography>
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Pattern</InputLabel>
            <Select value={pattern} onChange={(e) => setPattern(e.target.value)}>
              <MenuItem value="deterrent">Deterrent Tone</MenuItem>
              <MenuItem value="voice">Voice Message</MenuItem>
              <MenuItem value="siren">Siren</MenuItem>
              <MenuItem value="alert">Alert Pattern</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption">Duration: {duration}s</Typography>
          <Slider
            value={duration}
            onChange={(_, v) => setDuration(v as number)}
            min={1}
            max={30}
            marks
            sx={{ mb: 2 }}
          />

          <Typography variant="caption">Volume: {spl} dB</Typography>
          <Slider
            value={spl}
            onChange={(_, v) => setSpl(v as number)}
            min={70}
            max={120}
            marks={[
              { value: 80, label: 'Day' },
              { value: 95, label: 'Alert' },
              { value: 120, label: 'Max' },
            ]}
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            color="error"
            startIcon={<VolumeUp />}
            onClick={handleLRADActivation}
            fullWidth
          >
            Activate LRAD
          </Button>
        </Grid>

        {/* Other Controls */}
        <Grid item xs={6}>
          <Button
            variant="outlined"
            startIcon={<FlashOn />}
            onClick={handleSpotlight}
            fullWidth
          >
            Spotlight
          </Button>
        </Grid>

        <Grid item xs={6}>
          <Button
            variant="outlined"
            startIcon={<Videocam />}
            fullWidth
          >
            Track Target
          </Button>
        </Grid>

        <Grid item xs={12}>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<Warning />}
            fullWidth
          >
            Alert Security
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ResponsePanel;

// frontend/src/hooks/useWebSocket.ts
import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export const useWebSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';
    const newSocket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('message', (data) => {
      setLastMessage(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    if (socket) {
      socket.emit('message', { type, data });
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
  };
};