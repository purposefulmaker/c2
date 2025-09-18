# C2 Platform - Supabase + Vercel Edition

## Why This is 100x Better

- **Supabase Realtime**: WebSocket built-in, no Bun server needed!
- **PostGIS**: Already in Supabase, spatial queries ready!
- **Edge Functions**: Deno-based, faster than Node!
- **Vector Embeddings**: For ML detection built-in!
- **Auth**: Already there, JWT handled!
- **Storage**: For camera snapshots!
- **Vercel**: Auto-scaling, edge deployment, zero config!

## Complete Setup (10 Minutes!)

### 1. Create Supabase Project

```sql
-- Go to supabase.com, create project, then run this in SQL Editor:

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Zones table with spatial data
CREATE TABLE zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('red', 'yellow', 'restricted')),
    polygon GEOMETRY(Polygon, 4326) NOT NULL,
    day_spl INTEGER DEFAULT 95,
    night_spl INTEGER DEFAULT 85,
    auto_response BOOLEAN DEFAULT false,
    site_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table with realtime
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- gunshot, thermal, fence_cut
    source TEXT, -- boomerang, camera, sensor
    confidence FLOAT,
    location GEOMETRY(Point, 4326),
    zone_id UUID REFERENCES zones(id),
    metadata JSONB,
    response JSONB,
    acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cameras table
CREATE TABLE cameras (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address INET,
    rtsp_url TEXT,
    ptz_enabled BOOLEAN DEFAULT false,
    location GEOMETRY(Point, 4326),
    status TEXT DEFAULT 'online',
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LRAD devices
CREATE TABLE lrad_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location GEOMETRY(Point, 4326),
    max_spl INTEGER DEFAULT 162,
    coverage_zones JSONB, -- Array of coverage polygons at different SPLs
    status TEXT DEFAULT 'ready',
    last_activation TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Response logs
CREATE TABLE responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id),
    action TEXT, -- lrad_activate, ptz_track, alert_sent
    device_id UUID,
    parameters JSONB,
    success BOOLEAN DEFAULT true,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_zones_polygon ON zones USING GIST(polygon);
CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE INDEX idx_events_type ON events(type);

-- Enable Row Level Security
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE lrad_devices ENABLE ROW LEVEL SECURITY;

-- Policies (adjust for your auth needs)
CREATE POLICY "Public read" ON zones FOR SELECT USING (true);
CREATE POLICY "Public read" ON events FOR SELECT USING (true);
CREATE POLICY "Public read" ON cameras FOR SELECT USING (true);
CREATE POLICY "Authenticated write" ON events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Function to check which zone a point is in
CREATE OR REPLACE FUNCTION get_zone_for_point(lat FLOAT, lng FLOAT)
RETURNS TABLE (
    zone_id UUID,
    zone_name TEXT,
    zone_type TEXT,
    day_spl INTEGER,
    night_spl INTEGER,
    auto_response BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        z.id,
        z.name,
        z.type,
        z.day_spl,
        z.night_spl,
        z.auto_response
    FROM zones z
    WHERE ST_Contains(z.polygon, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
    ORDER BY 
        CASE z.type 
            WHEN 'red' THEN 1 
            WHEN 'yellow' THEN 2 
            ELSE 3 
        END
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for auto-response
CREATE OR REPLACE FUNCTION process_new_event()
RETURNS TRIGGER AS $$
DECLARE
    zone_info RECORD;
BEGIN
    -- Get zone info for event location
    IF NEW.location IS NOT NULL THEN
        SELECT * INTO zone_info 
        FROM get_zone_for_point(
            ST_Y(NEW.location::geometry),
            ST_X(NEW.location::geometry)
        );
        
        -- Update event with zone info
        NEW.zone_id = zone_info.zone_id;
        
        -- Auto-response logic
        IF zone_info.auto_response AND NEW.confidence > 0.8 THEN
            -- Insert auto-response (Edge Function will handle actual execution)
            INSERT INTO responses (event_id, action, parameters)
            VALUES (
                NEW.id, 
                'auto_lrad',
                jsonb_build_object(
                    'duration', 10,
                    'spl', zone_info.day_spl,
                    'pattern', 'deterrent'
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_new_event
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION process_new_event();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
ALTER PUBLICATION supabase_realtime ADD TABLE cameras;

-- Insert sample data
INSERT INTO zones (name, type, polygon, day_spl, night_spl, auto_response) VALUES
('Red Zone - Critical', 'red', 
 ST_GeomFromText('POLYGON((-122.42 37.77, -122.41 37.77, -122.41 37.78, -122.42 37.78, -122.42 37.77))', 4326),
 95, 85, true),
('Yellow Zone - Warning', 'yellow',
 ST_GeomFromText('POLYGON((-122.43 37.76, -122.42 37.76, -122.42 37.77, -122.43 37.77, -122.43 37.76))', 4326),
 90, 80, false);

INSERT INTO cameras (name, ip_address, rtsp_url, ptz_enabled, location) VALUES
('North Gate', '192.168.1.100', 'rtsp://admin:pass@192.168.1.100:554/stream', true,
 ST_SetSRID(ST_MakePoint(-122.415, 37.775), 4326)),
('South Fence', '192.168.1.101', 'rtsp://admin:pass@192.168.1.101:554/stream', false,
 ST_SetSRID(ST_MakePoint(-122.416, 37.774), 4326));
```

### 2. Edge Functions for Device Integration

```typescript
// supabase/functions/boomerang-webhook/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'POST') {
    const data = await req.json()
    
    // Process Boomerang gunshot event
    const event = {
      type: 'gunshot',
      source: 'boomerang',
      confidence: data.confidence,
      location: `POINT(${data.longitude} ${data.latitude})`,
      metadata: {
        device_id: data.device_id,
        audio_signature: data.audio_signature,
        classification: data.classification,
        direction: data.direction,
        distance_m: data.distance
      }
    }
    
    // Insert event (trigger will handle zone check and auto-response)
    const { data: newEvent, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single()
    
    if (error) {
      return new Response(JSON.stringify({ error }), { status: 400 })
    }
    
    // Broadcast to all clients via Realtime
    await supabase.channel('events')
      .send({
        type: 'broadcast',
        event: 'new_event',
        payload: newEvent
      })
    
    return new Response(JSON.stringify(newEvent), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  return new Response('Method not allowed', { status: 405 })
})

// Deploy with:
// supabase functions deploy boomerang-webhook
```

```typescript
// supabase/functions/lrad-control/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const { action, duration, pattern, spl } = await req.json()
  
  if (action === 'activate') {
    // In production, this would control actual LRAD via Modbus/Serial
    // For now, simulate activation
    
    console.log(`LRAD Activation: ${pattern} @ ${spl}dB for ${duration}s`)
    
    // Log activation
    const { error } = await supabase
      .from('responses')
      .insert({
        action: 'lrad_activated',
        parameters: { duration, pattern, spl },
        success: true
      })
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, duration * 1000))
    
    return new Response(JSON.stringify({ 
      status: 'completed',
      duration,
      pattern,
      spl 
    }))
  }
  
  return new Response('Invalid action', { status: 400 })
})
```

### 3. Next.js App on Vercel

```bash
npx create-next-app@latest c2-platform --typescript --tailwind --app
cd c2-platform
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs leaflet react-leaflet
```

```typescript
// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [events, setEvents] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [cameras, setCameras] = useState<any[]>([])

  useEffect(() => {
    // Fetch initial data
    fetchZones()
    fetchCameras()
    fetchRecentEvents()

    // Subscribe to realtime events
    const channel = supabase
      .channel('events-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          console.log('New event:', payload.new)
          setEvents(prev => [payload.new, ...prev].slice(0, 100))
          
          // Show notification
          if (payload.new.type === 'gunshot' && payload.new.confidence > 0.8) {
            showAlert(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'responses' },
        (payload) => {
          console.log('Auto-response triggered:', payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchZones = async () => {
    const { data } = await supabase
      .from('zones')
      .select('*')
    setZones(data || [])
  }

  const fetchCameras = async () => {
    const { data } = await supabase
      .from('cameras')
      .select('*')
    setCameras(data || [])
  }

  const fetchRecentEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setEvents(data || [])
  }

  const triggerLRAD = async (event: any) => {
    const { data, error } = await supabase.functions.invoke('lrad-control', {
      body: {
        action: 'activate',
        duration: 10,
        pattern: 'deterrent',
        spl: 95
      }
    })
    
    if (!error) {
      console.log('LRAD activated:', data)
    }
  }

  const showAlert = (event: any) => {
    // Use native notification API
    if (Notification.permission === 'granted') {
      new Notification('🚨 Security Alert', {
        body: `${event.type.toUpperCase()} detected with ${(event.confidence * 100).toFixed(0)}% confidence`,
        icon: '/logo.png'
      })
    }
  }

  return (
    <div className="h-screen bg-slate-900 text-white">
      <div className="grid grid-cols-12 gap-4 h-full p-4">
        {/* Map - 8 columns */}
        <div className="col-span-8 bg-slate-800 rounded-lg overflow-hidden">
          <Map zones={zones} events={events} cameras={cameras} />
        </div>

        {/* Side Panel - 4 columns */}
        <div className="col-span-4 space-y-4">
          {/* Stats */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">System Status</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-cyan-400">
                  {events.filter(e => !e.acknowledged).length}
                </div>
                <div className="text-xs text-gray-400">Active Alerts</div>
              </div>
              <div className="bg-slate-700 p-3 rounded">
                <div className="text-2xl font-bold text-green-400">
                  {cameras.filter(c => c.status === 'online').length}/{cameras.length}
                </div>
                <div className="text-xs text-gray-400">Cameras Online</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">Quick Response</h2>
            <div className="space-y-2">
              <button
                onClick={() => triggerLRAD(events[0])}
                className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
              >
                🔊 Activate LRAD
              </button>
              <button className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
                📹 Track with PTZ
              </button>
              <button className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded">
                🚨 Alert Security
              </button>
            </div>
          </div>

          {/* Event Feed */}
          <div className="bg-slate-800 rounded-lg p-4 flex-1 overflow-auto">
            <h2 className="text-xl font-bold mb-2">Recent Events</h2>
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`p-3 rounded border-l-4 ${
                    event.type === 'gunshot' 
                      ? 'border-red-500 bg-red-900/20' 
                      : 'border-yellow-500 bg-yellow-900/20'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-semibold">{event.type.toUpperCase()}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">
                    Confidence: {(event.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (one command!)
vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL = your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

## Why This is SO Much Better

### Supabase Gives You:
- **Realtime WebSockets** - No Bun server needed!
- **PostGIS** - Spatial queries built-in!
- **Edge Functions** - Serverless, auto-scaling!
- **Auth** - User management done!
- **Storage** - For camera snapshots!
- **Vector embeddings** - For ML detection!
- **Database triggers** - Auto-response logic!

### Vercel Gives You:
- **Edge deployment** - Global CDN!
- **Auto-scaling** - No DevOps!
- **Preview deployments** - Test every PR!
- **Analytics** - Built-in monitoring!

## Total Setup Time: 15 Minutes!

1. Create Supabase project (2 min)
2. Run SQL schema (1 min)
3. Deploy Edge Functions (2 min)
4. Create Next.js app (5 min)
5. Deploy to Vercel (5 min)

## Cost: Almost FREE!

- **Supabase Free Tier**: 500MB database, 2GB bandwidth, 50K Edge Function invocations
- **Vercel Free Tier**: Unlimited deployments, 100GB bandwidth
- **Total**: $0/month for development, ~$25/month for production

## Bonus: Add Langflow for Visual Automation

Instead of Node-RED, use Langflow:

```python
# Deploy Langflow on Vercel Edge Functions
# Create flows visually that connect to Supabase

from langflow import Flow

flow = Flow()
flow.add_node("Supabase Trigger", table="events", filter="type=gunshot")
flow.add_node("Check Zone", function="get_zone_for_point")
flow.add_node("LRAD Response", condition="zone=red AND confidence>0.9")
flow.deploy()
```

## This is the Way

No Docker, no Kubernetes, no DevOps bullshit. Just:

1. **Supabase** for backend
2. **Vercel** for frontend
3. **Done**

Want me to:
- Set up the Supabase project for you?
- Create the complete Next.js app?
- Add Stripe for billing?
- Integrate Twilio for SMS alerts?

This is how modern apps are built! 🚀
