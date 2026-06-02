import { MovingVehicle } from "./Vehicle";
import { ParkingSpot } from "./ParkingSpot";

export function ParkingLayout({
  carPlaces,
  truckPlaces,
  stats,
  movingVehicle,
  parkingRef,
  gateRef,
  registerSpot,
}) {
  return (
    <div className="parking" ref={parkingRef}>
      <div className="gate" ref={gateRef}>
        <div className="gate-road" />
        <div className="gate-sign">Въезд</div>
      </div>

      {movingVehicle && <MovingVehicle vehicle={movingVehicle} />}

      <ParkingZone
        title="Легковые места"
        freeCount={stats ? stats.freeCarPlaces : 0}
        places={carPlaces}
        gridClassName="cars-grid"
        registerSpot={registerSpot}
      />

      <div className="lane-divider" />

      <ParkingZone
        title="Грузовые места"
        freeCount={stats ? stats.freeTruckPlaces : 0}
        places={truckPlaces}
        gridClassName="trucks-grid"
        registerSpot={registerSpot}
      />
    </div>
  );
}

function ParkingZone({ title, freeCount, places, gridClassName, registerSpot }) {
  return (
    <section className="zone">
      <div className="zone-header">
        <h2>{title}</h2>
        <span>
          {freeCount} свободно из {places.length}
        </span>
      </div>

      <div className={`grid ${gridClassName}`}>
        {places.map((place) => (
          <ParkingSpot
            key={place.id}
            place={place}
            registerSpot={registerSpot}
          />
        ))}
      </div>
    </section>
  );
}
