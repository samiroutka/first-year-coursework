import { formatTime } from "../utils";

export function TimeWidget({ time, settings }) {
  return (
    <div className="time-widget">
      <div className="time-label">Время</div>
      <div className="time-value">{formatTime(time)}</div>
      <div className="time-hint">
        {settings.hourMs / 1000} сек. = 1 час
      </div>
    </div>
  );
}
