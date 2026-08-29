from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Union, List

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://vitals:vitals_dev@localhost:5432/vitals_db"
    
    cors_origins: Union[List[str], str] = ["http://localhost:3000"]
    environment: str = "development"
    secret_key: str = ""
    sms_gateway_local_url: str = ""
    sms_gateway_username: str = "sms"
    sms_gateway_password: str = ""
    sms_confirmation_recipient: str = ""
    admin_username: str = "Akshay"
    admin_password_plaintext: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
