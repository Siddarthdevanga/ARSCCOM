import styles from "./style.module.css";

export default function ConferenceDashboard({ stats }) {
  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCard}>
        <span>Rooms</span>
        <b>{stats.rooms}</b>
      </div>

      <div className={styles.statCard}>
        <span>Today</span>
        <b>{stats.todayBookings}</b>
      </div>

      <div className={styles.statCard}>
        <span>Total</span>
        <b>{stats.totalBookings}</b>
      </div>

      <div className={styles.statCard}>
        <span>Cancelled</span>
        <b>{stats.cancelled}</b>
      </div>
    </div>
  );
}
