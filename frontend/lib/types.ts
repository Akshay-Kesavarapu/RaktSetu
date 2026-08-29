export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
export type BloodComponent = 'Whole Blood' | 'Packed Red Cells' | 'Fresh Frozen Plasma' | 'Platelets' | 'Cryoprecipitate'
export type DataOrigin = 'official_reference' | 'synthetic_demo' | 'partner_reported'

export interface BloodBank {
  id: number
  bank_ref_code?: string | null
  name: string
  state?: string | null
  district?: string | null
  city?: string | null
  address?: string | null
  pincode?: string | null
  phone?: string | null
  helpline?: string | null
  email?: string | null
  website?: string | null
  category?: string | null
  blood_components_available?: string | null
  apheresis_available?: boolean | null
  service_time?: string | null
  license_number?: string | null
  nodal_officer_name?: string | null
  nodal_officer_contact?: string | null
  latitude: number
  longitude: number
  data_origin: DataOrigin
  is_demo_data: boolean
  created_at: string
  last_updated?: string | null
  is_active?: boolean
  silent_alert_status?: 'pending' | 'acknowledged' | null
}

export interface StockItem {
  id: number
  bank_id: number
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  last_updated: string
}

export interface SearchResult {
  bank: BloodBank
  stock: StockItem[]
  distance_km: number
  last_updated: string | null
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  disclaimer: string
}

export interface StockUpdatePayload {
  bank_id: number
  bank_identifier: string
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  reported_by?: string
}

export interface StockUpdateResponse {
  success: boolean
  update_id: number
  reference_id?: string
  message: string
}

export interface StockLookupResponse {
  success: boolean
  reference_id: string
  bank_id: number
  bank_name: string
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  reported_at: string
  is_superseded: boolean
  is_editable: boolean
  remaining_seconds: number
  message?: string
}

export interface StockCorrectionPayload {
  reference_id: string
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  reported_by?: string
}

export interface StockCorrectionResponse {
  success: boolean
  message: string
  original_reference_id: string
  new_reference_id: string
  new_update_id: number
  bank_id: number
  bank_name: string
  blood_group: string
  component: string
  units: number
  reported_at: string
}

export interface StatsResponse {
  total_banks: number
  reporting_today: number
  stale_banks: number
  coverage_pct: number
  total_units?: number
  total_updates?: number
  last_updated: string
}

export interface RegionCoverage {
  state: string
  total_banks: number
  reporting_today: number
  coverage_pct: number
}

export interface CoverageResponse {
  regions: RegionCoverage[]
  total_coverage_pct: number
}

export interface SMSWebhookPayload {
  message_body: string
  from_number?: string
  message_id?: string
}

export interface SMSWebhookResponse {
  success: boolean
  message: string
  bank_ref_code?: string
  bank_id?: number
  bank_name?: string
  blood_group?: string
  component?: string
  units?: number
  source: string
  update_id?: number
  sms_confirmation?: Record<string, any>
  error?: string
}

export interface ActivityEvent {
  id: number
  bank_id: number
  bank_name: string
  city: string
  state: string
  blood_group: string
  component: string
  units: number
  source: string
  data_origin: string
  created_at: string
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'queued'

export interface QueuedUpdate {
  id?: number
  payload: StockUpdatePayload
  queuedAt: number
  retries: number
}

export type RequestStatus = 'pending' | 'accepted' | 'declined'

export interface BloodRequest {
  id: number
  reference_id: string
  requesting_bank_id: number
  target_bank_id: number
  requesting_bank_name: string
  requesting_bank_city?: string
  requesting_bank_ref_code?: string
  requesting_bank_phone?: string
  target_bank_name: string
  target_bank_city?: string
  target_bank_ref_code?: string
  target_bank_phone?: string
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  note?: string
  status: RequestStatus
  created_at: string
  responded_at?: string | null
}

export interface BloodRequestPayload {
  target_bank_id: number
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  note?: string
}

export interface BankLoginResponse {
  token: string
  bank_id: number
  bank_ref_code: string
  bank_name: string
  city?: string
  message: string
}

export interface FlagSilentBanksResponse {
  flagged: number
  already_pending: number
  total_silent: number
}

export interface BankSilentAlertResponse {
  has_alert: boolean
  alert_id?: number | null
  triggered_at?: string | null
}

export interface AcknowledgeAlertResponse {
  success: boolean
  message: string
}

export type AlertStatus = 'active' | 'resolved'

export interface EmergencyAlert {
  id: number
  reference_id: string
  source_bank_id: number
  source_bank_name: string
  source_bank_city?: string
  source_bank_ref_code?: string
  source_bank_phone?: string
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  note?: string
  status: AlertStatus
  created_at: string
  resolved_at?: string | null
}

export interface EmergencyAlertPayload {
  blood_group: BloodGroup
  component: BloodComponent
  units: number
  note?: string
}

export interface EmergencyAlertAcknowledgeResponse {
  success: boolean
  message: string
  alert_id: number
}

export interface EmergencyAlertResolveResponse {
  success: boolean
  message: string
  alert: EmergencyAlert
}



