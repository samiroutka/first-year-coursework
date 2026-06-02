from database import init_db, load_state, save_state


DEFAULT_SETTINGS = {
    "carPlacesCount": 18,
    "truckPlacesCount": 4,
    "hourMs": 2000,
}


class ParkingSettings:
    def __init__(self, car_places_count, truck_places_count, hour_ms):
        self.car_places_count = car_places_count
        self.truck_places_count = truck_places_count
        self.hour_ms = hour_ms

    @classmethod
    def from_dict(cls, data):
        return cls(
            data["carPlacesCount"],
            data["truckPlacesCount"],
            data["hourMs"],
        )

    @classmethod
    def from_update(cls, data):
        return cls(
            data.carPlacesCount,
            data.truckPlacesCount,
            data.hourMs,
        )

    def places_count_changed(self, other):
        return (
            self.car_places_count != other.car_places_count
            or self.truck_places_count != other.truck_places_count
        )

    def to_dict(self):
        return {
            "carPlacesCount": self.car_places_count,
            "truckPlacesCount": self.truck_places_count,
            "hourMs": self.hour_ms,
        }


class Vehicle:
    def __init__(
        self,
        car_id,
        car_type,
        arrival,
        hours,
        hours_left=None,
        status="waiting",
        place_id=None,
    ):
        self.id = car_id
        self.type = car_type
        self.arrival = arrival
        self.hours = hours
        self.hours_left = hours if hours_left is None else hours_left
        self.status = status
        self.place_id = place_id

    @classmethod
    def from_dict(cls, data):
        return cls(
            data["id"],
            data["type"],
            data["arrival"],
            data["hours"],
            data.get("hoursLeft", data["hours"]),
            data.get("status", "waiting"),
            data.get("placeId"),
        )

    def park(self, place_id):
        self.status = "parked"
        self.place_id = place_id

    def leave(self):
        self.status = "left"
        self.place_id = None

    def finish(self):
        self.status = "finished"
        self.hours_left = 0

    def to_place_vehicle(self):
        return {
            "carId": self.id,
            "type": self.type,
            "hoursLeft": self.hours_left,
            "totalHours": self.hours,
            "arrival": self.arrival,
        }

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "arrival": self.arrival,
            "hours": self.hours,
            "hoursLeft": self.hours_left,
            "status": self.status,
            "placeId": self.place_id,
        }


class ParkingPlace:
    def __init__(self, place_id, place_type):
        self.id = place_id
        self.type = place_type
        self.vehicle = None

    @property
    def busy(self):
        return self.vehicle is not None

    def park_vehicle(self, vehicle):
        self.vehicle = vehicle
        vehicle.park(self.id)

    def free(self):
        self.vehicle = None

    def tick(self):
        if self.vehicle is None:
            return

        self.vehicle.hours_left -= 1

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "busy": self.busy,
            "vehicle": (
                self.vehicle.to_place_vehicle()
                if self.vehicle is not None
                else None
            ),
        }


class HistoryEvent:
    def __init__(
        self,
        car_id,
        car_type,
        status,
        arrival=None,
        hours=None,
        place_id=None,
        message=None,
    ):
        self.car_id = car_id
        self.type = car_type
        self.arrival = arrival
        self.hours = hours
        self.status = status
        self.place_id = place_id
        self.message = message

    @classmethod
    def from_dict(cls, data):
        return cls(
            data["carId"],
            data["type"],
            data["status"],
            data.get("arrival"),
            data.get("hours"),
            data.get("placeId"),
            data.get("message"),
        )

    def to_dict(self):
        result = {
            "carId": self.car_id,
            "type": self.type,
            "status": self.status,
        }

        if self.arrival is not None:
            result["arrival"] = self.arrival

        if self.hours is not None:
            result["hours"] = self.hours

        if self.place_id is not None:
            result["placeId"] = self.place_id

        if self.message is not None:
            result["message"] = self.message

        return result


class ParkingState:
    def __init__(self):
        init_db()

        saved_state = load_state()

        if saved_state:
            self._settings = ParkingSettings.from_dict(saved_state["settings"])
            self.time = saved_state["time"]
            self.queue = [
                Vehicle.from_dict(car)
                for car in saved_state["queue"]
            ]
            self.history = [
                HistoryEvent.from_dict(event)
                for event in saved_state["history"]
            ]
            self.next_car_id = saved_state["next_car_id"]
            self.places = self.create_places()
            self.restore_parked_places()
            return

        self._settings = ParkingSettings.from_dict(DEFAULT_SETTINGS)
        self.time = 0
        self.places = []
        self.queue = []
        self.history = []
        self.next_car_id = 1
        self.reset_all()

    @property
    def settings(self):
        return self._settings.to_dict()

    def persist(self):
        save_state(
            self.settings,
            self.time,
            [car.to_dict() for car in self.queue],
            [event.to_dict() for event in self.history],
            self.next_car_id,
        )

    def create_places(self):
        result = []

        for i in range(1, self._settings.car_places_count + 1):
            result.append(ParkingPlace(i, "car"))

        start_truck_id = self._settings.car_places_count + 1
        end_truck_id = (
            self._settings.car_places_count
            + self._settings.truck_places_count
            + 1
        )

        for i in range(start_truck_id, end_truck_id):
            result.append(ParkingPlace(i, "truck"))

        return result

    def restore_parked_places(self):
        for car in self.queue:
            if car.status != "parked" or car.place_id is None:
                continue

            place = self.get_place_by_id(car.place_id)

            if place is None:
                car.leave()
                continue

            place.park_vehicle(car)

    def reset_all(self):
        self.time = 0
        self.places = self.create_places()
        self.queue = []
        self.history = []
        self.next_car_id = 1
        self.persist()

    def update_settings(self, new_settings):
        updated_settings = ParkingSettings.from_update(new_settings)
        places_count_changed = self._settings.places_count_changed(
            updated_settings,
        )

        self._settings = updated_settings

        if places_count_changed:
            self.reset_all()
            return

        self.persist()

    def get_place_by_id(self, place_id):
        for place in self.places:
            if place.id == place_id:
                return place

        return None

    def get_free_place(self, car_type):
        for place in self.places:
            if place.type == car_type and not place.busy:
                return place

        return None

    def get_stats(self):
        free_car_places = len([
            place for place in self.places
            if place.type == "car" and not place.busy
        ])

        free_truck_places = len([
            place for place in self.places
            if place.type == "truck" and not place.busy
        ])

        waiting = len([car for car in self.queue if car.status == "waiting"])
        parked = len([car for car in self.queue if car.status == "parked"])
        left = len([car for car in self.queue if car.status == "left"])

        return {
            "time": self.time,
            "freeCarPlaces": free_car_places,
            "freeTruckPlaces": free_truck_places,
            "waitingCars": waiting,
            "parkedCars": parked,
            "leftCars": left,
            "totalCars": len(self.queue),
        }

    def get_state_data(self):
        return {
            "time": self.time,
            "places": [place.to_dict() for place in self.places],
            "queue": [car.to_dict() for car in self.queue],
            "history": [event.to_dict() for event in self.history],
            "stats": self.get_stats(),
            "settings": self.settings,
        }

    def add_car(self, car_type, arrival, hours):
        new_car = self.create_car(car_type, arrival, hours)

        self.next_car_id += 1
        self.queue.append(new_car)
        self.queue.sort(key=lambda item: item.arrival)
        self.process_queue()
        self.persist()

        return new_car.to_dict()

    def add_car_from_file(self, car_type, arrival, hours):
        self.queue.append(self.create_car(car_type, arrival, hours))
        self.next_car_id += 1

    def create_car(self, car_type, arrival, hours):
        return Vehicle(self.next_car_id, car_type, arrival, hours)

    def finish_file_upload(self):
        self.queue.sort(key=lambda item: item.arrival)
        self.process_queue()
        self.persist()

    def add_history_event(
        self,
        car,
        status,
        place_id=None,
        message=None,
    ):
        self.history.append(
            HistoryEvent(
                car.id,
                car.type,
                status,
                car.arrival,
                car.hours,
                place_id,
                message,
            ),
        )

    def process_queue(self):
        for car in self.queue:
            if car.status != "waiting":
                continue

            if car.arrival > self.time:
                continue

            free_place = self.get_free_place(car.type)

            if free_place is None:
                car.leave()
                self.add_history_event(
                    car,
                    "left",
                    message="Нет свободных мест",
                )
                continue

            free_place.park_vehicle(car)
            self.add_history_event(car, "parked", free_place.id)

    def move_time(self):
        self.time += 1

        for place in self.places:
            if not place.busy:
                continue

            place.tick()

            if place.vehicle.hours_left <= 0:
                self.finish_parking(place)

        self.process_queue()
        self.persist()

    def finish_parking(self, place):
        car = place.vehicle

        self.history.append(
            HistoryEvent(
                car.id,
                car.type,
                "finished",
                place_id=place.id,
                message="Машина уехала после окончания времени",
            ),
        )

        car.finish()
        place.free()


parking = ParkingState()
