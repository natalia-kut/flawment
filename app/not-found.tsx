import Link from "next/link";
import type { Metadata } from "next";
import EmptyState from "@/components/ui/empty-state";
import styles from "./auth-form.module.css";

export const metadata: Metadata = { title: "Page not found | Flawment" };

/** An address the app does not have: the same picture as inside the app, with the way back. */
export default function NotFound() {
  return <main className={styles.page}>
    <div className={styles.backdrop} aria-hidden="true">flawment<span>.</span></div>
    <div className={styles.notFound}>
      <Link className={styles.brand} href="/">flawment<span>.</span></Link>
      <EmptyState art="lost" title="Page not found" action={<Link className="primary-button" href="/">Go to the dashboard</Link>}>
        There is nothing at this address. It may be mistyped, or the link is out of date.
      </EmptyState>
    </div>
  </main>;
}
