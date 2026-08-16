/*
# HitchKaro - College Ride Sharing Platform Schema

## Overview
Creates the full database schema for HitchKaro, a ride-sharing platform for college students.
Students register with their college email, verify identity via ID card + face scan,
then offer or find rides and negotiate prices in a chat room.

## New Tables
- profiles: extends auth.users with student data (name, phone, college, email, id card, face scan, verification status)
- rides: a ride offered by a rider (source, destination, stops, departure, seats, price, vehicle, status)
- ride_requests: a passenger's request to join a ride (seats, offered price, final price, status)
- messages: chat messages between rider and passenger on a request thread (content, optional price proposal)

## Security (RLS)
- profiles: owner-scoped read/insert/update
- rides: anyone authenticated can read; only rider can insert/update/delete their own
- ride_requests: passenger sees own; rider sees requests on their rides; passenger inserts/updates own; rider updates status
- messages: both parties of a request thread can read; only sender inserts
- Storage: private id-cards and face-scans buckets, owner-scoped folders
*/

-- ========== ENUMS ==========
DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('active', 'full', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== PROFILES ==========
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  college_name text NOT NULL DEFAULT '',
  college_email text UNIQUE NOT NULL,
  id_card_url text,
  face_scan_url text,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ========== RIDES ==========
CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  destination text NOT NULL,
  route_stops text[] NOT NULL DEFAULT '{}',
  departure_time timestamptz NOT NULL,
  total_seats int NOT NULL DEFAULT 1 CHECK (total_seats > 0),
  booked_seats int NOT NULL DEFAULT 0 CHECK (booked_seats >= 0),
  price_per_seat numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_per_seat >= 0),
  vehicle_info text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status ride_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rides" ON rides;
CREATE POLICY "select_rides" ON rides FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_ride" ON rides;
CREATE POLICY "insert_own_ride" ON rides FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "update_own_ride" ON rides;
CREATE POLICY "update_own_ride" ON rides FOR UPDATE
  TO authenticated USING (auth.uid() = rider_id) WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "delete_own_ride" ON rides;
CREATE POLICY "delete_own_ride" ON rides FOR DELETE
  TO authenticated USING (auth.uid() = rider_id);

-- ========== RIDE_REQUESTS ==========
CREATE TABLE IF NOT EXISTS ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seats_requested int NOT NULL DEFAULT 1 CHECK (seats_requested > 0),
  offered_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (offered_price >= 0),
  final_price numeric(10,2),
  status request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, passenger_id)
);

ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_requests" ON ride_requests;
CREATE POLICY "select_requests" ON ride_requests FOR SELECT
  TO authenticated USING (
    auth.uid() = passenger_id
    OR EXISTS (SELECT 1 FROM rides WHERE rides.id = ride_requests.ride_id AND rides.rider_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_request" ON ride_requests;
CREATE POLICY "insert_own_request" ON ride_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = passenger_id);

DROP POLICY IF EXISTS "update_requests" ON ride_requests;
CREATE POLICY "update_requests" ON ride_requests FOR UPDATE
  TO authenticated USING (
    auth.uid() = passenger_id
    OR EXISTS (SELECT 1 FROM rides WHERE rides.id = ride_requests.ride_id AND rides.rider_id = auth.uid())
  ) WITH CHECK (
    auth.uid() = passenger_id
    OR EXISTS (SELECT 1 FROM rides WHERE rides.id = ride_requests.ride_id AND rides.rider_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_request" ON ride_requests;
CREATE POLICY "delete_own_request" ON ride_requests FOR DELETE
  TO authenticated USING (auth.uid() = passenger_id);

-- ========== MESSAGES ==========
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  price_proposal numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_messages" ON messages;
CREATE POLICY "select_messages" ON messages FOR SELECT
  TO authenticated USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM ride_requests rr
      WHERE rr.id = messages.request_id
      AND (rr.passenger_id = auth.uid()
           OR EXISTS (SELECT 1 FROM rides r WHERE r.id = rr.ride_id AND r.rider_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "insert_own_message" ON messages;
CREATE POLICY "insert_own_message" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_rides_rider ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_destination ON rides(destination);
CREATE INDEX IF NOT EXISTS idx_requests_ride ON ride_requests(ride_id);
CREATE INDEX IF NOT EXISTS idx_requests_passenger ON ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id, created_at);

-- ========== STORAGE BUCKETS ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-cards', 'id-cards', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('face-scans', 'face-scans', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own id card" ON storage.objects;
CREATE POLICY "Users can upload own id card" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'id-cards' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own id card" ON storage.objects;
CREATE POLICY "Users can read own id card" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'id-cards' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload own face scan" ON storage.objects;
CREATE POLICY "Users can upload own face scan" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'face-scans' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own face scan" ON storage.objects;
CREATE POLICY "Users can read own face scan" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'face-scans' AND (storage.foldername(name))[1] = auth.uid()::text);
