-- Landed Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (User / Crew Member Info)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  staff_id VARCHAR(50) UNIQUE,
  full_name TEXT NOT NULL,
  role VARCHAR(50), -- e.g. FO, PIC, LD, CA
  base_airport VARCHAR(10), -- e.g. DEL
  aircraft_type VARCHAR(20), -- e.g. 320
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Uploaded Crew Schedules
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  block_hours VARCHAR(20),
  duty_hours VARCHAR(20),
  landings_count INT DEFAULT 0,
  raw_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Parsed Flights (Roster Flight Legs)
CREATE TABLE IF NOT EXISTS flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  flight_number VARCHAR(20) NOT NULL, -- e.g. 6E 6804
  flight_date DATE NOT NULL,
  dep_airport VARCHAR(10) NOT NULL, -- e.g. DEL
  arr_airport VARCHAR(10) NOT NULL, -- e.g. CJB
  std TIME NOT NULL, -- Scheduled Time of Departure
  sta TIME NOT NULL, -- Scheduled Time of Arrival
  actual_dep TIMESTAMP WITH TIME ZONE,
  actual_arr TIMESTAMP WITH TIME ZONE,
  aircraft_type VARCHAR(20), -- e.g. 320
  status VARCHAR(20) DEFAULT 'SCHEDULED', -- SCHEDULED, DEPARTED, LANDED, DELAYED, CANCELLED
  aerodatabox_alert_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Flight Crew (Co-workers assigned to each flight leg)
CREATE TABLE IF NOT EXISTS flight_crew (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
  crew_role VARCHAR(20) NOT NULL, -- PIC, FO, LD, CA
  staff_id VARCHAR(50),
  crew_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Ground Transport / Transfers
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  transfer_type VARCHAR(50) NOT NULL, -- Home to Airport, Airport to Home
  transfer_date DATE NOT NULL,
  transfer_time TIME NOT NULL,
  company VARCHAR(100),
  pickup_drop_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AeroDataBox Webhook Event Logs
CREATE TABLE IF NOT EXISTS aerodatabox_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_type VARCHAR(50),
  flight_number VARCHAR(20),
  status VARCHAR(50),
  payload JSONB NOT NULL
);

-- Enable Realtime on flights and aerodatabox_webhooks
ALTER PUBLICATION supabase_realtime ADD TABLE flights;
ALTER PUBLICATION supabase_realtime ADD TABLE aerodatabox_webhooks;
