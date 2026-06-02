from pydantic import BaseModel


class CarCreate(BaseModel):
    type: str
    arrival: int
    hours: int


class SettingsUpdate(BaseModel):
    carPlacesCount: int
    truckPlacesCount: int
    hourMs: int
