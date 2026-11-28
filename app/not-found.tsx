import Link from "next/link";
import type { Metadata } from "next";
import styles from "./auth-form.module.css";

export const metadata: Metadata = { title: "Page not found | Flawment" };

/** An address the app does not have: say so, in the app's own look, with the way back. */
export default function NotFound() {
  return <main className={styles.page}>
    <div className={styles.backdrop} aria-hidden="true">flawment<span>.</span></div>
    <section className={styles.card}>
      <Link className={styles.brand} href="/">flawment<span>.</span></Link>
      <h1>Page not found</h1>
      <p className={styles.lead}>There is nothing at this address. It may have been mistyped, or the link is out of date.</p>
      <Link className="primary-button" href="/">Go to the dashboard</Link>
    </section>
  </main>;
}
