from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

class BinCreate(BaseModel):
    data: Dict[str, Any]
    is_private: bool = False
    name: Optional[str] = None

class BinResponse(BaseModel):
    id: str
    data: Dict[str, Any]
    is_private: bool
    name: Optional[str]
    created_at: datetime
    updated_at: datetime
    access_count: int = 0

class BinUpdate(BaseModel):
    data: Optional[Dict[str, Any]] = None
    name: Optional[str] = None
    is_private: Optional[bool] = None