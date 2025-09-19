Alright—here’s the practical, production-ready data model so you can enforce policy, zones, risk, overrides, and audit. Use PostgreSQL + PostGIS for truth; keep Dragonfly only for cache/queues. (Dragonfly ≠ durable event plane.)

Why Postgres (with PostGIS)

Geospatial math (KML polygons, beam cones, intersections) with ST_Intersects, ST_Distance, etc.

ACID + audit + exactly-once with the Outbox pattern.

Easy to tee into Snowflake/RSDP later.

Dragonfly: session cache (active zones TTL, rate limits, “now playing” flags), not your database.

Core schema (DDL you can paste)
-- Enable geo
CREATE EXTENSION IF NOT EXISTS postgis;

-- 0) Sites & devices
CREATE TABLE site (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  srid INT NOT NULL DEFAULT 4326,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'
);

CREATE TYPE device_kind AS ENUM ('lrad','ptz','thermal','acoustic','access','other');

CREATE TABLE device (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  kind device_kind NOT NULL,
  name TEXT NOT NULL,
  ip INET,
  geom GEOMETRY(Point,4326),          -- device location
  azimuth_deg NUMERIC,                -- for LRAD/PTZ
  beam_width_deg NUMERIC,             -- LRAD nominal 30, etc.
  src_spl_dbA_1m NUMERIC,             -- LRAD source SPL reference @1m
  params JSONB DEFAULT '{}'::jsonb,   -- freeform (serial port, model, etc.)
  UNIQUE(site_id,name)
);

-- 1) KML import -> zones
CREATE TYPE zone_kind AS ENUM ('restricted','caution','normal');

CREATE TABLE kml_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT,
  imported_at TIMESTAMPTZ DEFAULT now(),
  raw BYTEA                           -- optional: original KML
);

CREATE TABLE zone (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  kml_source_id UUID REFERENCES kml_source(id),
  name TEXT NOT NULL,
  kind zone_kind NOT NULL,
  geom GEOMETRY(MultiPolygon,4326) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,         -- off by default
  notes TEXT
);
CREATE INDEX zone_gix ON zone USING GIST (geom);

-- Optional: stepped/gradient SPL caps near boundaries
CREATE TABLE zone_cap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zone(id) ON DELETE CASCADE,
  min_dist_m NUMERIC NOT NULL,      -- distance from zone boundary outward
  max_spl_dbA NUMERIC NOT NULL      -- cap to apply at/within this band
);
-- Example rows: (0m->95), (1m->95), (5m->92), etc.

-- 2) Policy model (deny-by-default)
CREATE TABLE policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  deny_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  require_confirm BOOLEAN NOT NULL DEFAULT TRUE,
  max_play_sec INT NOT NULL DEFAULT 10,
  after_hours JSONB DEFAULT '{}'::jsonb,  -- schedule caps/tones/presets
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id,name)
);

CREATE TYPE trigger_type AS ENUM ('thermal','acoustic','access','operator','system');

CREATE TYPE action_type AS ENUM ('none','log','pre_alert','deterrent','ptz_preset','spotlight','dazzler');

CREATE TABLE policy_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policy(id) ON DELETE CASCADE,
  trigger trigger_type NOT NULL,
  min_confidence NUMERIC DEFAULT 0.0,
  min_risk NUMERIC DEFAULT 0.0,
  allowed_kinds zone_kind[] DEFAULT ARRAY['normal','caution']::zone_kind[],
  action_when_met action_type NOT NULL DEFAULT 'pre_alert',
  escalate_on_multi BOOLEAN DEFAULT FALSE,   -- thermal+acoustic within 1s
  params JSONB DEFAULT '{}'::jsonb           -- e.g., { "ptz_preset": "Area-N" }
);

-- 3) Risk matrix (simple, explainable)
CREATE TYPE severity AS ENUM ('info','warning','critical');

CREATE TABLE risk_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  sev severity NOT NULL,
  conf_min NUMERIC NOT NULL,   -- inclusive
  conf_max NUMERIC NOT NULL,   -- exclusive
  base_risk NUMERIC NOT NULL,  -- 0..1 result for this bucket
  default_action action_type NOT NULL
);
-- Add modifiers for context (CIP, after-hours, multi-sensor, inside zone)
CREATE TABLE risk_modifier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  key TEXT NOT NULL,           -- e.g., 'after_hours','cip_14','inside_restricted','multi_sensor'
  delta NUMERIC NOT NULL       -- add/subtract to base_risk (e.g., +0.2, -0.1)
);

-- 4) Events, decisions, actions (with Outbox)
CREATE TABLE event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                   -- thermal-01, boomerang-01
  type trigger_type NOT NULL,
  class TEXT,                             -- gunshot, intrusion, nuisance
  sev severity NOT NULL,
  confidence NUMERIC NOT NULL,
  geom GEOMETRY(Point,4326),              -- where it happened
  bbox JSONB,                             -- optional
  raw JSONB NOT NULL                      -- original payload
);
CREATE INDEX event_site_ts ON event(site_id, ts DESC);
CREATE INDEX event_geo_gix ON event USING GIST (geom);

CREATE TYPE decision_result AS ENUM ('allow','deny');

CREATE TABLE decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES event(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policy(id),
  target_zone_id UUID REFERENCES zone(id),
  intersects_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  boundary_spl_cap NUMERIC,               -- dBA limit applied (if any)
  risk NUMERIC NOT NULL,                  -- 0..1 final score
  result decision_result NOT NULL,
  reason TEXT,
  decided_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES decision(id) ON DELETE CASCADE,
  kind action_type NOT NULL,
  duration_sec INT,
  params JSONB DEFAULT '{}'::jsonb,       -- e.g., { "volume": 70 }
  state TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- 5) Overrides (two-person)
CREATE TABLE override_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES site(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zone(id),
  requested_by TEXT NOT NULL,
  approved_by TEXT,                        -- set when second person approves
  reason_code TEXT NOT NULL,
  max_play_sec INT DEFAULT 10,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,       -- short TTL, e.g., +60s
  status TEXT NOT NULL DEFAULT 'pending'   -- pending/approved/used/expired
);

-- 6) Audit and Outbox
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB
);

CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,                     -- c2.events.enriched, etc.
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX outbox_status ON event_outbox(status, created_at);

How the risk matrix applies (deterministic & explainable)

Step 1: bucket the event
SELECT base_risk, default_action FROM risk_matrix WHERE site_id=? AND sev=? AND confidence >= conf_min AND confidence < conf_max;

Step 2: add context deltas
Sum delta from risk_modifier for facts you detect (examples):

inside_restricted (+0.3)

multi_sensor (+0.2)

after_hours (+0.1)

false_pattern_match (−0.2)

final_risk = clamp(base_risk + Σdelta, 0, 1)

Step 3: compare to rule threshold
Find the policy_rule for this trigger; if final_risk >= min_risk and zone_kind ∈ allowed_kinds and no SPL boundary violation, then action_when_met. Else deny. Record all of this in decision.

This keeps it transparent for auditors and simple for operators.

Beam vs. zone & SPL boundary check (PostGIS)

Build the LRAD cone as a polygon: center = LRAD geom, angle = beam_width_deg, bearing = azimuth_deg, range = configured max.

ST_Intersects(beam_geom, zone.geom) → if true and zone.kind='restricted' → deny unless override.

Compute distance from LRAD to the restricted boundary along the azimuth. Predict SPL at that boundary:

SPL_at_r_m = src_spl_dbA_1m - 20*log10(r_m/1.0) - attenuation


Compare against zone_cap.max_spl_dbA for the appropriate band. If over → deny (or cap volume).

(You can precompute bands; no need for fancy acoustics in POC.)

Where KML fits

Import KML into kml_source, explode to zone rows with geom.

Turn on a zone by setting active=true during POC validation.

Re-import = new kml_source.version; update affected zone rows in a transaction.

Dragonfly vs Postgres (bottom line)

Postgres + PostGIS = source of truth (everything above).

Dragonfly = cache only (e.g., active_zone_ids:site for 60s, now_playing:lrad-01 for 12s, rate-limit buckets).

Event plane = NATS/Redpanda; publish via event_outbox for reliability.

Minimal seed data (examples)
-- Policy thresholds
INSERT INTO policy(site_id,name) VALUES
  ('<SITE>', 'Default Deny');

INSERT INTO policy_rule(policy_id,trigger,min_confidence,min_risk,action_when_met,allowed_kinds)
SELECT id,'thermal',0.60,0.40,'pre_alert',ARRAY['normal','caution'] FROM policy WHERE name='Default Deny';
INSERT INTO policy_rule(policy_id,trigger,min_confidence,min_risk,action_when_met,allowed_kinds,escalate_on_multi)
SELECT id,'acoustic',0.70,0.60,'deterrent',ARRAY['normal'],TRUE FROM policy WHERE name='Default Deny';

-- Risk buckets
INSERT INTO risk_matrix(site_id,sev,conf_min,conf_max,base_risk,default_action) VALUES
('<SITE>','info',0.0,0.5,0.2,'log'),
('<SITE>','warning',0.5,0.8,0.5,'pre_alert'),
('<SITE>','critical',0.8,1.01,0.8,'deterrent');

-- Modifiers
INSERT INTO risk_modifier(site_id,key,delta) VALUES
('<SITE>','inside_restricted',0.3),
('<SITE>','multi_sensor',0.2),
('<SITE>','after_hours',0.1),
('<SITE>','false_pattern_match',-0.2);

What the vendor needs to implement

Policy check API computes:

active zone hit,

restricted intersection,

boundary SPL cap,

risk score + rule threshold.
Writes event, decision, action, and one outbox row.

Outbox relay publishes to the bus (Genetec/SureView/AMAG sinks subscribe).

Override endpoint fills override_token and binds scope (zone, max seconds, expiry).