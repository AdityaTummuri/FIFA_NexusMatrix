import os
import logging
import httpx
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import VisionRequest, VisionResponse, TranslationItem, WayfindingVector, VoucherRedemption

logger = logging.getLogger("nexus-vision")
router = APIRouter()

# Local mock datasets for offline mode
MOCK_TRANSLATIONS = {
    "German": [
        {"original": "Bratwurst mit Senf", "translated": "Grilled Sausage with Mustard", "price_usd": 12.00},
        {"original": "Pretzel mit Käse", "translated": "Pretzel with Cheese Dip", "price_usd": 8.00},
        {"original": "Weizenbier", "translated": "Wheat Beer", "price_usd": 14.00}
    ],
    "Spanish": [
        {"original": "Empanada de Pino", "translated": "Chilean Beef Empanada", "price_usd": 6.50},
        {"original": "Choripán con Chimichurri", "translated": "Sausage in Bread with Chimichurri", "price_usd": 9.00},
        {"original": "Mote con Huesillo", "translated": "Sweet Peach Wheat Drink", "price_usd": 5.00}
    ]
}

@router.post("/api/vision", response_model=VisionResponse)
async def analyze_vision_frame(request: VisionRequest):
    api_key = os.getenv("GEMINI_API_KEY", "your_key")
    use_fallback = False
    result_data = {}

    # If the key is default/placeholder, use local mock immediately
    if api_key == "your_key" or not api_key:
        use_fallback = True
        logger.info("Using local mock fallback for Gemini Vision (No API key).")
    else:
        # Call Google Gemini API
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        # Prepare content query prompt depending on request mode
        prompt = (
            f"Analyze this image for FIFA World Cup fans. Mode: {request.mode}. "
            "If it is a menu, extract items and translate to English with price. "
            "If it is a scene, determine the orientation."
        )
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": "image/jpeg",
                                "data": request.image_b64
                            }
                        }
                    ]
                }
            ]
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(gemini_url, json=payload, timeout=4.0)
                if response.status_code == 200:
                    resp_json = response.json()
                    # Extract text output from Gemini response structure
                    text_out = resp_json['candidates'][0]['content']['parts'][0]['text']
                    result_data["gemini_analysis"] = text_out
                    logger.info("Successfully received response from Gemini API.")
                else:
                    logger.error(f"Gemini API returned status code {response.status_code}: {response.text}")
                    use_fallback = True
        except Exception as e:
            logger.error(f"Failed to communicate with Gemini API. Details: {e}")
            use_fallback = True

    # Build local mock response if fallback is active
    if use_fallback:
        if request.mode == "MENU_TRANSLATION":
            # Deterministically mock German translations for Zone C3, Spanish for others
            menu_lang = "German" if "C" in request.zone_id else "Spanish"
            items = [TranslationItem(**item) for item in MOCK_TRANSLATIONS[menu_lang]]
            result_data = {
                "translations": [item.model_dump() for item in items],
                "wayfinding_vector": None,
                "order_url": f"/order/seat?zone={request.zone_id}&item={items[0].original.lower().replace(' ', '_')}"
            }
        elif request.mode == "WAYFINDING":
            # Direct the user to the destination based on their zone
            angle = 45.0 if "A" in request.zone_id else (135.0 if "B" in request.zone_id else 270.0)
            vector = WayfindingVector(angle_deg=angle, distance_m=120.0)
            result_data = {
                "translations": [],
                "wayfinding_vector": vector.model_dump(),
                "order_url": None
            }
        else:  # SEAT_DELIVERY
            result_data = {
                "translations": [],
                "wayfinding_vector": None,
                "order_url": f"/order/seat?zone={request.zone_id}&seat=Row12-Seat4"
            }

    return VisionResponse(
        request_id=request.request_id,
        mode=request.mode,
        success=True,
        fallback_used=use_fallback,
        result=result_data
    )

@router.post("/api/voucher-redeemed")
async def redeem_voucher(request: VoucherRedemption):
    """
    Logs active fan voucher redemptions.
    """
    logger.warning(f"VOUCHER REDEEMED: Code: {request.voucher_code} in Zone: {request.fan_zone}")
    return {
        "success": True,
        "message": f"Voucher {request.voucher_code} successfully redeemed.",
        "timestamp": os.getenv("TIMESTAMP") or "2026-07-16T05:30:54Z"
    }
