"use client";

import { useRouter } from "next/navigation";
import { Lock, ArrowLeft } from "lucide-react";
import styles from "./LockedModule.module.css";

/**
 * Shown in place of a module's dashboard once the company's subscription
 * has expired/lapsed. Sends the user back to /home, where the renewal
 * popup (plan-specific messaging) opens automatically.
 */
export default function LockedModule({ moduleName, subtitle }) {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconCircle}>
          <Lock size={30} />
        </div>
        <h2 className={styles.title}>{moduleName} is locked</h2>
        <p className={styles.subtitle}>
          {subtitle || "Your subscription has expired. Renew your plan to regain full access."}
        </p>
        <button className={styles.renewBtn} onClick={() => router.replace("/home")}>
          Renew Now
        </button>
        <button className={styles.backLink} onClick={() => router.replace("/home")}>
          <ArrowLeft size={14} /> Back to Home
        </button>
      </div>
    </div>
  );
}
