/*
# HitchKaro v2: License verification, vehicle registration, route coordinates, notifications

## Overview
This migration adds support for:
1. Driving license verification (new upload in verification flow)
2. One-time vehicle registration on the profile (not per-ride)
3. Geographic coordinates on rides and requests for route validation
4. A notifications system for ride cancellations and booking confirmations

## New Tables
- `notifications` — stores per-user notifications (ride cancelled, request accepted, new message, etc.)

## Modified Tables
- `profiles` — added `license_url` (driving license image), `vehicle_number`, `vehicle_model` (one-time vehicle registration)
- `rides` — added `source_lat`, `source_lng`, `dest_lat`, `dest_lng` (coordinates for route matching)
- `ride_requests` — added `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng` (passenger pickup/dropoff coordinates)

## New Storage Bucket
- `driving-licenses` — private bucket for driving license images, scoped per-user

## New Functions
- `create_notification(target_user_id, type, title, body, ride_id, request_id)` — SECURITY DEFINER function
  that allows any authenticated user to create a notification for another user (needed because RLS
  would otherwise prevent inserting rows owned by other users). Used when a rider cancels a ride
  (notifies all passengers) or accepts/rejects a request (notifies the passenger).

## Security
- RLS enabled on `notifications` with owner-scoped CRUD policies
- Storage policies on `driving-licenses` bucket (users can only access their own folder)
- `create_notification` is SECURITY DEFINER, executable by authenticated only, validates caller is authenticated

## Notes
1. The `price_per_seat` column on `rides` is kept (data safety — never drop columns) but is no longer
   used by the frontend. The rider no longer sets a price; the passenger proposes a price in the request
   and they negotiate in chat.
2. The `vehicle_info` column on `rides` is kept but the frontend will use the rider's profile vehicle
   fields instead. New rides will copy the profile vehicle at insert time for display purposes.
*/

-- ============ profiles: license + vehicle ============
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vehicle_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vehicle_model text;

-- ============ rides: coordinates ============
ALTER TABLE rides ADD COLUMN IF NOT EXISTS source_lat double precision;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS source_lng double precision;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS dest_lat double precision;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS dest_lng double precision;

-- ============ ride_requests: pickup/dropoff coordinates ============
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS pickup_lat double precision;
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS pickup_lng double precision;
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS dropoff_lat double precision;
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS dropoff_lng double precision;

-- ============ Storage bucket: driving-licenses ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('driving-licenses', 'driving-licenses', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driving-licenses bucket
DROP POLICY IF EXISTS "license_upload_own" ON storage.objects;
CREATE POLICY "license_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driving-licenses' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "license_view_own" ON storage.objects;
CREATE POLICY "license_view_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'driving-licenses' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============ notifications table ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  ride_id uuid REFERENCES rides(id) ON DELETE CASCADE,
  request_id uuid REFERENCES ride_requests(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for fast lookup of a user's unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- ============ create_notification function ============
-- Allows an authenticated user to create a notification for another user.
-- This is needed because RLS prevents inserting rows owned by other users,
-- but we need to notify passengers when a rider cancels, etc.
CREATE OR REPLACE FUNCTION create_notification(
  target_user_id uuid,
  notif_type text,
  notif_title text,
  notif_body text,
  target_ride_id uuid DEFAULT NULL,
  target_request_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO notifications (user_id, type, title, body, ride_id, request_id)
  VALUES (target_user_id, notif_type, notif_title, notif_body, target_ride_id, target_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- ============ cancel_ride function ============
-- Cancels a ride and notifies all passengers with pending/accepted requests.
-- Only the ride owner can call this.
CREATE OR REPLACE FUNCTION cancel_ride(ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_record RECORD;
BEGIN
  SELECT rider_id, source, destination INTO r_record FROM rides WHERE id = ride_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  IF r_record.rider_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to cancel this ride';
  END IF;
  UPDATE rides SET status = 'cancelled' WHERE id = ride_id;
  UPDATE ride_requests SET status = 'cancelled'
    WHERE ride_id = cancel_ride.ride_id AND status IN ('pending', 'accepted');
  -- Notify all passengers
  INSERT INTO notifications (user_id, type, title, body, ride_id)
    SELECT passenger_id, 'ride_cancelled', 'Ride cancelled',
           'Ride from ' || r_record.source || ' to ' || r_record.destination || ' has been cancelled by the rider.',
           cancel_ride.ride_id
    FROM ride_requests WHERE ride_id = cancel_ride.ride_id AND status = 'cancelled';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_ride TO authenticated;
