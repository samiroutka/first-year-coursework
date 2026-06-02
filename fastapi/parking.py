class ParkingState:
    def __init__(self):
        self.settings = {
            "carPlacesCount": 18,
            "truckPlacesCount": 4,
            "hourMs": 2000,
        }
        self.time = 0
        self.places = []
        self.queue = []
        self.history = []
        self.next_car_id = 1
        self.reset_all()

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

    def reset_all(self):
        self.time = 0
        self.places = self.create_places()
        self.queue = []
        self.history = []
        self.next_car_id = 1

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
        new_car = {
            "id": self.next_car_id,
            "type": car_type,
            "arrival": arrival,
            "hours": hours,
            "status": "waiting",
            "placeId": None,
        }

        self.next_car_id += 1
        self.queue.append(new_car)
        self.queue.sort(key=lambda item: item["arrival"])
        self.process_queue()

        return new_car

    def add_car_from_file(self, car_type, arrival, hours):
        self.queue.append({
            "id": self.next_car_id,
            "type": car_type,
            "arrival": arrival,
            "hours": hours,
            "status": "waiting",
            "placeId": None,
        })

        self.next_car_id += 1

    def finish_file_upload(self):
        self.queue.sort(key=lambda item: item["arrival"])
        self.process_queue()

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
                "hoursLeft": car["hours"],
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

            if place["vehicle"]["hoursLeft"] <= 0:
                self.history.append({
                    "carId": place["vehicle"]["carId"],
                    "type": place["vehicle"]["type"],
                    "status": "finished",
                    "placeId": place["id"],
                    "message": "Машина уехала после окончания времени",
                })

                place["busy"] = False
                place["vehicle"] = None

        self.process_queue()


parking = ParkingState()
