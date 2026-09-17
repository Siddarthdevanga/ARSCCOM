"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import "../guide/guide.css";
import styles from "./style.module.css";

const SITE_URL = "https://haivisitor.zodopt.com";

export default function BrochurePage() {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  useEffect(() => {
    QRCode.toDataURL(SITE_URL, { width: 240, margin: 1, color: { dark: "#241247", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, []);

  return (
    <div className={`${styles.root} guide-root`}>
      {/* ===== ON-SCREEN CONTROLS (hidden in print) ===== */}
      <div className={styles.controlBar}>
        <div>
          <div className={styles.label}>Hai Visitor — Sales Brochure &amp; Setup Guide</div>
          <div className={styles.sub}>5 pages · Use "Download PDF" to save it, or Ctrl/Cmd+P to print</div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link href="/guide" className={styles.backLink}>← Back to User Guide</Link>
          <button className={styles.downloadBtn} onClick={() => window.print()}>⬇ Download PDF</button>
        </div>
      </div>

      {/* ===== PAGE 1 — COVER ===== */}
      <div className={styles.page}>
        <div className={styles.cover}>
          <div className={styles.coverEyebrow}>Sales Brochure &amp; Setup Guide</div>
          <div className={styles.coverLogoWrap}>
            <img src="/haivisitor.png" alt="Hai Visitor" />
          </div>
          <div className={styles.coverWordmark}>H<em>ai</em> VISITOR</div>
          <h1 className={styles.coverHeadline}>Visitor &amp; Conference Management, Simplified.</h1>
          <p className={styles.coverSub}>
            Turn every walk-in, meeting and guest into an organised, secure digital record —
            live in under 15 minutes, with no dedicated hardware required.
          </p>
          <div className={styles.coverStats}>
            <div className={styles.coverStat}><b>15 min</b><span>To go live</span></div>
            <div className={styles.coverStat}><b>₹49</b><span>15-day trial</span></div>
            <div className={styles.coverStat}><b>Zero</b><span>Hardware needed</span></div>
          </div>
          <div className={styles.coverFooter}>haivisitor.zodopt.com</div>
        </div>
      </div>

      {/* ===== PAGE 2 — WHY HAI VISITOR + FEATURES ===== */}
      <div className={styles.page}>
        <div className={styles.pageBody}>
          <div className={styles.pageKicker}><span className={styles.dot} /><span>Why Hai Visitor</span></div>
          <h2 className={styles.pageTitle}>Your front desk deserves better than a paper register</h2>
          <p className={styles.pageIntro}>
            Walk-in visitors, client meetings and guest data are some of the most valuable — and most
            frequently lost — records a business generates. Hai Visitor replaces the sign-in book and the
            scattered spreadsheets with one connected system your whole team already knows how to use: WhatsApp.
          </p>

          <div className="frame" style={{ marginBottom: "24px" }}>
            <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">haivisitor.zodopt.com/home</span></div>
            <div className="frame-body mk-page">
              <div className="mk-dash-header" style={{ borderRadius: "10px 10px 0 0" }}>
                <div className="mk-hamburger"><span></span><span></span><span></span></div>
                <div className="co">Zodopt Technology Solutions</div>
                <div className="mk-logout">Logout</div>
              </div>
              <div className="mk-card" style={{ borderRadius: "0 0 10px 10px", borderTop: "none" }}>
                <div style={{ fontSize: "11px", fontWeight: 800, color: "#1a0038" }}>Good afternoon 👋</div>
                <div className="mk-modgrid">
                  <div className="mk-modcard"><div className="ic"></div><b>Visitor Management</b><span>Check-ins, passes &amp; history</span></div>
                  <div className="mk-modcard"><div className="ic" style={{ background: "var(--grad-amber)" }}></div><b>Conference Booking</b><span>Rooms &amp; meeting schedules</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.problemBand}>
            <div className={`${styles.problemCol} ${styles.before}`}>
              <div className={styles.tag}>Without Hai Visitor</div>
              <p>Illegible sign-in registers, no record of who a visitor met, hosts caught off guard, and zero visibility into footfall trends.</p>
            </div>
            <div className={`${styles.problemCol} ${styles.after}`}>
              <div className={styles.tag}>With Hai Visitor</div>
              <p>Every visit is digital, timestamped and searchable — hosts get an instant WhatsApp alert, and every visitor leaves with a digital pass.</p>
            </div>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>V</div>
              <b>Visitor Management</b>
              <p>QR self-registration, instant WhatsApp host approval, and a live digital pass for every visitor.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>C</div>
              <b>Conference Booking</b>
              <p>Rooms with live slot availability — bookable by staff or the public, your choice.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>E</div>
              <b>Employee Directory</b>
              <p>A searchable staff list so visitors can pick exactly who they're here to meet.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>R</div>
              <b>Reports &amp; Analytics</b>
              <p>Real-time KPIs, footfall trends, and one-click Excel exports for any period.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>F</div>
              <b>Form Builder</b>
              <p>Fully custom registration fields and your own "Purpose of Visit" categories.</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>S</div>
              <b>Smart Forms</b>
              <p>Standalone QR data collectors for event feedback, lead capture, or sign-up sheets.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== PAGE 3 — FEATURE DEEP DIVE ===== */}
      <div className={styles.page}>
        <div className={styles.pageBody}>
          <div className={styles.pageKicker}><span className={styles.dot} /><span>Feature Deep Dive</span></div>
          <h2 className={styles.pageTitle}>What your team and your visitors actually experience</h2>
          <p className={styles.pageIntro}>
            Hai Visitor is built around two people at once — the staff member managing the front desk,
            and the visitor on their own phone. Neither one needs to install anything.
          </p>

          <div className={styles.dualCol}>
            <div className={styles.dualCard}>
              <h4>👩‍💼 For your team</h4>
              <ul>
                <li>A live visitor list, updating automatically, with colour-coded status</li>
                <li>Accept or decline a visitor request straight from WhatsApp</li>
                <li>Auto checkout at day's end — nothing is ever left dangling "IN"</li>
                <li>Full visit history, including photo and ID proof if required</li>
              </ul>
            </div>
            <div className={styles.dualCard}>
              <h4>🙋 For the visitor</h4>
              <ul>
                <li>Scan a QR code and fill in details in under a minute — no app, no login</li>
                <li>Returning visitors are recognised automatically — nothing to re-type</li>
                <li>A digital pass shows their live status as the visit progresses</li>
                <li>A quick WhatsApp feedback rating is requested after the meeting</li>
              </ul>
            </div>
          </div>

          <div className={styles.mockupRow}>
            <div className="frame">
              <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">haivisitor.zodopt.com/visitor/dashboard</span></div>
              <div className="frame-body mk-page">
                <div className="mk-card" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div className="mk-qrbox"></div>
                  <div>
                    <div style={{ fontSize: "9.5px", fontWeight: 800, color: "#1a0038" }}>Your registration QR</div>
                    <div style={{ fontSize: "8px", color: "#8578A8", fontWeight: 700, marginTop: "2px" }}>haivisitor.zodopt.com/visitor/zodopt-tech</div>
                  </div>
                </div>
                <div className="mk-card">
                  <table className="mk-table mk">
                    <tbody>
                      <tr><th>Visitor</th><th>Purpose</th><th>Status</th></tr>
                      <tr><td><span className="mk-av" style={{ background: "#221C53" }}>RH</span>Ramesh H.</td><td>Sofa Enquiry</td><td><span className="mk-badge accepted">Accepted</span></td></tr>
                      <tr><td><span className="mk-av" style={{ background: "#0E7490" }}>VM</span>Vikram M.</td><td>Tiles</td><td><span className="mk-badge checkedin">Checked In</span></td></tr>
                      <tr><td><span className="mk-av" style={{ background: "#9F1239" }}>MI</span>Mohan I.</td><td>Recliner</td><td><span className="mk-badge pending">Pending</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className={styles.mockupStack}>
              <div className="frame">
                <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">WhatsApp</span></div>
                <div className="frame-body mk-page" style={{ padding: "14px" }}>
                  <div className="mk-whatsapp mk">
                    <b>New Visitor Request</b><br />Ramesh H. is here for "Sofa Enquiry" — meet now?
                    <div className="actions"><span className="accept">✓ Accept</span><span className="decline">✕ Decline</span></div>
                  </div>
                </div>
              </div>
              <div className="frame">
                <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">/v/pass</span></div>
                <div className="frame-body mk-page" style={{ padding: "14px" }}>
                  <div className="mk-pass mk">
                    <div className="photo"></div>
                    <b>Ramesh H.</b><span>Sofa Enquiry · Host: Suresh</span>
                    <div className="qr"></div>
                    <span className="mk-badge accepted" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>Accepted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.diffBand}>
            <div className={styles.diffItem}><b>No hardware</b><span>Works on any phone</span></div>
            <div className={styles.diffItem}><b>WhatsApp-native</b><span>No new app to learn</span></div>
            <div className={styles.diffItem}><b>Live in 15 min</b><span>From sign-up to go-live</span></div>
            <div className={styles.diffItem}><b>Every plan</b><span>Smart Forms included free</span></div>
          </div>
        </div>
      </div>

      {/* ===== PAGE 4 — SETUP GUIDE ===== */}
      <div className={styles.page}>
        <div className={styles.pageBody}>
          <div className={styles.pageKicker}><span className={styles.dot} /><span>Getting Started</span></div>
          <h2 className={styles.pageTitle}>From sign-up to your first check-in</h2>
          <p className={styles.pageIntro}>
            Most teams are fully live — QR code printed and at reception — within 15 minutes of paying.
            Here's exactly what that looks like.
          </p>

          <div className={styles.setupLayout}>
            <div className={styles.stepList}>
              <div className={styles.step}>
                <div className={styles.stepNum}>1</div>
                <div className={styles.stepBody}>
                  <b>Sign up and start your trial</b>
                  <p>Pay ₹49 for a 15-day trial from the landing page (email + phone only), or register directly with your full company details if you're ready to commit.</p>
                  <span className={styles.stepRoute}>haivisitor.zodopt.com → /register</span>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <div className={styles.stepBody}>
                  <b>Complete your company profile</b>
                  <p>Set your real company name, upload your logo, and add your WhatsApp number — this is what visitors and hosts see on every pass and notification.</p>
                  <span className={styles.stepRoute}>/complete-registration → /home</span>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>3</div>
                <div className={styles.stepBody}>
                  <b>Configure Form Builder</b>
                  <p>Turn on only the fields you need, and build your own "Purpose of Visit" categories (e.g. Sales Enquiry → Sofa / Tiles / Modular Kitchen).</p>
                  <span className={styles.stepRoute}>/home/form-builder</span>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>4</div>
                <div className={styles.stepBody}>
                  <b>Add your team</b>
                  <p>Add employees one at a time or bulk-upload an Excel sheet, so visitors can search for exactly who they're meeting.</p>
                  <span className={styles.stepRoute}>/visitor/admin</span>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>5</div>
                <div className={styles.stepBody}>
                  <b>Share your QR code</b>
                  <p>Print your unique registration QR code or display it on a tablet at reception — anyone who scans it can register in seconds.</p>
                  <span className={styles.stepRoute}>/visitor/dashboard</span>
                </div>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum}>6</div>
                <div className={styles.stepBody}>
                  <b>Optional — set up Conference Rooms &amp; Smart Forms</b>
                  <p>Add bookable meeting rooms (Enterprise), and launch a Smart Form to collect feedback or leads with its own QR code.</p>
                  <span className={styles.stepRoute}>/conference/dashboard · /smart-forms/dashboard</span>
                </div>
              </div>
            </div>

            <div className={styles.setupMockStack}>
              <div className="frame">
                <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">/home/form-builder</span></div>
                <div className="frame-body mk-page">
                  <div className="mk-toggle mk"><div className="l">Email Address<small>Step 1</small></div><div className="mk-switch on"></div></div>
                  <div className="mk-toggle mk"><div className="l">Person to Meet<small>Step 2</small></div><div className="mk-switch on"></div></div>
                  <div className="mk-toggle mk"><div className="l">ID Proof<small>Step 3</small></div><div className="mk-switch"></div></div>
                </div>
              </div>
              <div className="frame">
                <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">/visitor/admin</span></div>
                <div className="frame-body mk-page">
                  <div className="mk-card">
                    <table className="mk-table mk">
                      <tbody>
                        <tr><th>Name</th><th>Status</th></tr>
                        <tr><td><span className="mk-av" style={{ background: "#4A00A0" }}>SR</span>Suresh R.</td><td><span className="mk-badge accepted">Active</span></td></tr>
                        <tr><td><span className="mk-av" style={{ background: "#D97706" }}>DK</span>Divya K.</td><td><span className="mk-badge accepted">Active</span></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.setupFooter}>
            That's it — no IT team, no installation, no dedicated hardware. Just sign up, configure, and print your QR code.
          </div>
        </div>
      </div>

      {/* ===== PAGE 5 — PRICING + CONTACT ===== */}
      <div className={styles.page}>
        <div className={styles.pageBody}>
          <div className={styles.pageKicker}><span className={styles.dot} /><span>Plans &amp; Contact</span></div>
          <h2 className={styles.pageTitle}>Plans that scale with you</h2>
          <p className={styles.pageIntro}>Every plan includes Smart Forms and the full visitor registration flow — upgrade any time as your team grows.</p>

          <div className="frame" style={{ marginBottom: "22px" }}>
            <div className="frame-bar"><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-dot"></span><span className="frame-url">haivisitor.zodopt.com/home/plans</span></div>
            <div className="frame-body mk-page">
              <div className={styles.pricingGrid}>
                <div className={styles.priceCard}>
                  <h4>TRIAL</h4>
                  <div className={styles.amt}>₹49<span>/15 days</span></div>
                  <ul>
                    <li>100 Visitor Bookings</li>
                    <li>2 Conference Rooms</li>
                    <li>Email Support</li>
                  </ul>
                </div>
                <div className={`${styles.priceCard} ${styles.pop}`}>
                  <div className={styles.priceBadge}>MOST POPULAR</div>
                  <h4>BUSINESS</h4>
                  <div className={styles.amt}>₹500<span>/mo · ₹5,500/yr</span></div>
                  <ul>
                    <li>Unlimited Visitors</li>
                    <li>Custom Registration Fields</li>
                    <li>Priority Support</li>
                  </ul>
                </div>
                <div className={styles.priceCard}>
                  <h4>ENTERPRISE</h4>
                  <div className={styles.amt}>₹1,000<span>/mo · ₹10,000/yr</span></div>
                  <ul>
                    <li>Unlimited Visitors &amp; Bookings</li>
                    <li>Unlimited Conference Rooms</li>
                    <li>Dedicated Support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.ctaBand}>
            Start your 15-day trial today for ₹49
            <span>No commitment — cancel any time before it renews</span>
          </div>

          <div className={styles.contactRow}>
            <div className={styles.contactList}>
              <div className={styles.contactItem}><span className={styles.k}>Email</span> admin@haivisitor.zodopt.com</div>
              <div className={styles.contactItem}><span className={styles.k}>Phone</span> +91 8647878785</div>
              <div className={styles.contactItem}><span className={styles.k}>Support</span> Mon–Fri, 9AM–6PM IST</div>
              <div className={styles.contactItem}><span className={styles.k}>Website</span> haivisitor.zodopt.com</div>
            </div>
            <div className={styles.qrBox}>
              {qrDataUrl && <img src={qrDataUrl} alt="Scan to visit haivisitor.zodopt.com" />}
              <p>Scan to visit haivisitor.zodopt.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
