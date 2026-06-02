export function StatsPanel({ stats }) {
  if (!stats) {
    return null;
  }

  return (
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
  );
}
