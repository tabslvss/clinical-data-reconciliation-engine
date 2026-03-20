import os
from fastapi import HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader

API_KEY_NAME = "x-api-key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


def get_api_key(api_key: str = Security(api_key_header)) -> str:
    expected_key = os.getenv("API_KEY", "dev-secret-key")
    if not api_key or api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key. Pass your key in the x-api-key header.",
        )
    return api_key
