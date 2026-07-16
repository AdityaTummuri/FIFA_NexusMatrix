from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Literal
from datetime import datetime

# ----------------- Base Telemetry Contracts -----------------

class VelocityVector(BaseModel):
    model_config = ConfigDict(strict=True)
    vx: float
    vy: float

class ZoneCoordinates(BaseModel):
    model_config = ConfigDict(strict=True)
    lat: float
    lon: float

class ZoneTelemetry(BaseModel):
    model_config = ConfigDict(strict=True)
    zone_id: str
    coordinates: ZoneCoordinates
    density_pax_m2: float
    velocity_vector: VelocityVector
    predicted_density_15m: float
    status: Literal["SAFE", "WARNING", "CRITICAL"]

class TelemetryTick(BaseModel):
    model_config = ConfigDict(strict=True)
    event: Literal["telemetry_tick"] = "telemetry_tick"
    timestamp: str
    stadium_id: str
    zones: List[ZoneTelemetry]

# ----------------- Surge Trigger Contracts -----------------

class SurgeHvacTrigger(BaseModel):
    model_config = ConfigDict(strict=True)
    action: str
    zone: str
    target_temp_c: float

class SurgeRestockTrigger(BaseModel):
    model_config = ConfigDict(strict=True)
    action: str
    concession_point: str
    items: List[str]

class FanIncentive(BaseModel):
    model_config = ConfigDict(strict=True)
    type: Literal["WebAR_VOUCHER"] = "WebAR_VOUCHER"
    voucher_code: str
    discount_pct: int
    destination_zone: str
    message: str
    expires_in_seconds: int

class SurgeTriggers(BaseModel):
    model_config = ConfigDict(strict=True)
    hvac: SurgeHvacTrigger
    restock: SurgeRestockTrigger
    fan_incentive: FanIncentive

class SurgeAlert(BaseModel):
    model_config = ConfigDict(strict=True)
    event: Literal["surge_alert"] = "surge_alert"
    timestamp: str
    zone_id: str
    severity: Literal["WARNING", "HIGH", "CRITICAL"]
    predicted_density_15m: float
    triggers: SurgeTriggers

# ----------------- Vision Contracts -----------------

class VisionRequest(BaseModel):
    model_config = ConfigDict(strict=True)
    request_id: str
    mode: Literal["WAYFINDING", "MENU_TRANSLATION", "SEAT_DELIVERY"]
    zone_id: str
    image_b64: str

class TranslationItem(BaseModel):
    model_config = ConfigDict(strict=True)
    original: str
    translated: str
    price_usd: float

class WayfindingVector(BaseModel):
    model_config = ConfigDict(strict=True)
    angle_deg: float
    distance_m: float

class VisionResponse(BaseModel):
    model_config = ConfigDict(strict=True)
    request_id: str
    mode: Literal["WAYFINDING", "MENU_TRANSLATION", "SEAT_DELIVERY"]
    success: bool
    fallback_used: bool
    result: Optional[dict] = None
