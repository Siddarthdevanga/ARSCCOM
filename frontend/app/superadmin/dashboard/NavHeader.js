"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, LayoutDashboard, MessageCircle, Megaphone, Link2 } from "lucide-react";
import styles from "./style.module.css";

/* Shared header + hamburger drawer nav used by the dashboard, WhatsApp
   Leads and WhatsApp Broadcast pages so navigation is consistent across
   all superadmin screens. `onDashboardNav`/`onRazorpayNav` are passed
   only by the dashboard page itself (to switch tabs in place instead of
   a full navigation); every other page falls back to plain links. */
export default function SuperAdminNav({
  admin,
  isFullAdmin,
  activeView,
  onDashboardNav,
  onRazorpayNav,
  onLogout,
  headerRightExtra,
}) {
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const closeDrawer = () => setShowNavDrawer(false);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {isFullAdmin && (
            <button className={styles.hamburgerBtn} onClick={() => setShowNavDrawer(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
          )}
          <div className={styles.logoContainer}>
            <Image
              src="/v-mark.png"
              alt="Hai Visitor Logo"
              width={280}
              height={90}
              priority
              className={styles.brandLogo}
            />
          </div>
          <span className={styles.superBadge}>SUPERADMIN</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.adminEmail}>{admin?.email}</span>
          {/* Hidden below 900px — see .headerActionsDesktop. The same
              controls are rendered in the drawer instead. */}
          <span className={styles.headerActionsDesktop}>{headerRightExtra}</span>
          <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      </header>

      {isFullAdmin && showNavDrawer && (
        <div className={styles.drawerOverlay} onClick={closeDrawer}>
          <nav className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <span className={styles.superBadge}>SUPERADMIN</span>
              <button className={styles.modalClose} onClick={closeDrawer} aria-label="Close menu">
                <X size={16} />
              </button>
            </div>

            {onDashboardNav ? (
              <button
                className={`${styles.drawerLink} ${activeView === "companies" ? styles.drawerLinkActive : ""}`}
                onClick={() => { onDashboardNav(); closeDrawer(); }}
              >
                <LayoutDashboard size={17} /> Dashboard
              </button>
            ) : (
              <Link href="/superadmin/dashboard" className={styles.drawerLink} onClick={closeDrawer}>
                <LayoutDashboard size={17} /> Dashboard
              </Link>
            )}

            <Link
              href="/superadmin/whatsapp-leads"
              className={`${styles.drawerLink} ${activeView === "whatsapp-leads" ? styles.drawerLinkActive : ""}`}
              onClick={closeDrawer}
            >
              <MessageCircle size={17} /> WhatsApp Leads
            </Link>

            <Link
              href="/superadmin/broadcast"
              className={`${styles.drawerLink} ${activeView === "broadcast" ? styles.drawerLinkActive : ""}`}
              onClick={closeDrawer}
            >
              <Megaphone size={17} /> WhatsApp Broadcast
            </Link>

            {onRazorpayNav ? (
              <button
                className={`${styles.drawerLink} ${activeView === "razorpay" ? styles.drawerLinkActive : ""}`}
                onClick={() => { onRazorpayNav(); closeDrawer(); }}
              >
                <Link2 size={17} /> Landing Page Conversion
              </button>
            ) : (
              <Link href="/superadmin/dashboard?tab=razorpay" className={styles.drawerLink} onClick={closeDrawer}>
                <Link2 size={17} /> Landing Page Conversion
              </Link>
            )}
            {/* Mobile home for the header actions. Rendered inside a
                wrapper that is display:none above 900px so they are never
                shown twice. */}
            {headerRightExtra && (
              <div className={styles.drawerActions} onClick={closeDrawer}>
                <span className={styles.drawerActionsLabel}>Actions</span>
                {headerRightExtra}
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
