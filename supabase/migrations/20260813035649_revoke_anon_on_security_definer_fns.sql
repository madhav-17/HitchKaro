-- Revoke EXECUTE from anon role on SECURITY DEFINER functions
-- These functions check auth.uid() internally, but we lock them down
-- at the privilege level as defense-in-depth.

REVOKE EXECUTE ON FUNCTION cancel_ride(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION create_notification(uuid, text, text, text, uuid, uuid) FROM anon;
