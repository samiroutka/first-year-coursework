export function SettingsPanel({ settingsForm, setSettingsForm, onSave }) {
  return (
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

        <button className="save-settings-btn" onClick={onSave}>
          Сохранить настройки
        </button>
      </div>
    </div>
  );
}
