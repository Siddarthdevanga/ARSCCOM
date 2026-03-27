"use client";

import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function ContactUs() {
  const router = useRouter();

  return (
    <div className={styles.container}>

      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoText}>PROMEET</div>
        </div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/auth/login")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>
      </header>

      {/* ===== SCROLL BODY ===== */}
      <div className={styles.scrollBody}>

        {/* ===== HERO ===== */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Get in <span>Touch</span></h1>
          <p className={styles.heroSub}>Plan Details, Onboarding, Demos — we're here to help</p>
        </section>

        {/* ===== MAIN CONTENT ===== */}
        <main className={styles.mainContent}>
          <div className={styles.layoutGrid}>

            {/* ── LEFT: Information Panel ── */}
            <div className={styles.infoCard}>
              <div className={styles.sectionHeader}>
                <span className={styles.cardDot} />
                <h3 className={styles.cardTitle}>About Promeet</h3>
              </div>

              <h2 className={styles.infoHeading}>Smart Visitor &amp; Conference Management</h2>
              <p className={styles.infoPara}>
                <strong>Promeet</strong> is a secure, intelligent and enterprise-grade
                Visitor &amp; Conference Management Platform designed to digitalize
                organisation entry management, streamline conference bookings and
                ensure a professional visitor experience.
              </p>

              <div className={styles.whyHeader}>
                <span className={`${styles.cardDot} ${styles.dotGreen}`} />
                <h3 className={styles.cardTitle}>Why Organisations Love Promeet</h3>
              </div>

              <div className={styles.featureList}>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>
                    {/* Badge / pass icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="3"/>
                      <circle cx="8" cy="12" r="2"/>
                      <path d="M13 10h5M13 14h3"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Instant Digital Visitor Pass</strong>
                    <p>Visitors receive secure virtual passes via Email / WhatsApp, eliminating manual paper slips.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>
                    {/* Chart / dashboard icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3"/>
                      <path d="M8 17V13M12 17V9M16 17V13"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Powerful Live Dashboard</strong>
                    <p>Track check-ins, check-outs, approvals and analytics in real time.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>
                    {/* Building / conference icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <path d="M9 22V12h6v10M3 9h18"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Conference Room Booking + Email Alerts</strong>
                    <p>Employees can instantly book conference rooms. Organisers &amp; attendees receive confirmation notifications.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>
                    {/* Link / URL icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.5 5.5"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12.5 18.5"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Company Specific Public URL</strong>
                    <p>Each company receives a dedicated access link where employees log in via OTP. No HR dependency, no onboarding workload.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>
                    {/* Lightning / automation icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Zero Manual Work</strong>
                    <p>No registers, no spreadsheets, no paper passes. Everything automated.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>
                    {/* Shield / security icon */}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Secure &amp; Enterprise Ready</strong>
                    <p>Role based authentication, encryption and compliance aligned security.</p>
                  </div>
                </div>

              </div>

              <p className={styles.infoPara}>
                Promeet helps organisations save time, enhance security, improve visitor
                experience and empower employees with effortless meeting room management.
                Designed for Corporates, IT Parks, Co-working Spaces, Manufacturing Units
                and Enterprises.
              </p>

              <div className={styles.ctaLine}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <h3 className={styles.cardTitle}>Let's make your organisation smarter with Promeet.</h3>
              </div>
            </div>

            {/* ── RIGHT: Contact Panel ── */}
            <div className={styles.contactCard}>
              <div className={styles.sectionHeader}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <h3 className={styles.cardTitle}>Contact Us</h3>
              </div>
              <p className={styles.contactSub}>We're always happy to support you.</p>

              <div className={styles.contactBox}>
                <div className={styles.contactIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <span className={styles.contactLabel}>Email</span>
                  <strong className={styles.contactValue}>admin@promeet.zodopt.com</strong>
                </div>
              </div>

              <div className={styles.contactBox}>
                <div className={styles.contactIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.59 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 5.33 5.33l1.63-1.64a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div>
                  <span className={styles.contactLabel}>Phone</span>
                  <strong className={styles.contactValue}>+91 86478 78785</strong>
                </div>
              </div>

              <div className={styles.noteBox}>
                <p>Get in touch for onboarding, pricing, enterprise deployment or
                product demonstrations — our team will support you end-to-end.</p>
              </div>

              {/* ===== HOST NOTIFICATION PANEL ===== */}
              <div className={styles.notifSection}>
                <div className={styles.notifHeader}>
                  <span className={`${styles.cardDot} ${styles.dotGreen}`} />
                  <h3 className={styles.cardTitle}>Visitor Arrival Notifications</h3>
                </div>
                <p className={styles.notifDesc}>
                  When a visitor arrives at reception and checks in, the host receives an
                  instant notification via Email and WhatsApp with the visitor's details.
                  The host can approve or reject the visit directly from the notification.
                </p>

                {/* Sample notification preview card */}
                <div className={styles.notifPreview}>
                  <div className={styles.notifPreviewHeader}>
                    <div className={styles.notifPreviewDot} />
                    <span className={styles.notifPreviewLabel}>Sample — Visitor Arrival Alert</span>
                  </div>

                  <div className={styles.notifVisitorRow}>
                    <div className={styles.notifAvatar}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <div>
                      <strong className={styles.notifName}>Rajan Mehta</strong>
                      <span className={styles.notifMeta}>is here to meet <strong>Amit Sharma</strong></span>
                      <span className={styles.notifTime}>Today, 10:32 AM &nbsp;·&nbsp; Reception Desk</span>
                    </div>
                  </div>

                  <div className={styles.notifActions}>
                    <button className={styles.btnApprove}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Approve
                    </button>
                    <button className={styles.btnReject}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>

                <p className={styles.notifFootnote}>
                  Notifications are sent instantly via Email and WhatsApp. Hosts can
                  respond in one tap — no app login required.
                </p>
              </div>

            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
