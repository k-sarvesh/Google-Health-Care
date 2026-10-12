"""
Pydantic schemas shared across routes.

All ``datetime`` defaults use timezone-aware UTC to avoid the
``datetime.utcnow()`` deprecation introduced in Python 3.12.
"""

import datetime as _dt
from datetime import date as date_type, datetime, timezone
from typing import List

from pydantic import BaseModel, Field, field_validator


# ── Inventory ────────────────────────────────────────────────────────────────

class SupplyItemBase(BaseModel):
    name: str = Field(..., examples=["N95 Respirator Mask"])
    category: str = Field(..., examples=["PPE"])
    quantity: int = Field(..., ge=0)
    unit: str = Field(default="units", examples=["units", "boxes", "liters"])
    reorder_level: int = Field(default=50, ge=0)
    supplier: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name must not be blank")
        return v.strip()

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Category must not be blank")
        return v.strip()


class SupplyItemCreate(SupplyItemBase):
    pass


class SupplyItem(SupplyItemBase):
    id: int
    last_updated: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Config:
        from_attributes = True


# ── Users ────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    username: str
    email: str
    role: str = Field(default="viewer", examples=["admin", "manager", "viewer"])

    @field_validator("username")
    @classmethod
    def username_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Username must not be blank")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Email must not be blank")
        v = v.strip()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v

    @field_validator("role")
    @classmethod
    def role_in_whitelist(cls, v: str) -> str:
        allowed = {"admin", "manager", "viewer"}
        if v not in allowed:
            raise ValueError(f"Role must be one of {allowed}")
        return v


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_strong_enough(cls, v: str) -> str:
        if not v or len(v) < 4:
            raise ValueError("Password must be at least 4 characters")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class User(UserBase):
    id: int
    is_active: bool = True

    class Config:
        from_attributes = True


# ── Predictions ──────────────────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    item_id: int
    horizon_days: int = Field(
        default=30, ge=1, le=365,
        description="Number of days to forecast",
    )


class PredictionResponse(BaseModel):
    item_id: int
    item_name: str
    forecasted_demand: list[dict]
    anomaly_flags: list[dict] | None = None
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ── Footfall / Shortage Prediction ──────────────────────────────────────────

class FootfallEntry(BaseModel):
    date: str = Field(
        ..., pattern=r"^\d{4}-\d{2}-\d{2}$", examples=["2026-06-15"]
    )
    count: int = Field(..., ge=0, examples=[120])


class FootfallRequest(BaseModel):
    history: list[FootfallEntry] = Field(
        ...,
        min_length=1,
        description="Daily patient footfall history (date + count pairs)",
    )


# ── Health Centre Data ──────────────────────────────────────────────────────

class StockUpdate(BaseModel):
    """Represents a medicine stock update at a Primary Health Centre."""

    phc_id: str = Field(..., description="Primary Health Centre identifier")
    medicine_name: str = Field(..., description="Name of the medicine")
    quantity: int = Field(..., ge=0, description="Stock quantity")
    timestamp: datetime = Field(..., description="Time of the stock update")

    @field_validator("phc_id")
    @classmethod
    def phc_id_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("PHC ID must not be blank")
        return v.strip()

    @field_validator("medicine_name")
    @classmethod
    def medicine_name_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Medicine name must not be blank")
        return v.strip()


class BedsUpdate(BaseModel):
    """Represents an available beds update at a Primary Health Centre."""

    phc_id: str = Field(..., description="Primary Health Centre identifier")
    available_beds: int = Field(
        ..., ge=0, description="Number of available beds"
    )
    timestamp: datetime = Field(..., description="Time of the beds update")

    @field_validator("phc_id")
    @classmethod
    def phc_id_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("PHC ID must not be blank")
        return v.strip()


class AttendanceUpdate(BaseModel):
    """Represents a doctor attendance update at a Primary Health Centre."""

    phc_id: str = Field(..., description="Primary Health Centre identifier")
    doctors_present: int = Field(
        ..., ge=0, description="Number of doctors present"
    )
    timestamp: datetime = Field(
        ..., description="Time of the attendance update"
    )

    @field_validator("phc_id")
    @classmethod
    def phc_id_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("PHC ID must not be blank")
        return v.strip()


class DailyFootfall(BaseModel):
    """Daily patient footfall record for a Primary Health Centre."""

    phc_id: str = Field(..., description="Primary Health Centre identifier")
    date: date_type = Field(..., description="Date of the footfall record")
    patient_count: int = Field(..., ge=0, description="Number of patients")


class FootfallPredictionRequest(BaseModel):
    """Request payload for footfall-based predictions."""

    footfall_data: List[DailyFootfall] = Field(
        ...,
        min_length=1,
        description="List of daily footfall records to base predictions on",
    )


class StockItemInitial(BaseModel):
    itemName: str = Field(..., description="Name of the medicine/item")
    currentUnits: int = Field(default=0, ge=0)
    avgDailyConsumption: int = Field(default=1, ge=1)


class FacilityCreate(BaseModel):
    name: str = Field(..., description="Name of the PHC facility")
    block: str = Field(..., description="District or Block name")
    stockItems: List[StockItemInitial] = Field(default_factory=list)

