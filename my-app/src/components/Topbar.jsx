export function Topbar() {
  return (
    <div className="topbar">
      <div>
        <h1>Умная парковка</h1>
        <p>React показывает интерфейс, а FastAPI управляет парковкой.</p>
      </div>

      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot car-dot" />
          car - легковая
        </div>
        <div className="legend-item">
          <span className="legend-dot truck-dot" />
          truck - грузовая
        </div>
      </div>
    </div>
  );
}
