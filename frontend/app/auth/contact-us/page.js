"use client";

import styles from "./style.module.css";

export default function ContactUs() {
  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.logoText}>VISITOR MANAGEMENT PLATFORM</div>

          <img
            src="/Promeet Logo.png"
            alt="Promeet Logo"
            className={styles.brandLogo}
          />
        </div>
      </header>

      {/* MAIN BODY */}
      <main className={styles.bodyWrapper}>
        
        {/* LEFT CARD */}
        <div className={styles.leftCard}>
          <h1>Promeet – Smart Visitor & Conference Management</h1>

          <p>
            <strong>Promeet</strong> is a secure, intelligent and enterprise-grade
            Visitor & Conference Management Platform designed to digitalize
            organization entry management, streamline conference bookings and
            ensure a professional visitor experience.
          </p>

          <h3>Why Organizations Love Promeet?</h3>

          <ul>
            <li>
              <strong>Instant Digital Visitor Pass</strong> – Visitors receive secure
              online Visitor Pass via Email / SMS eliminating manual slips.
            </li>

            <li>
              <strong>Powerful Real-Time Dashboard</strong> – Track check-ins,
              check-outs, pending visitors, approvals and analytics in a
              beautiful live dashboard.
            </li>

            <li>
              <strong>Conference Room Booking + Email Alerts</strong> – Employees can
              instantly book conference & meeting rooms. Organizer and attendees
              receive booking confirmation emails with complete details.
            </li>

            <li>
              <strong>Company Specific Public URL</strong> – Each company gets a
              dedicated public portal. Employees login instantly using OTP.
              No HR dependency. No employee registration. Fully hassle-free.
            </li>

            <li>
              <strong>Zero Manual Work</strong> – No registers, no spreadsheets,
              no paper passes. Everything automated.
            </li>

            <li>
              <strong>Secure & Compliant</strong> – Role-based access, encryption
              and corporate level security standards.
            </li>
          </ul>

          <p>
            With Promeet, organizations save time, improve security, enhance
            visitor experience and empower employees with instant access to
            conference room management. Designed for Corporates, IT Parks,
            Co-working Spaces, Manufacturing Units and Enterprises.
          </p>

          <h3>Let’s make your organization smarter with Promeet.</h3>
        </div>

        {/* RIGHT CARD */}
        <div className={styles.rightCard}>
          <h2>Contact Us</h2>
          <p>We’re always happy to assist you.</p>

          <div className={styles.contactBox}>
            <span>Email</span>
            <strong>admin@wheelbrand.in</strong>
          </div>

          <div className={styles.contactBox}>
            <span>Phone</span>
            <strong>+91 86478 78785</strong>
          </div>

          <div className={styles.note}>
            Reach out for onboarding, subscription plans, enterprise rollout or
            a product demo. Our team will support you end-to-end.
          </div>
        </div>
      </main>
    </div>
  );
}
