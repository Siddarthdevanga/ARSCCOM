"use client";

import styles from "./style.module.css";

export default function ContactUs() {
  return (
    <div className={styles.container}>
      <main className={styles.bodyWrapper}>
        
        {/* LEFT INFORMATION PANEL */}
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
              virtual passes via Email / Whatsapp eliminating manual paper slips.
            </li>

            <li>
              <strong>Powerful Live Dashboard</strong> – Track check-ins, check-outs,
              approvals and analytics in real time.
            </li>

            <li>
              <strong>Conference Room Booking + Email Alerts</strong> – Employees can
              instantly book conference rooms. Organizers & attendees receive
              confirmation notifications.
            </li>

            <li>
              <strong>Company Specific Public URL</strong> – Each company receives a
              dedicated access link where employees log in via OTP. No HR dependency,
              no onboarding workload.
            </li>

            <li>
              <strong>Zero Manual Work</strong> – No registers, no spreadsheets,
              no paper passes. Everything automated.
            </li>

            <li>
              <strong>Secure & Enterprise Ready</strong> – Role based authentication,
              encryption and compliance aligned security.
            </li>
          </ul>

          <p>
            Promeet helps organizations save time, enhance security, improve visitor
            experience and empower employees with effortless meeting room management.
            Designed for Corporates, IT Parks, Co-working Spaces, Manufacturing Units
            and Enterprises.
          </p>

          <h3>Let’s make your organization smarter with Promeet.</h3>
        </div>

        {/* RIGHT CONTACT PANEL */}
        <div className={styles.rightCard}>
          <h2>Contact Us</h2>
          <p>We’re always happy to support you.</p>

          <div className={styles.contactBox}>
            <span>Email</span>
            <strong>admin@promeet.zodopt.com</strong>
          </div>

          <div className={styles.contactBox}>
            <span>Phone</span>
            <strong>+91 86478 78785</strong>
          </div>

          <div className={styles.note}>
            Get in touch for onboarding, pricing, enterprise deployment or 
            product demonstrations — our team will support you end-to-end.
          </div>
        </div>
      </main>
    </div>
  );
}
