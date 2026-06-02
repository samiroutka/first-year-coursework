from database import init_db, load_state, save_state


DEFAULT_SETTINGS = {
    "carPlacesCount": 18,
    "truckPlacesCount": 4,
    "hourMs": 2000,
}


class ParkingState:
    def __init__(self):
        init_db()

        saved_state = load_state()

        if saved_state:
            self.settings = saved_state["settings"]
            self.time = saved_state["time"]
            self.queue = saved_state["queue"]
            self.history = saved_state["history"]
            self.next_car_id = saved_state["next_car_id"]
            self.places = self.create_places()
            self.restore_parked_places()
            return

        self.settings = DEFAULT_SETTINGS.copy()
        self.time = 0
        self.places = []
        self.queue = []
        self.history = []
        self.next_car_id = 1
        self.reset_all()

    def persist(self):
        save_state(
            self.settings,
            self.time,
            self.queue,
            self.history,
            self.next_car_id,
        )

    def create_places(self):
        result = []

        for i in range(1, self.settings["carPlacesCount"] + 1):
            result.append({
                "id": i,
                "type": "car",
                "busy": False,
                "vehicle": None,
            })

        start_truck_id = self.settings["carPlacesCount"] + 1
        end_truck_id = (
            self.settings["carPlacesCount"]
            + self.settings["truckPlacesCount"]
            + 1
        )

        for i in range(start_truck_id, end_truck_id):
            result.append({
                "id": i,
                "type": "truck",
                "busy": False,
                "vehicle": None,
            })

        return result

    def restore_parked_places(self):
        for car in self.queue:
            if car["status"] != "parked" or car.get("placeId") is None:
                continue

            place = self.get_place_by_id(car["placeId"])

            if place is None:
                car["status"] = "left"
                car["placeId"] = None
                continue

            place["busy"] = True
            place["vehicle"] = {
                "carId": car["id"],
                "type": car["type"],
                "hoursLeft": car.get("hoursLeft", car["hours"]),
                "totalHours": car["hours"],
                "arrival": car["arrival"],
            }

    def reset_all(self):
        self.time = 0
        self.places = self.create_places()
        self.queue = []
        self.history = []
        self.next_car_id = 1
        self.persist()

    def update_settings(self, new_settings):
        places_count_changed = (
            self.settings["carPlacesCount"] != new_settings.carPlacesCount
            or self.settings["truckPlacesCount"] != new_settings.truckPlacesCount
        )

        self.settings = {
            "carPlacesCount": new_settings.carPlacesCount,
            "truckPlacesCount": new_settings.truckPlacesCount,
            "hourMs": new_settings.hourMs,
        }

        if places_count_changed:
            self.reset_all()
            return

        self.persist()

    def get_place_by_id(self, place_id):
        for place in self.places:
            if place["id"] == place_id:
                return place

        return None

    def get_free_place(self, car_type):
        for place in self.places:
            if place["type"] == car_type and not place["busy"]:
                return place

        return None

    def get_stats(self):
        free_car_places = len([
            place for place in self.places
            if place["type"] == "car" and not place["busy"]
        ])

        free_truck_places = len([
            place for place in self.places
            if place["type"] == "truck" and not place["busy"]
        ])

        waiting = len([car for car in self.queue if car["status"] == "waiting"])
        parked = len([car for car in self.queue if car["status"] == "parked"])
        left = len([car for car in self.queue if car["status"] == "left"])

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
            "places": self.places,
            "queue": self.queue,
            "history": self.history,
            "stats": self.get_stats(),
            "settings": self.settings,
        }

    def add_car(self, car_type, arrival, hours):
        new_car = self.create_car(car_type, arrival, hours)

        self.next_car_id += 1
        self.queue.append(new_car)
        self.queue.sort(key=lambda item: item["arrival"])
        self.process_queue()
        self.persist()

        return new_car

    def add_car_from_file(self, car_type, arrival, hours):
        self.queue.append(self.create_car(car_type, arrival, hours))
        self.next_car_id += 1

    def create_car(self, car_type, arrival, hours):
        return {
            "id": self.next_car_id,
            "type": car_type,
            "arrival": arrival,
            "hours": hours,
            "hoursLeft": hours,
            "status": "waiting",
            "placeId": None,
        }

    def finish_file_upload(self):
        self.queue.sort(key=lambda item: item["arrival"])
        self.process_queue()
        self.persist()

    def process_queue(self):
        for car in self.queue:
            if car["status"] != "waiting":
                continue

            if car["arrival"] > self.time:
                continue

            free_place = self.get_free_place(car["type"])

            if free_place is None:
                car["status"] = "left"

                self.history.append({
                    "carId": car["id"],
                    "type": car["type"],
                    "arrival": car["arrival"],
                    "hours": car["hours"],
                    "status": "left",
                    "message": "Нет свободных мест",
                })

                continue

            free_place["busy"] = True
            free_place["vehicle"] = {
                "carId": car["id"],
                "type": car["type"],
                "hoursLeft": car["hoursLeft"],
                "totalHours": car["hours"],
                "arrival": car["arrival"],
            }

            car["status"] = "parked"
            car["placeId"] = free_place["id"]

            self.history.append({
                "carId": car["id"],
                "type": car["type"],
                "arrival": car["arrival"],
                "hours": car["hours"],
                "status": "parked",
                "placeId": free_place["id"],
            })

    def move_time(self):
        self.time += 1

        for place in self.places:
            if not place["busy"]:
                continue

            place["vehicle"]["hoursLeft"] -= 1
            self.update_car_hours_left(
                place["vehicle"]["carId"],
                place["vehicle"]["hoursLeft"],
            )

            if place["vehicle"]["hoursLeft"] <= 0:
                self.finish_parking(place)

        self.process_queue()
        self.persist()

    def update_car_hours_left(self, car_id, hours_left):
        for car in self.queue:
            if car["id"] == car_id:
                car["hoursLeft"] = hours_left
                return

    def finish_parking(self, place):
        car_id = place["vehicle"]["carId"]

        self.history.append({
            "carId": car_id,
            "type": place["vehicle"]["type"],
            "status": "finished",
            "placeId": place["id"],
            "message": "Машина уехала после окончания времени",
        })

        for car in self.queue:
            if car["id"] == car_id:
                car["status"] = "finished"
                car["hoursLeft"] = 0
                break

        place["busy"] = False
        place["vehicle"] = None


parking = ParkingState()
