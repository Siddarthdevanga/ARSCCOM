'use client';
import { useEffect } from 'react';
import { TRIAL_MODAL_HTML, initTrialSignup, loadMetaPixel } from '../components/trialSignup';
import '../components/industry-landing.css';
import './furniture.css';

/* Furniture & home décor landing page. The markup is the design
   (haivisitor-site-f/haivisitor-site/index.html) with the site's logo, the
   shared trial popup, the offer ticker, the sticky trial bar and the WhatsApp
   button added, and the footer links dropped. Every "Start trial" button
   carries `trial-cta`, which opens the same popup as the main landing page;
   signups from here are tagged 'furniture'.

   The popup, sticky bar and WhatsApp button sit outside the `fu` wrapper so
   the design's element styles (h3, p, ...) don't reach them. */

const WHATSAPP_URL =
  'https://wa.me/916366834745?text=' +
  encodeURIComponent('Hi, Can i know more about Hai Visitor - Visitor Management Platform');

const TICKER_ITEMS = [
  '₹49 ONLY — 15-DAY TRIAL', 'NO HARDWARE NEEDED', 'GO LIVE IN 15 MINUTES',
  'INSTANT WHATSAPP ALERTS', 'BUILD YOUR CUSTOMER DATABASE',
];
// Listed twice so the track can loop seamlessly at -50%.
const TICKER_HTML = [...TICKER_ITEMS, ...TICKER_ITEMS]
  .map((t) => `<span>${t}</span><span>★</span>`)
  .join('');

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const STEP_ARROW = '<svg class="step-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

const BODY_HTML = `
<div class="fu">
<!-- OFFER TICKER (fixed top) -->
<div class="offer-ticker"><div class="ot-track">${TICKER_HTML}</div></div>

<div id="top" class="site-shell">

  <nav class="topbar">
    <div class="page-wrap nav-inner">
      <a href="#top" class="brand" aria-label="Hai Visitor home">
        <span class="brand-lockup"><img src="/v-mark.png" alt="" width="44" height="44" /><span class="brand-name">H<em>ai</em> Visitor</span></span>
      </a>
      <button type="button" class="button button-primary nav-cta trial-cta">Start 15-Day Trial</button>
    </div>
  </nav>

  <main>
    <header class="hero">
      <img src="/furniture/furniture-showroom-family.jpg" alt="A family exploring furniture with a showroom consultant" width="1600" height="1000" class="hero-image" />
      <div class="hero-shade"></div>
      <div class="page-wrap hero-inner">
        <div class="hero-copy-wrap">
          <span class="audience">For furniture &amp; home décor showrooms</span>
          <h1><span class="h1-line h1-lead">Furniture decisions take time.</span> <span class="h1-line h1-lead">Stay Connected,</span> <em class="h1-line">Don’t lose the customer in between.</em></h1>
          <p>Capture every showroom visit, engage the right consultant and keep each visitor record ready for the next conversation.</p>
          <div class="hero-actions">
            <button type="button" class="button button-primary trial-cta">Start 15-Day Trial @ ₹49</button>
          </div>
          <div class="hero-proof">
            <span>${CHECK} No dedicated hardware</span>
            <span>${CHECK} Live in about 15 minutes</span>
          </div>
        </div>
      </div>
    </header>

    <section class="section gap-section">
      <div class="page-wrap">
        <div class="section-head">
          <span class="eyebrow">The showroom gap</span>
          <h2>Big purchases need a connected experience.</h2>
          <p>Customers compare, measure and consult family. If the first visit stays on paper, the next chat starts from zero.</p>
        </div>
        <div class="card-grid">
          <article class="info-card ic-1"><span class="card-number">01</span><h3>They compare before deciding</h3><p>Sofas, dining sets and décor take time to choose. Many visitors return later.</p></article>
          <article class="info-card ic-2"><span class="card-number">02</span><h3>Many people join the decision</h3><p>Family, architects or designers often need to approve first.</p></article>
          <article class="info-card ic-3"><span class="card-number">03</span><h3>Manual records break continuity</h3><p>Paper registers and scattered notes make past visitors hard to find.</p></article>
        </div>
      </div>
    </section>

    <section class="section dark-section" id="how">
      <div class="page-wrap">
        <div class="section-head workflow-heading">
          <span class="eyebrow">A simple visitor workflow</span>
          <h2>From walk-in to follow-up in three steps.</h2>
        </div>
        <div class="steps">
          <article class="step-capture">
            <div class="step-top"><span>01 / Capture</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="M19 16v6"/><path d="M22 19h-6"/></svg>
            </div>
            <div class="step-copy"><h3>Register the visit.</h3><p>Visitors scan your QR and enter their details.</p>
              ${STEP_ARROW}
            </div>
          </article>
          <article class="step-connect">
            <div class="step-top"><span>02 / Connect</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
            </div>
            <div class="step-copy"><h3>Keep the record.</h3><p>Details stay saved and easy to find.</p>
              ${STEP_ARROW}
            </div>
          </article>
          <article class="step-engage">
            <div class="step-top"><span>03 / Engage</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            </div>
            <div class="step-copy"><h3>Brand WhatsApp opt-in.</h3><p>Visitors choose if your team can contact them on WhatsApp.</p>
              ${STEP_ARROW}
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section features-section">
      <div class="page-wrap feature-layout">
        <div class="section-head feature-intro">
          <span class="eyebrow">Built for the buying journey</span>
          <h2>Everything to manage visitors, in one place.</h2>
          <p>Simple tools your team can use every day.</p>
        </div>
        <div class="feature-grid">
          <article class="feature-card fc-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
            <h3>QR Registration</h3><p>Quick registration with no extra hardware.</p>
          </article>
          <article class="feature-card fc-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>
            <h3>WhatsApp Alert</h3><p>Alert the right staff member when a visitor registers.</p>
          </article>
          <article class="feature-card fc-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
            <h3>Visitor History</h3><p>Find past visits whenever your team needs them.</p>
          </article>
          <article class="feature-card fc-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            <h3>Dashboard &amp; Reports</h3><p>See visitors and showroom activity at a glance.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section compare-section">
      <div class="page-wrap">
        <div class="section-head">
          <span class="eyebrow">Before and after</span>
          <h2>Turn every walk-in into a clear next step.</h2>
        </div>
        <div class="compare-grid">
          <article class="compare-card before">
            <span class="compare-label">Before Hai Visitor</span>
            <p>${CROSS}Walk-ins noted in books or missed</p>
            <p>${CROSS}Each consultant keeps separate notes</p>
            <p>${CROSS}Past visitors are hard to find</p>
            <p>${CROSS}Long buying journeys lose track</p>
          </article>
          <article class="compare-card after">
            <span class="compare-label">With Hai Visitor</span>
            <p>${CHECK}One simple QR registration</p>
            <p>${CHECK}The right consultant is alerted instantly</p>
            <p>${CHECK}Visitor history stays organised</p>
            <p>${CHECK}Consented records for future follow-up</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section trial-section" id="trial">
      <div class="page-wrap trial-shell">
        <div class="trial-copy">
          <span class="eyebrow">Start small. Test it live.</span>
          <h2>Try Hai Visitor in your showroom for 15 days.</h2>
          <p>Set up your QR, register real walk-ins and see how it fits your showroom.</p>
          <div class="trial-points">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/></svg>100 visitor bookings</span>
          </div>
        </div>
        <aside class="price-panel">
          <span>15-day paid trial</span>
          <strong>₹49</strong>
          <ul>
            <li>${CHECK}QR registration</li>
            <li>${CHECK}WhatsApp staff notifications</li>
            <li>${CHECK}Dashboard and visitor records</li>
          </ul>
          <button type="button" class="button button-primary trial-cta">Start your trial</button>
        </aside>
      </div>
    </section>

    <section class="section faq-section">
      <div class="page-wrap faq-layout">
        <div class="section-head">
          <span class="eyebrow">Questions before you start</span>
          <h2>Clear answers for showroom owners.</h2>
        </div>
        <div class="faq-list">
          <details><summary>Do we need to purchase any hardware?</summary><p>No. Just display your QR code and visitors scan it with their phone.</p></details>
          <details><summary>How quickly can our showroom go live?</summary><p>About 15 minutes for a single showroom.</p></details>
          <details><summary>Does Hai Visitor run WhatsApp marketing?</summary><p>No. It only records and organises visitor details. Your team handles any follow-up separately.</p></details>
          <details><summary>What happens after the trial?</summary><p>You get a 10-day buffer, then move to the ₹500 per month Business plan. Final terms show at checkout.</p></details>
        </div>
      </div>
    </section>

    <section class="final-cta">
      <div class="page-wrap final-inner">
        <span class="eyebrow">Keep every opportunity visible</span>
        <h2>The purchase may take time. The visitor record shouldn’t disappear.</h2>
        <button type="button" class="button button-primary trial-cta">Start 15-Day Trial @ ₹49</button>
      </div>
    </section>
  </main>

  <footer>
    <div class="page-wrap footer-inner">
      <a href="#top" class="brand" aria-label="Hai Visitor home">
        <span class="brand-lockup"><img src="/v-mark.png" alt="" width="44" height="44" /><span class="brand-name">H<em>ai</em> Visitor</span></span>
      </a>
      <span class="footer-copy">© 2026 Hai Visitor · Zodopt Technology Solutions Pvt Ltd</span>
    </div>
  </footer>
</div>
</div>

<!-- Sticky CTA (all screen sizes), same as the main landing page -->
<div class="sticky-cta">
  <a class="btn btn-primary trial-cta" href="#trial">Start 15-Day Trial for ₹49 →</a>
</div>

<!-- WhatsApp float -->
<a class="wa-float" href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"><img src="/whatsapp-icon.png" alt="WhatsApp" /></a>

<!-- TRIAL SIGNUP POPUP -->
${TRIAL_MODAL_HTML}
`;

/* The header is transparent over the hero and turns dark once the page is
   scrolled (the design's js/main.js). Returns a cleanup function. */
const initTopbar = () => {
  const bar = document.querySelector('.fu .topbar');
  if (!bar) return () => {};
  const update = () => bar.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
  return () => window.removeEventListener('scroll', update);
};

export default function FurnitureLanding() {
  useEffect(() => {
    loadMetaPixel();
    const cleanupTopbar = initTopbar();
    const cleanupTrial = initTrialSignup({ landing: 'furniture' });
    return () => {
      cleanupTopbar();
      cleanupTrial();
    };
  }, []);

  return <div className="lp" dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
