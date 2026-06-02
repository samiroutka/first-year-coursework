import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "http://127.0.0.1:8000";
const DRIVE_MS = 1200;

const CAR_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];
const TRUCK_COLORS = ["#2563eb", "#f97316", "#16a34a", "#dc2626"];

function getVehicleColor(type, id) {
  const palette = type === "truck" ? TRUCK_COLORS : CAR_COLORS;
  return palette[id % palette.length];
}

function formatTime(totalHours) {
  const day = Math.floor(totalHours / 24) + 1;
  const hour = totalHours % 24;
  return `День ${day} · ${String(hour).padStart(2, "0")}:00`;
}

export default function App() {
  const [places, setPlaces] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState("Подключение к серверу...");
  const [movingVehicle, setMovingVehicle] = useState(null);

  const [settings, setSettings] = useState({
    carPlacesCount: 18,
    truckPlacesCount: 4,
    hourMs: 2000,
  });

  const [settingsForm, setSettingsForm] = useState({
    carPlacesCount: 18,
    truckPlacesCount: 4,
    secondsPerHour: 2,
  });

  const placesRef = useRef([]);
  const parkingRef = useRef(null);
  const gateRef = useRef(null);
  const spotRefs = useRef({});

  function registerSpot(placeId, element) {
    spotRefs.current[placeId] = element;
  }

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    loadState(true);

    const timer = setInterval(() => {
      tick();
    }, settings.hourMs);

    return () => clearInterval(timer);
  }, [settings.hourMs]);

  function updateState(data) {
    setPlaces(data.places);
    setQueue(data.queue);
    setStats(data.stats);
    setTime(data.time);

    if (data.settings) {
      setSettings(data.settings);

      setSettingsForm({
        carPlacesCount: data.settings.carPlacesCount,
        truckPlacesCount: data.settings.truckPlacesCount,
        secondsPerHour: data.settings.hourMs / 1000,
      });
    }
  }

  async function loadState(firstLoad = false) {
    try {
      const response = await fetch(`${API_URL}/state`);
      const data = await response.json();

      if (firstLoad) {
        updateState(data);
        setMessage("Парковка подключена к FastAPI");
      } else {
        applyStateWithAnimation(data);
      }
    } catch {
      setMessage("Не удалось подключиться к FastAPI");
    }
  }

  async function tick() {
    try {
      const response = await fetch(`${API_URL}/tick`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.state) {
        applyStateWithAnimation(data.state);
      }
    } catch {
      setMessage("Ошибка при обновлении времени");
    }
  }

  function applyStateWithAnimation(newState) {
    if (newState.settings) {
      setSettings(newState.settings);
    }

    const oldPlaces = placesRef.current;
    const newPlaces = newState.places;

    const newBusyPlace = newPlaces.find((newPlace) => {
      const oldPlace = oldPlaces.find((place) => place.id === newPlace.id);

      return oldPlace && !oldPlace.busy && newPlace.busy && newPlace.vehicle;
    });

    setQueue(newState.queue);
    setStats(newState.stats);
    setTime(newState.time);

    if (!newBusyPlace || movingVehicle) {
      setPlaces(newPlaces);
      return;
    }

    const parking = parkingRef.current;
    const gate = gateRef.current;
    const spot = spotRefs.current[newBusyPlace.id];

    if (!parking || !gate || !spot) {
      setPlaces(newPlaces);
      return;
    }

    const parkingRect = parking.getBoundingClientRect();
    const gateRect = gate.getBoundingClientRect();
    const spotRect = spot.getBoundingClientRect();

    const startX = gateRect.left - parkingRect.left + gateRect.width / 2;
    const startY = gateRect.top - parkingRect.top + gateRect.height / 2;

    const endX = spotRect.left - parkingRect.left + spotRect.width / 2;
    const endY = spotRect.top - parkingRect.top + spotRect.height / 2;

    const carId = newBusyPlace.vehicle.carId;
    const type = newBusyPlace.vehicle.type;

    setMovingVehicle({
      id: newBusyPlace.id,
      type,
      color: getVehicleColor(type, carId),
      startX,
      startY,
      endX,
      endY,
    });

    setMessage(
      type === "car"
        ? `Легковая машина заезжает на место №${newBusyPlace.id}`
        : `Грузовик заезжает на место №${newBusyPlace.id}`
    );

    setTimeout(() => {
      setPlaces(newPlaces);
      setMovingVehicle(null);
      setMessage(`Машина припарковалась на место №${newBusyPlace.id}`);
    }, DRIVE_MS);
  }

  async function saveSettings() {
    const carPlacesCount = Number(settingsForm.carPlacesCount);
    const truckPlacesCount = Number(settingsForm.truckPlacesCount);
    const secondsPerHour = Number(settingsForm.secondsPerHour);

    if (
      !Number.isInteger(carPlacesCount) ||
      carPlacesCount <= 0 ||
      !Number.isInteger(truckPlacesCount) ||
      truckPlacesCount <= 0 ||
      secondsPerHour <= 0
    ) {
      setMessage("Проверь настройки. Значения должны быть больше 0");
      return;
    }

    const newSettings = {
      carPlacesCount,
      truckPlacesCount,
      hourMs: Math.round(secondsPerHour * 1000),
    };

    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.message || "Настройки не сохранились");
        return;
      }

      if (data.state) {
        updateState(data.state);
        setMovingVehicle(null);
      }

      setMessage(data.message || "Настройки сохранены");
    } catch (error) {
      console.log(error);
      setMessage("Ошибка при сохранении настроек");
    }
  }

  async function addVehicle(type) {
    const arrivalInput = window.prompt("Во сколько часов машина приедет?");
    if (arrivalInput === null) return;

    const hoursInput = window.prompt("На сколько часов машина будет стоять?");
    if (hoursInput === null) return;

    const arrival = Number(arrivalInput);
    const hours = Number(hoursInput);

    if (
      !Number.isInteger(arrival) ||
      arrival < 0 ||
      !Number.isInteger(hours) ||
      hours <= 0
    ) {
      setMessage("Нужно ввести целые числа");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/add-car`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          arrival,
          hours,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.message);
        return;
      }

      applyStateWithAnimation(data.state);
      setMessage("Машина добавлена через FastAPI");
    } catch {
      setMessage("Ошибка при добавлении машины");
    }
  }

  async function uploadFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/upload-file`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.state) {
        applyStateWithAnimation(data.state);
      }

      setMessage(data.message || "Файл загружен");
    } catch {
      setMessage("Ошибка при загрузке файла");
    }

    event.target.value = "";
  }

  async function resetParking() {
    try {
      const response = await fetch(`${API_URL}/reset`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.state) {
        updateState(data.state);
        setMovingVehicle(null);
      }

      setMessage("Парковка очищена");
    } catch {
      setMessage("Ошибка при очистке парковки");
    }
  }

  const carPlaces = useMemo(
    () => places.filter((place) => place.type === "car"),
    [places]
  );

  const truckPlaces = useMemo(
    () => places.filter((place) => place.type === "truck"),
    [places]
  );

  return (
    <div className="app">
      <Styles />

      <div className="time-widget">
        <div className="time-label">Время</div>
        <div className="time-value">{formatTime(time)}</div>
        <div className="time-hint">
          {settings.hourMs / 1000} сек. = 1 час
        </div>
      </div>

      <div className="panel">
        <div className="topbar">
          <div>
            <h1>Умная парковка</h1>
            <p>React показывает интерфейс, а FastAPI управляет парковкой.</p>
          </div>

          <div className="legend">
            <div className="legend-item">
              <span className="legend-dot car-dot" />
              car — легковая
            </div>
            <div className="legend-item">
              <span className="legend-dot truck-dot" />
              truck — грузовая
            </div>
          </div>
        </div>

        <div className="controls">
          <button className="main-btn" onClick={() => addVehicle("car")}>
            + Добавить легковую
          </button>

          <button
            className="main-btn truck-btn"
            onClick={() => addVehicle("truck")}
          >
            + Добавить грузовик
          </button>

          <label className="file-btn">
            Загрузить файл
            <input type="file" accept=".csv,.txt" onChange={uploadFile} />
          </label>

          <button className="ghost-btn" onClick={resetParking}>
            Очистить
          </button>
        </div>

        <div className="file-info">
          <b>CSV формат:</b> type,arrival,hours
          <br />
          Например: car,1,3 или truck,2,5
        </div>

        <div className="settings-box">
          <h2>Настройки парковки</h2>

          <div className="settings-grid">
            <label>
              Мест для легковых
              <input
                type="number"
                min="1"
                value={settingsForm.carPlacesCount}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    carPlacesCount: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Мест для грузовых
              <input
                type="number"
                min="1"
                value={settingsForm.truckPlacesCount}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    truckPlacesCount: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Секунд за 1 час
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={settingsForm.secondsPerHour}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    secondsPerHour: e.target.value,
                  })
                }
              />
            </label>

            <button className="save-settings-btn" onClick={saveSettings}>
              Сохранить настройки
            </button>
          </div>
        </div>

        <div className="message-box">{message}</div>

        {stats && (
          <div className="stats">
            <div>
              <b>{stats.waitingCars}</b>
              <span>в очереди</span>
            </div>

            <div>
              <b>{stats.parkedCars}</b>
              <span>припарковано</span>
            </div>

            <div>
              <b>{stats.leftCars}</b>
              <span>уехали без места</span>
            </div>
          </div>
        )}

        <div className="parking" ref={parkingRef}>
          <div className="gate" ref={gateRef}>
            <div className="gate-road" />
            <div className="gate-sign">Въезд</div>
          </div>

          {movingVehicle && <MovingVehicle vehicle={movingVehicle} />}

          <section className="zone">
            <div className="zone-header">
              <h2>Легковые места</h2>
              <span>
                {stats ? stats.freeCarPlaces : 0} свободно из {carPlaces.length}
              </span>
            </div>

            <div className="grid cars-grid">
              {carPlaces.map((place) => (
                <ParkingSpot
                  key={place.id}
                  place={place}
                  registerSpot={registerSpot}
                />
              ))}
            </div>
          </section>

          <div className="lane-divider" />

          <section className="zone">
            <div className="zone-header">
              <h2>Грузовые места</h2>
              <span>
                {stats ? stats.freeTruckPlaces : 0} свободно из{" "}
                {truckPlaces.length}
              </span>
            </div>

            <div className="grid trucks-grid">
              {truckPlaces.map((place) => (
                <ParkingSpot
                  key={place.id}
                  place={place}
                  registerSpot={registerSpot}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="queue-box">
          <h2>Очередь машин</h2>

          {queue.length === 0 ? (
            <p>Пока машин нет</p>
          ) : (
            <div className="queue-list">
              {queue.map((car) => (
                <div className={`queue-item ${car.status}`} key={car.id}>
                  <b>{car.type === "car" ? "Легковая" : "Грузовик"}</b>
                  <span>Заезд: {car.arrival}:00</span>
                  <span>Стоянка: {car.hours} ч.</span>
                  <span>{getStatusText(car.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusText(status) {
  if (status === "waiting") return "ждет";
  if (status === "parking") return "заезжает";
  if (status === "parked") return "припаркована";
  if (status === "left") return "уехала";
  return "";
}

function ParkingSpot({ place, registerSpot }) {
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

function MovingVehicle({ vehicle }) {
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

function ParkedVehicle({ place }) {
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

function Styles() {
  return (
    <style>{`
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Inter, Arial, sans-serif;
        background: #dbeafe;
      }

      .app {
        min-height: 100vh;
        padding: 28px;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 35%),
          linear-gradient(180deg, #bfdbfe 0%, #dbeafe 28%, #eff6ff 100%);
      }

      .time-widget {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 20;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.28);
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        border-radius: 18px;
        padding: 14px 18px;
        min-width: 190px;
        backdrop-filter: blur(8px);
      }

      .time-label {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .time-value {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
      }

      .time-hint {
        margin-top: 6px;
        font-size: 12px;
        color: #64748b;
      }

      .panel {
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 30px;
        padding: 28px;
        box-shadow: 0 25px 60px rgba(15, 23, 42, 0.12);
        backdrop-filter: blur(10px);
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .topbar h1 {
        margin: 0 0 8px;
        font-size: 38px;
        color: #0f172a;
      }

      .topbar p {
        margin: 0;
        color: #475569;
        font-size: 16px;
      }

      .legend {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        color: #334155;
        font-size: 14px;
        white-space: nowrap;
      }

      .legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        display: inline-block;
      }

      .car-dot {
        background: #2563eb;
      }

      .truck-dot {
        background: #ef4444;
      }

      .controls {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      .main-btn,
      .ghost-btn,
      .file-btn {
        border: 0;
        border-radius: 14px;
        padding: 13px 18px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }

      .main-btn {
        background: linear-gradient(135deg, #1d4ed8, #3b82f6);
        color: white;
      }

      .truck-btn {
        background: linear-gradient(135deg, #dc2626, #f97316);
      }

      .file-btn {
        background: linear-gradient(135deg, #059669, #10b981);
        color: white;
      }

      .file-btn input {
        display: none;
      }

      .ghost-btn {
        background: white;
        color: #0f172a;
        border: 1px solid #dbe2ea;
      }

      .file-info,
      .message-box,
      .settings-box {
        margin-bottom: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 14px;
        color: #475569;
      }

      .message-box {
        color: #0f172a;
        font-weight: 700;
      }

      .settings-box h2 {
        margin: 0 0 14px;
        color: #0f172a;
        font-size: 20px;
      }

      .settings-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        align-items: end;
      }

      .settings-grid label {
        display: grid;
        gap: 6px;
        font-size: 14px;
        font-weight: 700;
      }

      .settings-grid input {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 11px 12px;
        font-size: 15px;
      }

      .save-settings-btn {
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #0f172a, #334155);
        color: white;
        font-weight: 800;
        cursor: pointer;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 22px;
      }

      .stats div {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 14px;
      }

      .stats b {
        display: block;
        font-size: 24px;
        color: #0f172a;
      }

      .stats span {
        color: #64748b;
        font-size: 14px;
      }

      .parking {
        position: relative;
        background: #2f3947;
        border-radius: 28px;
        padding: 28px;
        overflow: hidden;
      }

      .gate {
        position: relative;
        z-index: 3;
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 24px;
      }

      .gate-road {
        width: 150px;
        height: 22px;
        border-radius: 999px;
        background:
          repeating-linear-gradient(
            90deg,
            #f8fafc 0 16px,
            transparent 16px 28px
          ),
          #111827;
      }

      .gate-sign {
        color: white;
        background: #16a34a;
        border-radius: 999px;
        padding: 9px 16px;
        font-weight: 800;
      }

      .zone {
        position: relative;
        z-index: 1;
      }

      .zone-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        gap: 16px;
      }

      .zone-header h2 {
        margin: 0;
        color: white;
        font-size: 22px;
      }

      .zone-header span {
        color: #cbd5e1;
        font-weight: 700;
      }

      .lane-divider {
        height: 16px;
        margin: 24px 0;
        border-radius: 999px;
        background:
          repeating-linear-gradient(
            90deg,
            #f8fafc 0 16px,
            transparent 16px 30px
          ),
          #111827;
      }

      .grid {
        display: grid;
        gap: 16px;
      }

      .cars-grid {
        grid-template-columns: repeat(6, minmax(110px, 1fr));
      }

      .trucks-grid {
        grid-template-columns: repeat(4, minmax(150px, 1fr));
      }

      .spot {
        position: relative;
        height: 118px;
        border-radius: 20px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.1);
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.06);
      }

      .spot::before,
      .spot::after {
        content: "";
        position: absolute;
        top: 12px;
        bottom: 12px;
        width: 4px;
        border-radius: 999px;
      }

      .car-spot::before,
      .car-spot::after {
        background: rgba(255,255,255,0.85);
      }

      .truck-spot::before,
      .truck-spot::after {
        background: rgba(248,113,113,0.95);
      }

      .spot::before {
        left: 10px;
      }

      .spot::after {
        right: 10px;
      }

      .spot-number {
        position: absolute;
        top: 8px;
        left: 12px;
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,255,255,0.9);
      }

      .spot-label {
        color: rgba(255,255,255,0.34);
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.18em;
      }

      .hours-badge {
        position: absolute;
        right: 10px;
        bottom: 10px;
        background: white;
        color: #0f172a;
        font-size: 12px;
        font-weight: 800;
        border-radius: 999px;
        padding: 6px 10px;
      }

      .vehicle {
        position: relative;
        animation: parkedIdle 2.2s ease-in-out infinite;
      }

      .car {
        width: 72px;
        height: 44px;
      }

      .truck {
        width: 98px;
        height: 48px;
      }

      .moving-car {
        position: absolute;
        left: 0;
        top: 0;
        z-index: 10;
        width: 72px;
        height: 44px;
        pointer-events: none;
        animation: driveToSpot ${DRIVE_MS}ms cubic-bezier(.2,.8,.2,1) forwards;
      }

      .moving-truck {
        width: 98px;
        height: 48px;
      }

      .car-top {
        position: absolute;
        left: 16px;
        top: 2px;
        width: 40px;
        height: 18px;
        background: var(--vehicle-color);
        border-radius: 14px 14px 8px 8px;
      }

      .car-body {
        position: absolute;
        left: 6px;
        top: 14px;
        width: 60px;
        height: 22px;
        background: var(--vehicle-color);
        border-radius: 16px 16px 12px 12px;
      }

      .truck-box {
        position: absolute;
        left: 6px;
        top: 10px;
        width: 56px;
        height: 26px;
        background: var(--vehicle-color);
        border-radius: 10px;
      }

      .truck-cabin {
        position: absolute;
        left: 62px;
        top: 14px;
        width: 24px;
        height: 22px;
        background: var(--vehicle-color);
        border-radius: 8px 10px 8px 8px;
      }

      .wheel {
        position: absolute;
        bottom: 2px;
        width: 14px;
        height: 14px;
        background: #0f172a;
        border-radius: 50%;
        border: 3px solid #cbd5e1;
      }

      .car-wheel-left {
        left: 14px;
      }

      .car-wheel-right {
        right: 14px;
      }

      .truck-wheel-left {
        left: 18px;
      }

      .truck-wheel-right {
        right: 12px;
      }

      .queue-box {
        margin-top: 22px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 22px;
        padding: 18px;
      }

      .queue-box h2 {
        margin: 0 0 14px;
        color: #0f172a;
      }

      .queue-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
        gap: 10px;
      }

      .queue-item {
        display: grid;
        gap: 4px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 12px;
        font-size: 14px;
      }

      .queue-item span {
        color: #64748b;
      }

      .queue-item.parked {
        border-color: #10b981;
      }

      .queue-item.left {
        opacity: 0.55;
        border-color: #ef4444;
      }

      @keyframes driveToSpot {
        0% {
          transform:
            translate(calc(var(--start-x) - 50%), calc(var(--start-y) - 50%))
            scale(0.9);
          opacity: 0;
        }

        15% {
          opacity: 1;
        }

        55% {
          transform:
            translate(
              calc((var(--start-x) + var(--end-x)) / 2 - 50%),
              calc(var(--start-y) + 26px)
            )
            scale(1);
        }

        100% {
          transform:
            translate(calc(var(--end-x) - 50%), calc(var(--end-y) - 50%))
            scale(1);
          opacity: 1;
        }
      }

      @keyframes parkedIdle {
        0%, 100% {
          transform: translateY(0);
        }

        50% {
          transform: translateY(-2px);
        }
      }

      @media (max-width: 980px) {
        .cars-grid {
          grid-template-columns: repeat(4, minmax(100px, 1fr));
        }

        .trucks-grid {
          grid-template-columns: repeat(2, minmax(150px, 1fr));
        }

        .settings-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .topbar {
          flex-direction: column;
        }
      }

      @media (max-width: 680px) {
        .app {
          padding: 16px;
        }

        .panel {
          padding: 18px;
        }

        .cars-grid,
        .trucks-grid {
          grid-template-columns: repeat(2, minmax(110px, 1fr));
        }

        .stats,
        .settings-grid {
          grid-template-columns: 1fr;
        }

        .time-widget {
          position: static;
          margin-bottom: 16px;
          width: fit-content;
        }

        .topbar h1 {
          font-size: 30px;
        }
      }
    `}</style>
  );
}
