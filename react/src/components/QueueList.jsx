import { getStatusText } from "../utils";

export function QueueList({ queue }) {
  return (
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
  );
}
