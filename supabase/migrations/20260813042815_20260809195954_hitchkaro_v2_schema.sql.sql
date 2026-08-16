/*
# HitchKaro v2: License verification, vehicle registration, route coordinates, notifications
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- ============ create_notification function ============
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
CREATE OR REPLACE FUNCTION cancel_ride(ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_record RECORD;
BEGIN
  SELECT rider_id, source, destination INTO r_record FROM rides WHERE id = cancel_ride.ride_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;
  IF r_record.rider_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to cancel this ride';
  END IF;
  UPDATE rides SET status = 'cancelled' WHERE id = cancel_ride.ride_id;
  UPDATE ride_requests SET status = 'cancelled'
    WHERE ride_id = cancel_ride.ride_id AND status IN ('pending', 'accepted');
  INSERT INTO notifications (user_id, type, title, body, ride_id)
    SELECT passenger_id, 'ride_cancelled', 'Ride cancelled',
           'Ride from ' || r_record.source || ' to ' || r_record.destination || ' has been cancelled by the rider.',
           cancel_ride.ride_id
    FROM ride_requests WHERE ride_id = cancel_ride.ride_id AND status = 'cancelled';
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_ride TO authenticated;
