export function ControlsPanel({ onAddVehicle, onUploadFile, onResetParking }) {
  return (
    <>
      <div className="controls">
        <button className="main-btn" onClick={() => onAddVehicle("car")}>
          + Добавить легковую
        </button>

        <button
          className="main-btn truck-btn"
          onClick={() => onAddVehicle("truck")}
        >
          + Добавить грузовик
        </button>

        <label className="file-btn">
          Загрузить файл
          <input type="file" accept=".csv,.txt" onChange={onUploadFile} />
        </label>

        <button className="ghost-btn" onClick={onResetParking}>
          Очистить
        </button>
      </div>

      <div className="file-info">
        <b>CSV формат:</b> type,arrival,hours
        <br />
        Например: car,1,3 или truck,2,5
      </div>
    </>
  );
}
