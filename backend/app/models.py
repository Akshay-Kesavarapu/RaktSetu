from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, Enum, BigInteger, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from app.database import Base

class DataOrigin(str, enum.Enum):
    official_reference = "official_reference"
    synthetic_demo = "synthetic_demo"
    partner_reported = "partner_reported"

class BloodGroup(str, enum.Enum):
    A_PLUS = "A+"
    A_MINUS = "A-"
    B_PLUS = "B+"
    B_MINUS = "B-"
    AB_PLUS = "AB+"
    AB_MINUS = "AB-"
    O_PLUS = "O+"
    O_MINUS = "O-"

class BloodComponent(str, enum.Enum):
    WHOLE_BLOOD = "Whole Blood"
    PACKED_RED_CELLS = "Packed Red Cells"
    FRESH_FROZEN_PLASMA = "Fresh Frozen Plasma"
    PLATELETS = "Platelets"
    CRYOPRECIPITATE = "Cryoprecipitate"

class BloodBank(Base):
    __tablename__ = "blood_banks"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bank_ref_code = Column(String, unique=True, nullable=True, index=True)
    name = Column(String, nullable=False)
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    city = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    pincode = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    helpline = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    category = Column(String, nullable=True)
    blood_components_available = Column(String, nullable=True)
    apheresis_available = Column(Boolean, nullable=True)
    service_time = Column(String, nullable=True)
    license_number = Column(String, nullable=True)
    nodal_officer_name = Column(String, nullable=True)
    nodal_officer_contact = Column(String, nullable=True)
    latitude = Column(Numeric, nullable=True)
    longitude = Column(Numeric, nullable=True)
    data_origin = Column(Enum(DataOrigin, values_callable=lambda x: [e.value for e in x]), default=DataOrigin.official_reference)
    is_demo_data = Column(Boolean, default=False)
    source_url = Column(String, nullable=True)
    source_checked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

class StockUpdate(Base):
    __tablename__ = "stock_updates"
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True, index=True)
    reference_id = Column(String, unique=True, nullable=True, index=True)
    corrected_from_reference_id = Column(String, nullable=True, index=True)
    is_superseded = Column(Boolean, default=False, nullable=False)
    bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False)
    blood_group = Column(Enum(BloodGroup, values_callable=lambda x: [e.value for e in x]), nullable=False)
    component = Column(Enum(BloodComponent, values_callable=lambda x: [e.value for e in x]), nullable=False)
    units = Column(Integer, nullable=False)
    reported_by = Column(String, nullable=True)
    source = Column(String, default="web")
    data_origin = Column(Enum(DataOrigin, values_callable=lambda x: [e.value for e in x]), default=DataOrigin.partner_reported)
    is_demo_data = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True))

class StockCurrent(Base):
    __tablename__ = "stock_current"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False)
    blood_group = Column(Enum(BloodGroup, values_callable=lambda x: [e.value for e in x]), nullable=False)
    component = Column(Enum(BloodComponent, values_callable=lambda x: [e.value for e in x]), nullable=False)
    units = Column(Integer, nullable=False)
    last_updated = Column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint('bank_id', 'blood_group', 'component', name='uq_stock_current'),
    )

class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True))

class RequestStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"

class BloodRequest(Base):
    __tablename__ = "blood_requests"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    reference_id = Column(String, unique=True, nullable=False, index=True)
    requesting_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    target_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    blood_group = Column(Enum(BloodGroup, values_callable=lambda x: [e.value for e in x]), nullable=False)
    component = Column(Enum(BloodComponent, values_callable=lambda x: [e.value for e in x]), nullable=False)
    units = Column(Integer, nullable=False)
    note = Column(Text, nullable=True)
    status = Column(Enum(RequestStatus, values_callable=lambda x: [e.value for e in x]), default=RequestStatus.pending, nullable=False)
    created_at = Column(DateTime(timezone=True))
    responded_at = Column(DateTime(timezone=True), nullable=True)

    requesting_bank = relationship("BloodBank", foreign_keys=[requesting_bank_id])
    target_bank = relationship("BloodBank", foreign_keys=[target_bank_id])

class SilentBankAlert(Base):
    __tablename__ = "silent_bank_alerts"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_at = Column(DateTime(timezone=True), nullable=False)
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    bank = relationship("BloodBank", foreign_keys=[bank_id])

class AlertStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"

class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    reference_id = Column(String, unique=True, nullable=False, index=True)
    source_bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    blood_group = Column(Enum(BloodGroup, values_callable=lambda x: [e.value for e in x]), nullable=False)
    component = Column(Enum(BloodComponent, values_callable=lambda x: [e.value for e in x]), nullable=False)
    units = Column(Integer, nullable=False)
    note = Column(Text, nullable=True)
    status = Column(Enum(AlertStatus, values_callable=lambda x: [e.value for e in x]), default=AlertStatus.active, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    source_bank = relationship("BloodBank", foreign_keys=[source_bank_id])

class EmergencyAlertAcknowledgment(Base):
    __tablename__ = "emergency_alert_acknowledgments"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    alert_id = Column(Integer, ForeignKey("emergency_alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_id = Column(Integer, ForeignKey("blood_banks.id", ondelete="CASCADE"), nullable=False, index=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint('alert_id', 'bank_id', name='uq_emergency_alert_ack'),
    )

    alert = relationship("EmergencyAlert", foreign_keys=[alert_id])
    bank = relationship("BloodBank", foreign_keys=[bank_id])

