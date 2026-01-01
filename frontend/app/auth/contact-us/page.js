"use client";

import styles from "./style.module.css";

export default function ContactUs() {
  return (
    <div className={styles.container}>
      
      {/* LEFT CONTENT */}
      <div className={styles.leftPanel}>
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
            <strong>Instant Digital Visitor Pass</strong> – Visitors receive 
            secure online Visitor Pass on email / SMS eliminating manual slips.
          </li>

          <li>
            <strong>Powerful Real-Time Dashboard</strong> – Track check-ins, 
            check-outs, pending visitors, approvals and analytics in a 
            beautiful admin dashboard.
          </li>

          <li>
            <strong>Conference Room Booking + Email Alerts</strong> – 
            Employees can instantly book conference rooms and meeting halls.
            Organizer and attendees receive booking confirmation emails 
            along with schedule and room details.
          </li>

          <li>
            <strong>Company Specific Public URL</strong> – Each company gets 
            a dedicated public portal where employees can directly login using 
            OTP without separate employee onboarding. No HR dependency. No 
            registrations. Completely hassle-free.
          </li>

          <li>
            <strong>Zero Manual Work</strong> – No spreadsheets, no registers,
            no paper passes. Everything is automated.
          </li>

          <li>
            <strong>Secure & Compliant</strong> – Access controlled, encrypted
            and designed to support corporate compliance requirements.
          </li>
        </ul>

        <p>
          With Promeet, organizations save time, improve security, enhance 
          visitor experience and empower employees with instant access to 
          conference room management. Designed for Businesses, IT Parks, 
          Corporates, Co-working Spaces, Manufacturing Units and Enterprises.
        </p>

        <h3>Let’s make your organization smarter with Promeet.</h3>
      </div>

      {/* RIGHT CONTACT PANEL */}
      <div className={styles.rightPanel}>
        <h2>Contact Us</h2>
        <p>We are happy to support you. Reach out to us anytime.</p>

        <div className={styles.contactBox}>
          <p><strong>Email:</strong></p>
          <p>admin@wheelbrand.in</p>
        </div>

        <div className={styles.contactBox}>
          <p><strong>Phone:</strong></p>
          <p>+91 86478 78785</p>
        </div>

        <div className={styles.note}>
          Our team will get in touch with you regarding onboarding, 
          pricing, enterprise plans or product demonstrations.
        </div>
      </div>
    </div>
  );
}
