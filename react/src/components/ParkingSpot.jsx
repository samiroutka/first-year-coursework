import { ParkedVehicle } from "./Vehicle";

export function ParkingSpot({ place, registerSpot }) {
  const isTruck = place.type === "truck";

  return (
    <div
      ref={(el) => {
        registerSpot(place.id, el);
      }}
      className={`spot ${isTruck ? "truck-spot" : "car-spot"} ${
        place.busy ? "busy" : ""
      }`}
    >
      <div className="spot-number">№{place.id}</div>

      {!place.busy && (
        <div className="spot-label">{isTruck ? "TRUCK" : "CAR"}</div>
      )}

      {place.busy && (
        <>
          <ParkedVehicle place={place} />
          <div className="hours-badge">{place.vehicle.hoursLeft} ч</div>
        </>
      )}
    </div>
  );
}
