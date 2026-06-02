import csv
import io

from fastapi import APIRouter, File, UploadFile

from .models import CarCreate, SettingsUpdate
from .parking import parking

router = APIRouter()


@router.get("/")
def root():
    return {
        "message": "Parking API is working",
    }


@router.get("/state")
def get_state():
    return parking.get_state_data()


@router.get("/settings")
def get_settings():
    return parking.settings


@router.post("/settings")
def update_settings(new_settings: SettingsUpdate):
    if new_settings.carPlacesCount <= 0:
        return {
            "success": False,
            "message": "Количество мест для легковых должно быть больше 0",
        }

    if new_settings.truckPlacesCount <= 0:
        return {
            "success": False,
            "message": "Количество мест для грузовых должно быть больше 0",
        }

    if new_settings.hourMs < 500:
        return {
            "success": False,
            "message": "Время должно быть хотя бы 500 мс",
        }

    parking.update_settings(new_settings)

    return {
        "success": True,
        "message": "Настройки сохранены",
        "state": parking.get_state_data(),
    }


@router.post("/add-car")
def add_car(car: CarCreate):
    validation_error = validate_car_data(car.type, car.arrival, car.hours)

    if validation_error:
        return validation_error

    new_car = parking.add_car(car.type, car.arrival, car.hours)

    return {
        "success": True,
        "message": "Машина добавлена",
        "car": new_car,
        "state": parking.get_state_data(),
    }


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    added = 0
    errors = []

    for index, row in enumerate(reader, start=2):
        try:
            car_type = row["type"].strip()
            arrival = int(row["arrival"])
            hours = int(row["hours"])
            validation_error = validate_car_data(car_type, arrival, hours)

            if validation_error:
                errors.append(f"Строка {index}: {validation_error['message']}")
                continue

            parking.add_car_from_file(car_type, arrival, hours)
            added += 1

        except Exception:
            errors.append(f"Строка {index}: ошибка чтения")

    parking.finish_file_upload()

    return {
        "success": True,
        "message": f"Загружено машин: {added}",
        "added": added,
        "errors": errors,
        "state": parking.get_state_data(),
    }


@router.post("/tick")
def tick():
    parking.move_time()

    return {
        "success": True,
        "message": "Время сдвинуто на 1 час",
        "state": parking.get_state_data(),
    }


@router.post("/reset")
def reset():
    parking.reset_all()

    return {
        "success": True,
        "message": "Парковка очищена",
        "state": parking.get_state_data(),
    }


def validate_car_data(car_type, arrival, hours):
    if car_type not in ["car", "truck"]:
        return {
            "success": False,
            "message": "type должен быть car или truck",
        }

    if arrival < 0:
        return {
            "success": False,
            "message": "arrival должен быть 0 или больше",
        }

    if hours <= 0:
        return {
            "success": False,
            "message": "hours должен быть больше 0",
        }

    return None
