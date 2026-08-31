from fastapi import Header, HTTPException, status

from app.core.config import settings


async def verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    # AI service is never exposed to the internet; only the backend/worker call it,
    # authenticated with a shared secret set via AI_SERVICE_INTERNAL_KEY / internal_api_key.
    if not settings.internal_api_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API key")
