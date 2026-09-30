"use client";
/* ============================================================================
   PAGE NOT AVAILABLE — any address the site does not have
   Same look as the card "not available" screen. Sends the visitor on to the
   landing page after a short countdown, or straight away from the button.
   ========================================================================== */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandFooter from "./card/[slug]/BrandFooter";
import styles from "./not-found.module.css";

const WAIT = 5;

export default function NotFound() {
  const router = useRouter();
  const [left, setLeft] = useState(WAIT);

  useEffect(() => {
    if (left <= 0) { router.replace("/"); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, router]);

  return (
    <div className={styles.centre}>
      <div className={styles.notice}>
        <h1>Page not available</h1>
        <p>This page could not be found. The link may be incorrect.</p>
        <Link href="/" replace className={styles.homeBtn}>Go to Hai Visitor</Link>
        <p className={styles.redirect} aria-live="polite">
          Taking you to the home page in {Math.max(left, 0)}s…
        </p>
        <BrandFooter className={styles.footer} label="Powered by" />
      </div>
    </div>
  );
}
