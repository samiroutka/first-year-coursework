from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import csv
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = {
    "carPlacesCount": 18,
    "truckPlacesCount": 4,
    "hourMs": 2000,
}

time = 0
places = []
queue = []
history = []
next_car_id = 1


class CarCreate(BaseModel):
    type: str
    arrival: int
    hours: int


class SettingsUpdate(BaseModel):
    carPlacesCount: int
    truckPlacesCount: int
    hourMs: int


def create_places():
    result = []

    for i in range(1, settings["carPlacesCount"] + 1):
        result.append({
            "id": i,
            "type": "car",
            "busy": False,
            "vehicle": None
        })

    start_truck_id = settings["carPlacesCount"] + 1
    end_truck_id = settings["carPlacesCount"] + settings["truckPlacesCount"] + 1

    for i in range(start_truck_id, end_truck_id):
        result.append({
            "id": i,
            "type": "truck",
            "busy": False,
            "vehicle": None
        })

    return result


def reset_all():
    global time, places, queue, history, next_car_id

    time = 0
    places = create_places()
    queue = []
    history = []
    next_car_id = 1


def get_free_place(car_type):
    for place in places:
        if place["type"] == car_type and not place["busy"]:
            return place

    return None


def get_stats():
    free_car_places = len([
        place for place in places
        if place["type"] == "car" and not place["busy"]
    ])

    free_truck_places = len([
        place for place in places
        if place["type"] == "truck" and not place["busy"]
    ])

    waiting = len([car for car in queue if car["status"] == "waiting"])
    parked = len([car for car in queue if car["status"] == "parked"])
    left = len([car for car in queue if car["status"] == "left"])

    return {
        "time": time,
        "freeCarPlaces": free_car_places,
        "freeTruckPlaces": free_truck_places,
        "waitingCars": waiting,
        "parkedCars": parked,
        "leftCars": left,
        "totalCars": len(queue)
    }


def get_state_data():
    return {
        "time": time,
        "places": places,
        "queue": queue,
        "history": history,
        "stats": get_stats(),
        "settings": settings,
    }


def process_queue():
    for car in queue:
        if car["status"] != "waiting":
            continue

        if car["arrival"] > time:
            continue

        free_place = get_free_place(car["type"])

        if free_place is None:
            car["status"] = "left"

            history.append({
                "carId": car["id"],
                "type": car["type"],
                "arrival": car["arrival"],
                "hours": car["hours"],
                "status": "left",
                "message": "Нет свободных мест"
            })

            continue

        free_place["busy"] = True
        free_place["vehicle"] = {
            "carId": car["id"],
            "type": car["type"],
            "hoursLeft": car["hours"],
            "totalHours": car["hours"],
            "arrival": car["arrival"]
        }

        car["status"] = "parked"
        car["placeId"] = free_place["id"]

        history.append({
            "carId": car["id"],
            "type": car["type"],
            "arrival": car["arrival"],
            "hours": car["hours"],
            "status": "parked",
            "placeId": free_place["id"]
        })


def move_time():
    global time

    time += 1

    for place in places:
        if not place["busy"]:
            continue

        place["vehicle"]["hoursLeft"] -= 1

        if place["vehicle"]["hoursLeft"] <= 0:
            history.append({
                "carId": place["vehicle"]["carId"],
                "type": place["vehicle"]["type"],
                "status": "finished",
                "placeId": place["id"],
                "message": "Машина уехала после окончания времени"
            })

            place["busy"] = False
            place["vehicle"] = None

    process_queue()


reset_all()


@app.get("/")
def root():
    return {
        "message": "Parking API is working"
    }


@app.get("/state")
def get_state():
    return get_state_data()


@app.get("/settings")
def get_settings():
    return settings


@app.post("/settings")
def update_settings(new_settings: SettingsUpdate):
    global settings

    if new_settings.carPlacesCount <= 0:
        return {
            "success": False,
            "message": "Количество мест для легковых должно быть больше 0"
        }

    if new_settings.truckPlacesCount <= 0:
        return {
            "success": False,
            "message": "Количество мест для грузовых должно быть больше 0"
        }

    if new_settings.hourMs < 500:
        return {
            "success": False,
            "message": "Время должно быть хотя бы 500 мс"
        }

    places_count_changed = (
        settings["carPlacesCount"] != new_settings.carPlacesCount
        or settings["truckPlacesCount"] != new_settings.truckPlacesCount
    )

    settings = {
        "carPlacesCount": new_settings.carPlacesCount,
        "truckPlacesCount": new_settings.truckPlacesCount,
        "hourMs": new_settings.hourMs,
    }

    if places_count_changed:
        reset_all()

    return {
        "success": True,
        "message": "Настройки сохранены",
        "state": get_state_data()
    }


@app.post("/add-car")
def add_car(car: CarCreate):
    global next_car_id

    if car.type not in ["car", "truck"]:
        return {
            "success": False,
            "message": "type должен быть car или truck"
        }

    if car.arrival < 0:
        return {
            "success": False,
            "message": "arrival должен быть 0 или больше"
        }

    if car.hours <= 0:
        return {
            "success": False,
            "message": "hours должен быть больше 0"
        }

    new_car = {
        "id": next_car_id,
        "type": car.type,
        "arrival": car.arrival,
        "hours": car.hours,
        "status": "waiting",
        "placeId": None
    }

    next_car_id += 1

    queue.append(new_car)
    queue.sort(key=lambda item: item["arrival"])

    process_queue()

    return {
        "success": True,
        "message": "Машина добавлена",
        "car": new_car,
        "state": get_state_data()
    }


@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    global next_car_id

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

            if car_type not in ["car", "truck"]:
                errors.append(f"Строка {index}: type должен быть car или truck")
                continue

            if arrival < 0:
                errors.append(f"Строка {index}: arrival должен быть 0 или больше")
                continue

            if hours <= 0:
                errors.append(f"Строка {index}: hours должен быть больше 0")
                continue

            queue.append({
                "id": next_car_id,
                "type": car_type,
                "arrival": arrival,
                "hours": hours,
                "status": "waiting",
                "placeId": None
            })

            next_car_id += 1
            added += 1

        except Exception:
            errors.append(f"Строка {index}: ошибка чтения")

    queue.sort(key=lambda item: item["arrival"])

    process_queue()

    return {
        "success": True,
        "message": f"Загружено машин: {added}",
        "added": added,
        "errors": errors,
        "state": get_state_data()
    }


@app.post("/tick")
def tick():
    move_time()

    return {
        "success": True,
        "message": "Время сдвинуто на 1 час",
        "state": get_state_data()
    }


@app.post("/reset")
def reset():
    reset_all()

    return {
        "success": True,
        "message": "Парковка очищена",
        "state": get_state_data()
    }