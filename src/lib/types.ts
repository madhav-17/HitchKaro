export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type RideStatus = 'active' | 'full' | 'completed' | 'cancelled';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type NotificationType =
  | 'ride_cancelled'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_cancelled'
  | 'new_message'
  | 'ride_booked';

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  college_name: string;
  college_email: string;
  id_card_url: string | null;
  face_scan_url: string | null;
  license_url: string | null;
  vehicle_number: string | null;
  vehicle_model: string | null;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface Ride {
  id: string;
  rider_id: string;
  source: string;
  destination: string;
  route_stops: string[];
  source_lat: number | null;
  source_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  departure_time: string;
  total_seats: number;
  booked_seats: number;
  price_per_seat: number;
  vehicle_info: string;
  notes: string;
  status: RideStatus;
  created_at: string;
  rider?: Profile;
}

export interface RideRequest {
  id: string;
  ride_id: string;
  passenger_id: string;
  seats_requested: number;
  offered_price: number;
  final_price: number | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: RequestStatus;
  created_at: string;
  passenger?: Profile;
  ride?: Ride;
}

export interface Message {
  id: string;
  ride_id: string;
  request_id: string;
  sender_id: string;
  content: string;
  price_proposal: number | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  ride_id: string | null;
  request_id: string | null;
  read: boolean;
  created_at: string;
}

export interface GeoLocation {
  label: string;
  lat: number;
  lng: number;
}
