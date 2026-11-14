/**
 * The shapes of everything the API sends and accepts.
 * Field names match the backend exactly (snake_case).
 * Money is always a whole number of paise. Dates are 'YYYY-MM-DD'. Timestamps are ISO text.
 */

export type UnitType = '1 BHK' | '2 BHK' | '3 BHK';
export type UnitStatus = 'AVAILABLE' | 'BOOKED' | 'SOLD';
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED';
export type MilestoneStage = 'BOOKING' | 'FOUNDATION' | 'STRUCTURE' | 'HANDOVER';
export type MilestoneState = 'PENDING' | 'PARTLY_PAID' | 'PAID';

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export interface Page<Item> {
  data: Item[];
  pagination: Pagination;
}

export interface Project {
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  listed_price_paise: number;
  status: UnitStatus;
  project_id: number;
  project_name: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  full_name: string;
  mobile: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  full_name: string;
  mobile: string;
  email: string;
}

/** The four money figures shared by a cost sheet, a quotation and a booking. */
export interface OfferMoney {
  listed_price_paise: number;
  discount_bps: number;
  discount_amount_paise: number;
  final_price_paise: number;
}

export interface CostSheetPreview extends OfferMoney {
  unit_id: number;
  unit_code: string;
}

export interface CostSheet extends OfferMoney {
  id: number;
  cost_sheet_number: string;
  created_at: string;
  unit_id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  unit_status: UnitStatus;
  current_listed_price_paise: number;
  price_changed: boolean;
  price_difference_paise: number;
  project_id: number;
  project_name: string;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  quotation_count: number;
}

export interface Quotation extends OfferMoney {
  id: number;
  quotation_number: string;
  status: QuotationStatus;
  issue_date: string;
  valid_until: string;
  created_at: string;
  updated_at: string;
  cost_sheet_id: number;
  cost_sheet_number: string;
  unit_id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  unit_status: UnitStatus;
  project_id: number;
  project_name: string;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  booking_id: number | null;
  booking_number: string | null;
}

export interface Booking extends OfferMoney {
  id: number;
  booking_number: string;
  booked_at: string;
  quotation_id: number;
  quotation_number: string;
  cost_sheet_number: string;
  unit_id: number;
  unit_code: string;
  unit_type: UnitType;
  area_sqft: number;
  unit_status: UnitStatus;
  project_id: number;
  project_name: string;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  collected_paise: number;
  outstanding_paise: number;
}

export interface Milestone {
  id: number;
  sequence_no: number;
  stage: MilestoneStage;
  percent: number;
  amount_due_paise: number;
  collected_paise: number;
  balance_paise: number;
  state: MilestoneState;
  /** True for the one milestone that the next payment will go to. */
  is_current: boolean;
}

export interface Payment {
  id: number;
  milestone_id: number;
  sequence_no: number;
  stage: MilestoneStage;
  amount_paise: number;
  payment_date: string;
  payment_reference: string;
  created_at: string;
}

export interface BookingDetail extends Booking {
  milestones: Milestone[];
  payments: Payment[];
}

export interface PaymentInput {
  amount_paise: number;
  payment_date: string;
  payment_reference: string;
}

export interface UnitCounts {
  total: number;
  available: number;
  booked: number;
  sold: number;
}

export interface ProjectUnitCounts extends UnitCounts {
  project_id: number;
  project_name: string;
}

export interface Dashboard {
  units: UnitCounts;
  bookings_count: number;
  booking_value_paise: number;
  collected_paise: number;
  outstanding_paise: number;
  by_project: ProjectUnitCounts[];
}
