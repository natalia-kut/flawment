import styles from "./progress-bar.module.css";

// The bar warms from orange to green as the work gets done.
function progressLevel(percent: number) {
  return percent >= 100 ? "done" : percent >= 70 ? "high" : percent >= 40 ? "mid" : "low";
}

/** A rounded completion bar with a short caption, e.g. "2/9 done" or "22%". */
export default function ProgressBar({ label, percent, caption }: {
  label: string;
  percent: number;
  caption: string;
}) {
  return (
    <div className={styles.progress}>
      <div className={styles.track} data-level={progressLevel(percent)} role="progressbar"
        aria-label={label + " completion"} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: percent + "%" }} />
      </div>
      <span className={styles.caption}>{caption}</span>
    </div>
  );
}
