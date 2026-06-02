import { getVehicleColor } from "../utils";

export function MovingVehicle({ vehicle }) {
  return (
    <div
      className={`moving-car ${vehicle.type === "truck" ? "moving-truck" : ""}`}
      style={{
        "--start-x": `${vehicle.startX}px`,
        "--start-y": `${vehicle.startY}px`,
        "--end-x": `${vehicle.endX}px`,
        "--end-y": `${vehicle.endY}px`,
        "--vehicle-color": vehicle.color,
      }}
    >
      {vehicle.type === "truck" ? <TruckBody /> : <CarBody />}
    </div>
  );
}

export function ParkedVehicle({ place }) {
  const carId = place.vehicle.carId;
  const type = place.vehicle.type;

  return (
    <div
      className={`vehicle ${type === "truck" ? "truck" : "car"}`}
      style={{
        "--vehicle-color": getVehicleColor(type, carId),
      }}
    >
      {type === "truck" ? <TruckBody /> : <CarBody />}
    </div>
  );
}

function CarBody() {
  return (
    <>
      <div className="car-top" />
      <div className="car-body" />
      <div className="wheel car-wheel-left" />
      <div className="wheel car-wheel-right" />
    </>
  );
}

function TruckBody() {
  return (
    <>
      <div className="truck-box" />
      <div className="truck-cabin" />
      <div className="wheel truck-wheel-left" />
      <div className="wheel truck-wheel-right" />
    </>
  );
}
