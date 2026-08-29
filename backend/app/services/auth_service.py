import bcrypt
import jwt
import warnings
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from app.config import settings

# Suppress key length warning if secret_key is short in local development
warnings.filterwarnings("ignore", category=UserWarning, module="jwt.*")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 4

def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generates a signed JWT access token containing the user payload and expiry."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and verifies the JWT token. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
