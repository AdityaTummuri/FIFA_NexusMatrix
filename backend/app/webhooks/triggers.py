import logging
from datetime import datetime, timezone
from app.models.schemas import (
    SurgeAlert, SurgeTriggers, SurgeHvacTrigger,
    SurgeRestockTrigger, FanIncentive
)
from app.services.redis_pubsub import redis_service

logger = logging.getLogger("nexus-triggers")

def dispatch_surge_alert(zone_id: str, predicted_density: float, destination_zone: str) -> SurgeAlert:
    """
    Constructs a deterministic SurgeAlert schema and publishes it to Redis.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    
    hvac = SurgeHvacTrigger(
        action="LOWER_THRESHOLD",
        zone=zone_id,
        target_temp_c=20.0
    )
    
    restock = SurgeRestockTrigger(
        action="DISPATCH_ALERT",
        concession_point=f"Stand-{zone_id}",
        items=["water", "isotonic_drinks"]
    )
    
    fan_incentive = FanIncentive(
        voucher_code=f"NEXUS-{zone_id}-15OFF",
        discount_pct=15,
        destination_zone=destination_zone,
        message=f"Avoid the queue! Head to Zone {destination_zone} for 15% off at Store 4B.",
        expires_in_seconds=900
    )
    
    triggers = SurgeTriggers(
        hvac=hvac,
        restock=restock,
        fan_incentive=fan_incentive
    )
    
    alert = SurgeAlert(
        timestamp=timestamp,
        zone_id=zone_id,
        severity="HIGH",
        predicted_density_15m=predicted_density,
        triggers=triggers
    )
    
    # Broadcast to Redis Pub/Sub
    payload = alert.model_dump_json()
    redis_service.publish("nexus:surges", payload)
    
    logger.warning(f"SURGE ALERT dispatched for zone {zone_id}. Extrapolated density 15m: {predicted_density}")
    return alert
