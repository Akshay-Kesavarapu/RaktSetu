from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models import DataOrigin, BloodGroup, BloodComponent, RequestStatus, AlertStatus

class BloodBankBase(BaseModel):
    name: str
    bank_ref_code: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    helpline: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    category: Optional[str] = None
    blood_components_available: Optional[str] = None
    apheresis_available: Optional[bool] = None
    service_time: Optional[str] = None
    license_number: Optional[str] = None
    nodal_officer_name: Optional[str] = None
    nodal_officer_contact: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class BloodBankRead(BloodBankBase):
    id: int
    data_origin: Optional[DataOrigin] = None
    is_demo_data: bool = False
    created_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None
    is_active: Optional[bool] = None
    silent_alert_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class StockUpdateCreate(BaseModel):
    bank_id: int
    bank_identifier: str
    blood_group: BloodGroup
    component: BloodComponent
    units: int = Field(ge=0, le=9999)
    reported_by: Optional[str] = None

class StockUpdateRead(BaseModel):
    id: int
    reference_id: Optional[str] = None
    bank_id: int
    blood_group: BloodGroup
    component: BloodComponent
    units: int
    source: Optional[str] = None
    data_origin: Optional[DataOrigin] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StockCurrentRead(BaseModel):
    id: int
    bank_id: int
    blood_group: BloodGroup
    component: BloodComponent
    units: int
    last_updated: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SearchResult(BaseModel):
    bank: BloodBankRead
    stock: List[StockCurrentRead]
    distance_km: float
    last_updated: Optional[datetime] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    disclaimer: str = "PROTOTYPE DATA — Always verify availability directly with the blood bank before visiting."

class StatsResponse(BaseModel):
    total_banks: int
    reporting_today: int
    stale_banks: int
    coverage_pct: float
    total_units: Optional[int] = None
    total_updates: Optional[int] = None
    last_updated: Optional[datetime] = None

class RegionCoverage(BaseModel):
    state: str
    total_banks: int
    reporting_today: int
    coverage_pct: float

class CoverageResponse(BaseModel):
    regions: List[RegionCoverage]
    total_coverage_pct: float

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    token: str
    username: str
    message: str = "Login successful"

class BankLoginRequest(BaseModel):
    bank_identifier: str

class BankLoginResponse(BaseModel):
    token: str
    bank_id: int
    bank_ref_code: str
    bank_name: str
    city: Optional[str] = None
    message: str = "Bank identification successful"

class BloodRequestCreate(BaseModel):
    target_bank_id: int
    blood_group: BloodGroup
    component: BloodComponent
    units: int = Field(gt=0, le=9999)
    note: Optional[str] = None

class BloodRequestRespond(BaseModel):
    status: RequestStatus

class BloodRequestRead(BaseModel):
    id: int
    reference_id: str
    requesting_bank_id: int
    target_bank_id: int
    requesting_bank_name: str
    requesting_bank_city: Optional[str] = None
    requesting_bank_ref_code: Optional[str] = None
    requesting_bank_phone: Optional[str] = None
    target_bank_name: str
    target_bank_city: Optional[str] = None
    target_bank_ref_code: Optional[str] = None
    target_bank_phone: Optional[str] = None
    blood_group: str
    component: str
    units: int
    note: Optional[str] = None
    status: RequestStatus
    created_at: datetime
    responded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SMSWebhookRequest(BaseModel):
    from_number: Optional[str] = None
    message_body: str

class SMSWebhookResponse(BaseModel):
    success: bool
    message: str
    bank_ref_code: Optional[str] = None
    bank_id: Optional[int] = None
    bank_name: Optional[str] = None
    blood_group: Optional[str] = None
    component: Optional[str] = None
    units: Optional[int] = None
    source: str = "sms"
    update_id: Optional[int] = None
    sms_confirmation: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ActivityEvent(BaseModel):
    id: int
    bank_id: int
    bank_name: str
    city: str
    state: str
    blood_group: str
    component: str
    units: int
    source: str
    data_origin: str
    created_at: datetime

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime

class StockUpdateResponse(BaseModel):
    success: bool
    update_id: int
    reference_id: Optional[str] = None
    message: str

class StockCorrectionCreate(BaseModel):
    reference_id: str
    blood_group: BloodGroup
    component: BloodComponent
    units: int = Field(ge=0, le=9999)
    reported_by: Optional[str] = None

class StockCorrectionResponse(BaseModel):
    success: bool
    message: str
    original_reference_id: str
    new_reference_id: str
    new_update_id: int
    bank_id: int
    bank_name: str
    blood_group: str
    component: str
    units: int
    reported_at: datetime

class StockLookupResponse(BaseModel):
    success: bool
    reference_id: str
    bank_id: int
    bank_name: str
    blood_group: BloodGroup
    component: BloodComponent
    units: int
    reported_at: datetime
    is_superseded: bool
    is_editable: bool
    remaining_seconds: float
    message: Optional[str] = None

class FlagSilentBanksResponse(BaseModel):
    flagged: int
    already_pending: int
    total_silent: int

class BankSilentAlertResponse(BaseModel):
    has_alert: bool
    alert_id: Optional[int] = None
    triggered_at: Optional[datetime] = None

class AcknowledgeAlertResponse(BaseModel):
    success: bool
    message: str = "Alert acknowledged"

class EmergencyAlertCreate(BaseModel):
    blood_group: BloodGroup
    component: BloodComponent
    units: int = Field(gt=0, le=9999)
    note: Optional[str] = None

class EmergencyAlertRead(BaseModel):
    id: int
    reference_id: str
    source_bank_id: int
    source_bank_name: str
    source_bank_city: Optional[str] = None
    source_bank_ref_code: Optional[str] = None
    source_bank_phone: Optional[str] = None
    blood_group: str
    component: str
    units: int
    note: Optional[str] = None
    status: AlertStatus
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class EmergencyAlertAcknowledgeResponse(BaseModel):
    success: bool
    message: str = "Emergency alert acknowledged"
    alert_id: int

class EmergencyAlertResolveResponse(BaseModel):
    success: bool
    message: str = "Emergency alert resolved"
    alert: EmergencyAlertRead


