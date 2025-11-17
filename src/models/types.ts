/**
 * Domain model types for facility reservation system
 */

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  organization_name: string | null;
  phone: string;
  address: string | null;
  is_active: boolean;
  is_admin: boolean;
  role: 'user' | 'staff' | 'admin';
  staff_code: string | null;
  department: string | null;
  position: string | null;
  hire_date: Date | null;
  staff_status: 'active' | 'on_leave' | 'retired' | null;
  email_verified: boolean;
  verification_code: string | null;
  verification_code_expires_at: Date | null;
  password_reset_token: string | null;
  password_reset_expires_at: Date | null;
  nickname: string | null;
  profile_image_path: string | null;
  bio: string | null;
  deleted_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Room {
  id: number;
  name: string;
  capacity: number | null;
  base_price_morning: number;
  base_price_afternoon: number;
  base_price_evening: number;
  extension_price_midday: number;
  extension_price_evening: number;
  ac_price_per_hour: number;
  description: string | null;
  is_active: boolean;
  is_flexible_time: boolean;
  min_duration_minutes: number | null;
  time_unit_minutes: number | null;
  price_per_unit: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Equipment {
  id: number;
  category: 'stage' | 'lighting' | 'sound' | 'other';
  name: string;
  price_type: 'per_slot' | 'flat' | 'free';
  unit_price: number;
  max_quantity: number;
  enabled: boolean;
  remark: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Application {
  id: number;
  user_id: number | null;
  applicant_address: string | null;
  applicant_group_name: string | null;
  applicant_representative: string;
  applicant_phone: string;
  applicant_email: string;
  event_name: string;
  expected_attendees: number | null;
  event_description: string | null;
  program_attachment_path: string | null;
  entrance_fee_type: 'free' | 'paid';
  entrance_fee_amount: number;
  ticket_multiplier: number;
  use_digital_signboard: boolean;
  setup_datetime: Date | null;
  meeting_date: Date | null;
  hall_manager_name: string | null;
  hall_manager_phone: string | null;
  signboard_entrance: boolean;
  signboard_stage: boolean;
  open_time: string | null;
  start_time: string | null;
  end_time: string | null;
  remarks: string | null;
  total_amount: number;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_provider_id: string | null;
  cancel_status: 'none' | 'cancelled';
  cancelled_at: Date | null;
  cancellation_fee: number;
  created_at: Date;
  updated_at: Date;
}

export interface Usage {
  id: number;
  application_id: number;
  room_id: number;
  date: Date;
  use_morning: boolean;
  use_afternoon: boolean;
  use_evening: boolean;
  use_midday_extension: boolean;
  use_evening_extension: boolean;
  ac_requested: boolean;
  ac_hours: number | null;
  room_base_charge_before_multiplier: number;
  room_charge_after_multiplier: number;
  equipment_charge: number;
  ac_charge: number;
  subtotal_amount: number;
  created_at: Date;
  updated_at: Date;
}

export interface UsageEquipment {
  id: number;
  usage_id: number;
  equipment_id: number;
  quantity: number;
  slot_count: number;
  line_amount: number;
  created_at: Date;
  updated_at: Date;
}

export interface ClosedDate {
  id: number;
  date: Date;
  reason: string | null;
  closure_type: 'full' | 'partial' | 'year_end';
  affected_rooms: number[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface TimeSlot {
  id: number;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  slot_type: 'regular' | 'extension' | 'flexible';
  display_order: number;
  is_active: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoomTimeSlotPrice {
  id: number;
  room_id: number;
  time_slot_id: number;
  base_price: number;
  ac_price_per_hour: number;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoomEquipment {
  id: number;
  room_id: number;
  equipment_id: number;
  is_available: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  cost: number | null;
  stock_quantity: number | null;
  is_available: boolean;
  description: string | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface Sale {
  id: number;
  application_id: number | null;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  sold_by: number;
  sold_at: Date;
  customer_name: string | null;
  notes: string | null;
  created_at: Date;
}

export interface RoomClosedDate {
  id: number;
  room_id: number;
  date: Date;
  reason: string;
  closed_time_slots: number[] | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export interface ApplicationProxy {
  id: number;
  application_id: number;
  created_by_staff: number;
  user_id: number | null;
  proxy_type: 'for_member' | 'for_guest';
  notes: string | null;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  entity_type: string;
  entity_id: number;
  action: 'create' | 'update' | 'delete' | 'cancel';
  old_values: any | null;
  new_values: any | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

// DTOs (Data Transfer Objects) for API requests/responses

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  organization_name?: string;
  phone: string;
  address?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateApplicationDto {
  user_id?: number;
  applicant_address?: string;
  applicant_group_name?: string;
  applicant_representative: string;
  applicant_phone: string;
  applicant_email: string;
  event_name: string;
  expected_attendees?: number;
  event_description?: string;
  entrance_fee_type: 'free' | 'paid';
  entrance_fee_amount: number;
  use_digital_signboard?: boolean;
  setup_datetime?: string;
  meeting_date?: string;
  hall_manager_name?: string;
  hall_manager_phone?: string;
  signboard_entrance?: boolean;
  signboard_stage?: boolean;
  open_time?: string;
  start_time?: string;
  end_time?: string;
  remarks?: string;
  usages: CreateUsageDto[];
}

export interface CreateUsageDto {
  room_id: number;
  date: string; // ISO date string
  use_morning: boolean;
  use_afternoon: boolean;
  use_evening: boolean;
  use_midday_extension: boolean;
  use_evening_extension: boolean;
  ac_requested: boolean;
  equipment: CreateEquipmentUsageDto[];
}

export interface CreateEquipmentUsageDto {
  equipment_id: number;
  quantity: number;
}

export interface AvailabilityQuery {
  room_id: number;
  year: number;
  month: number;
}

export interface DayAvailability {
  date: string;
  is_closed: boolean;
  morning_available: boolean;
  afternoon_available: boolean;
  evening_available: boolean;
}
