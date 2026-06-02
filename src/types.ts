/**
 * SecureSociety Type Definitions
 */

export type UserRole = 'resident' | 'worker' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  block?: string;
  floor?: string;
  door_no?: string;
  phone?: string;
  skill_type?: string;
}

export type ComplaintStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed';

export interface Complaint {
  id: string;
  user_id: string;
  resident_name: string;
  service_type: 'Electrician' | 'Plumber' | 'Carpenter' | 'Other';
  description: string;
  block: string;
  floor: string;
  door_no: string;
  status: ComplaintStatus;
  assigned_worker_id?: string;
  assigned_worker_name?: string;
  assigned_worker_phone?: string;
  rating?: number;
  review?: string;
  created_at: string;
  assigned_at?: string;
  accepted_at?: string;
  verified_at?: string;
  completed_at?: string;
  verification_status?: 'pending' | 'verified' | 'rejected';
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  skill_type: 'Electrician' | 'Plumber' | 'Carpenter' | 'Other';
  availability_status: 'Available' | 'Busy' | 'Offline';
  rating: number; // average rating
  ratings_count: number;
  reviews?: { residentName: string; rating: number; comment?: string; date: string }[];
}

export interface QRLog {
  id: string;
  request_id: string;
  worker_id: string;
  qr_data: string; // Serialized QR contents
  generated_at: string;
  is_verified: boolean;
  status: 'pending' | 'verified' | 'rejected';
  verified_at?: string;
}
