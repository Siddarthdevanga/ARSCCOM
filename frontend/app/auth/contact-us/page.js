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
          <button className={styles.backBtn} onClick={() => router.push("/auth/login")}>← Back</button>
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

              <h2 className={styles.infoHeading}>Smart Visitor & Conference Management</h2>
              <p className={styles.infoPara}>
                <strong>Promeet</strong> is a secure, intelligent and enterprise-grade
                Visitor & Conference Management Platform designed to digitalize
                organization entry management, streamline conference bookings and
                ensure a professional visitor experience.
              </p>

              <div className={styles.whyHeader}>
                <span className={`${styles.cardDot} ${styles.dotGreen}`} />
                <h3 className={styles.cardTitle}>Why Organizations Love Promeet</h3>
              </div>

              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>🎫</span>
                  <div>
                    <strong>Instant Digital Visitor Pass</strong>
                    <p>Visitors receive secure virtual passes via Email / Whatsapp eliminating manual paper slips.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>📊</span>
                  <div>
                    <strong>Powerful Live Dashboard</strong>
                    <p>Track check-ins, check-outs, approvals and analytics in real time.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>🏢</span>
                  <div>
                    <strong>Conference Room Booking + Email Alerts</strong>
                    <p>Employees can instantly book conference rooms. Organizers & attendees receive confirmation notifications.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>🔗</span>
                  <div>
                    <strong>Company Specific Public URL</strong>
                    <p>Each company receives a dedicated access link where employees log in via OTP. No HR dependency, no onboarding workload.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>⚡</span>
                  <div>
                    <strong>Zero Manual Work</strong>
                    <p>No registers, no spreadsheets, no paper passes. Everything automated.</p>
                  </div>
                </div>

                <div className={styles.featureItem}>
                  <span className={styles.featureIcon}>🔒</span>
                  <div>
                    <strong>Secure & Enterprise Ready</strong>
                    <p>Role based authentication, encryption and compliance aligned security.</p>
                  </div>
                </div>
              </div>

              <p className={styles.infoPara}>
                Promeet helps organizations save time, enhance security, improve visitor
                experience and empower employees with effortless meeting room management.
                Designed for Corporates, IT Parks, Co-working Spaces, Manufacturing Units
                and Enterprises.
              </p>

              <div className={styles.ctaLine}>
                <span className={`${styles.cardDot} ${styles.dotGold}`} />
                <h3 className={styles.cardTitle}>Let's make your organization smarter with Promeet.</h3>
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
                <div className={styles.contactIcon}>✉</div>
                <div>
                  <span className={styles.contactLabel}>Email</span>
                  <strong className={styles.contactValue}>admin@promeet.zodopt.com</strong>
                </div>
              </div>

              <div className={styles.contactBox}>
                <div className={styles.contactIcon}>📞</div>
                <div>
                  <span className={styles.contactLabel}>Phone</span>
                  <strong className={styles.contactValue}>+91 86478 78785</strong>
                </div>
              </div>

              <div className={styles.noteBox}>
                <p>Get in touch for onboarding, pricing, enterprise deployment or
                product demonstrations — our team will support you end-to-end.</p>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
