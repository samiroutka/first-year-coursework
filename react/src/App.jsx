import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { ControlsPanel } from "./components/ControlsPanel";
import { ParkingLayout } from "./components/ParkingLayout";
import { QueueList } from "./components/QueueList";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsPanel } from "./components/StatsPanel";
import { TimeWidget } from "./components/TimeWidget";
import { Topbar } from "./components/Topbar";
import { API_URL } from "./constants";
import { getVehicleColor } from "./utils";

const initialSettings = {
  carPlacesCount: 18,
  truckPlacesCount: 4,
  hourMs: 2000,
};

const initialSettingsForm = {
  carPlacesCount: 18,
  truckPlacesCount: 4,
  secondsPerHour: 2,
};

export default function App() {
  const [places, setPlaces] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState("Подключение к серверу...");
  const [movingVehicle, setMovingVehicle] = useState(null);
  const [settings, setSettings] = useState(initialSettings);
  const [settingsForm, setSettingsForm] = useState(initialSettingsForm);

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

  const updateState = useCallback((data) => {
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
  }, []);

  const getParkingAnimationData = useCallback((newBusyPlace) => {
    const parking = parkingRef.current;
    const gate = gateRef.current;
    const spot = spotRefs.current[newBusyPlace.id];

    if (!parking || !gate || !spot) {
      return null;
    }

    const parkingRect = parking.getBoundingClientRect();
    const gateRect = gate.getBoundingClientRect();
    const spotRect = spot.getBoundingClientRect();
    const carId = newBusyPlace.vehicle.carId;
    const type = newBusyPlace.vehicle.type;

    return {
      id: newBusyPlace.id,
      type,
      color: getVehicleColor(type, carId),
      startX: gateRect.left - parkingRect.left + gateRect.width / 2,
      startY: gateRect.top - parkingRect.top + gateRect.height / 2,
      endX: spotRect.left - parkingRect.left + spotRect.width / 2,
      endY: spotRect.top - parkingRect.top + spotRect.height / 2,
    };
  }, []);

  const applyStateWithAnimation = useCallback((newState) => {
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

    const animationData = getParkingAnimationData(newBusyPlace);

    if (!animationData) {
      setPlaces(newPlaces);
      return;
    }

    setMovingVehicle(animationData);
    setMessage(getParkingMessage(animationData.type, newBusyPlace.id));

    setTimeout(() => {
      setPlaces(newPlaces);
      setMovingVehicle(null);
      setMessage(`Машина припарковалась на место №${newBusyPlace.id}`);
    }, 1200);
  }, [getParkingAnimationData, movingVehicle]);

  const loadState = useCallback(async (firstLoad = false) => {
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
  }, [applyStateWithAnimation, updateState]);

  const tick = useCallback(async () => {
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
  }, [applyStateWithAnimation]);

  useEffect(() => {
    // Initial server sync is the intended side effect for this component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadState(true);

    const timer = setInterval(() => {
      tick();
    }, settings.hourMs);

    return () => clearInterval(timer);
  }, [loadState, settings.hourMs, tick]);

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
      <TimeWidget time={time} settings={settings} />

      <div className="panel">
        <Topbar />
        <ControlsPanel
          onAddVehicle={addVehicle}
          onUploadFile={uploadFile}
          onResetParking={resetParking}
        />
        <SettingsPanel
          settingsForm={settingsForm}
          setSettingsForm={setSettingsForm}
          onSave={saveSettings}
        />
        <div className="message-box">{message}</div>
        <StatsPanel stats={stats} />
        <ParkingLayout
          carPlaces={carPlaces}
          truckPlaces={truckPlaces}
          stats={stats}
          movingVehicle={movingVehicle}
          parkingRef={parkingRef}
          gateRef={gateRef}
          registerSpot={registerSpot}
        />
        <QueueList queue={queue} />
      </div>
    </div>
  );
}

function getParkingMessage(type, placeId) {
  return type === "car"
    ? `Легковая машина заезжает на место №${placeId}`
    : `Грузовик заезжает на место №${placeId}`;
}
