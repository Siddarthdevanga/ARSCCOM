'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import './landing.css';

/* ── Google Analytics helper ─────────────────────────────── */
const gaEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

/* ══════════════════════════════════════════════════════════
   SINGLE SOURCE OF TRUTH — edit here, changes everywhere
   ══════════════════════════════════════════════════════════ */
const CONFIG = {
  company: {
    name:       'Promeet',
    brand:      'Zodopt',
    tagline:    'Visitor Management Platform',
    logo:       '/Brand Logo.png',
    email:      'admin@promeet.zodopt.com',
    whatsapp:   'https://wa.me/916366834745?text=Hi%2C+Can+i+know+more+about+Promeet+-+Visitor+Management+Platform',
    loginUrl:   'https://www.promeet.zodopt.com/auth/login',
    registerUrl:'https://www.promeet.zodopt.com/auth/register',
    phone:      '+91 63668 34745',
  },
  trial: {
    price:            '₹49',
    duration:         '15 days',
    visitorLimit:     100,
    conferenceLimit:  100,
    roomLimit:        2,
  },
  pricing: {
    business: {
      price:            '₹500',
      period:           'month',
      conferenceLimit:  1000,
      roomLimit:        6,
    },
  },
  stats: {
    organizations:    '500+',
    visitorsManaged:  '50K+',
    rating:           '4.9/5',
    todayVisitors:    248,
    activeMeetings:   12,
  },
};

/* ── Static data arrays (all reference CONFIG) ───────────── */
const NAV_ITEMS = [
  { label: 'Features',     href: '#features' },
  { label: 'Pricing',      href: '#Plans' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Industries',   href: '#industries' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'FAQ',          href: '#faq' },
];

const WHY_CARDS = [
  {
    className: 'card1',
    title: 'Instant Digital Visitor Pass',
    desc:  'Visitors receive secure virtual passes via Email/WhatsApp eliminating manual paper slips.',
  },
  {
    className: 'card2',
    title: 'Powerful Live Dashboard',
    desc:  'Track check-ins, check-outs, approvals and analytics in real time.',
  },
  {
    className: 'card3',
    title: 'Conference Room Booking + Email Alerts',
    desc:  'Employees can instantly book conference rooms. Organizers receive confirmation notifications.',
  },
  {
    className: 'card4',
    title: 'Company Specific Public URL',
    desc:  `Each company receives a dedicated access link where employees log in via OTP. No HR dependency, no onboarding workload.`,
  },
  {
    className: 'card5',
    title: 'Zero Manual Work',
    desc:  'No registers, no spreadsheets, no paper passes. Everything automated.',
  },
  {
    className: 'card6',
    title: 'Secure & Enterprise Ready',
    desc:  'Role based authentication, encryption and compliance aligned security.',
  },
];

const STEPS = [
  {
    color: 'orange',
    title: 'Visitor Registration',
    desc:  'Visitors register their arrival by scanning a QR code or using a web link, making check-in seamless.',
  },
  {
    color: 'purple',
    title: 'Visitor Notification',
    desc:  'Visitor receives instant notification via email or WhatsApp.',
  },
  {
    color: 'blue',
    title: 'Digital Pass Issued',
    desc:  'Visitor receives a secure digital pass valid for a specified duration and location.',
  },
  {
    color: 'pink',
    title: 'Track & Analyze',
    desc:  'Monitor activity on a live dashboard. Generate reports and maintain compliance.',
  },
];

const FEATURES = [
  'Visitor Walk-in management',
  'Digital visitor passes',
  'Visitor notifications via email/WhatsApp',
  'Conference room scheduling',
  'Meeting configuration, reschedule and cancel',
  'Meeting confirmations',
  'Comprehensive visitor analytics & reports',
  'Integration with access control systems',
  'Multi-location support',
  'Role-based access control',
  'Mobile-responsive interface',
  'QR code based bookings',
];

const INDUSTRIES = [
  { color: 'blue',   title: 'Corporates',               desc: 'Enterprise offices with high visitor traffic and multiple meeting rooms.' },
  { color: 'violet', title: 'IT Parks',                 desc: 'Technology campuses with multiple tenants and shared conference facilities.' },
  { color: 'green',  title: 'Co-working Spaces',        desc: 'Flexible workspaces managing visitors for multiple companies.' },
  { color: 'amber',  title: 'Manufacturing Units',      desc: 'Production facilities requiring strict security and visitor tracking.' },
  { color: 'red',    title: 'Enterprises',              desc: 'Large organizations with multi-location visitor management needs.' },
  { color: 'sky',    title: 'Educational Institutions', desc: 'Universities and colleges managing campus visitors and event bookings.' },
];

const TESTIMONIALS = [
  {
    featured: true,
    avatar: '👨‍💼',
    name: 'Rajesh Kumar',
    role: 'IT Manager',
    company: 'Tech Solutions Pvt Ltd',
    review: `${CONFIG.company.name} has completely transformed how we manage visitors. The digital passes and real-time dashboard have eliminated all manual work. Highly recommended!`,
  },
  {
    featured: false,
    avatar: '👩‍💼',
    name: 'Priya Sharma',
    role: 'HR Director',
    company: 'Global Enterprises',
    review: 'The conference room booking feature is a game-changer. No more double bookings or confusion. Our employees love how easy it is to use.',
  },
  {
    featured: false,
    avatar: '👨‍💼',
    name: 'Amit Patel',
    role: 'Facility Manager',
    company: 'Manufacturing Co.',
    review: 'Security has improved significantly. We always know who is on our premises. WhatsApp notifications are very convenient.',
  },
];

const SECURITY = [
  { color: '#4f6df5', title: 'ISO 27001', desc: 'Information Security' },
  { color: '#059669', title: 'SSL/TLS',   desc: 'Encrypted Data' },
  { color: '#7c3aed', title: 'GDPR',      desc: 'Compliant' },
  { color: '#ff6a00', title: '99.9%',     desc: 'Uptime SLA' },
];

const FAQS = [
  {
    q: 'How does the 15-day trial work?',
    a: `Pay just ${CONFIG.trial.price} to start your ${CONFIG.trial.duration} trial. You get full access to all Professional plan features. After the trial, choose to continue with a paid plan or cancel anytime — no further charges.`,
  },
  {
    q: 'How long does it take to set up?',
    a: 'Setup is incredibly quick! Most organizations are up and running within 15 minutes. We provide step-by-step guidance and our team is available to help with onboarding.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. We use enterprise-grade encryption, secure cloud storage, and comply with data protection regulations. Your visitor data is stored securely and only accessible to authorized personnel.',
  },
  {
    q: 'Does it work offline?',
    a: 'An internet connection is required for real-time notifications and cloud sync. Offline check-in mode is available at reception with automatic sync when reconnected.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'You can export all data before cancellation in Excel or PDF format. We retain your data for 30 days post-cancellation before permanent deletion.',
  },
  {
    q: 'Do you provide training for our team?',
    a: 'Yes! All plans include onboarding training — video tutorials, documentation, and live sessions. Enterprise customers get dedicated training programs.',
  },
  {
    q: 'Can we use it across multiple office locations?',
    a: 'Yes! Professional and Enterprise plans support multiple locations, each with its own settings, hosts, and reporting under centralized management.',
  },
  {
    q: 'What kind of support do you offer?',
    a: 'Email and WhatsApp support for all plans. Professional plans get priority support. Enterprise customers get phone support and a dedicated account manager.',
  },
];

const PRICING_PLANS = [
  {
    name:     'Trial',
    price:    CONFIG.trial.price,
    period:   CONFIG.trial.duration,
    duration: 'Perfect for testing the platform',
    features: [
      `Valid for ${CONFIG.trial.duration}`,
      `${CONFIG.trial.visitorLimit} Visitor Bookings`,
      `${CONFIG.trial.conferenceLimit} Conference Bookings`,
      `${CONFIG.trial.roomLimit} Conference Rooms`,
    ],
    cta:     'Get Started',
    ctaLink: CONFIG.company.registerUrl,
    popular: false,
    leadValue: 49,
  },
  {
    name:     'Business',
    price:    CONFIG.pricing.business.price,
    period:   CONFIG.pricing.business.period,
    duration: 'Ideal for growing organizations',
    features: [
      'Unlimited Visitors',
      `${CONFIG.pricing.business.conferenceLimit} Conference Bookings/month`,
      `Up to ${CONFIG.pricing.business.roomLimit} Conference Rooms`,
      'Advanced Analytics & Reports',
    ],
    cta:     'Get Started',
    ctaLink: CONFIG.company.registerUrl,
    popular: true,
    leadValue: 500,
  },
  {
    name:     'Enterprise',
    price:    'Custom',
    period:   '',
    duration: 'For large organizations',
    features: [
      'Unlimited Visitors',
      'Unlimited Conference Bookings',
      'Unlimited Conference Rooms',
      'Customised Support',
    ],
    cta:     'Contact Sales',
    ctaLink: CONFIG.company.whatsapp,
    popular: false,
  },
];

const FOOTER_FEATURES = [
  'Digital Visitor Passes',
  'Live Dashboard',
  'Conference Booking',
  'Email & WhatsApp Alerts',
  'Multi-location Support',
  'Analytics & Reports',
];

const TRUST_CARDS = [
  { icon: '🛡', title: 'Secure',   subtitle: 'Enterprise Grade' },
  { icon: '🕒', title: '24/7',     subtitle: 'Support' },
  { icon: '✔',  title: 'Reliable', subtitle: '99.9% Uptime' },
];

/* ── SVG icons (reusable) ────────────────────────────────── */
const IconLock = ({ size = 24, fill = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill}>
    <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
  </svg>
);

const IconUser = ({ size = 24, fill = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill}>
    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
  </svg>
);

const IconShield = ({ size = 24, fill = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill}>
    <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
  </svg>
);

const IconChart = ({ size = 24, fill = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill}>
    <path d="M3 3v18h18M7 16l4-4 4 4 4-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const IconBuilding = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="8" height="18" /><rect x="13" y="8" width="8" height="13" />
    <line x1="7" y1="8" x2="7" y2="8.01" /><line x1="7" y1="12" x2="7" y2="12.01" />
    <line x1="17" y1="12" x2="17" y2="12.01" /><line x1="17" y1="16" x2="17" y2="16.01" />
  </svg>
);

const IconWhatsApp = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M20.52 3.48A11.91 11.91 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.88 11.88 0 0 0 5.75 1.47c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.17-3.46-8.42z" />
  </svg>
);

const IconEmail = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="white">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [showWaTooltip, setShowWaTooltip] = useState(false);

  useEffect(() => {
    /* ── Hero animation ─────────────────────────────────── */
    const heroEls = document.querySelectorAll(
      '.heroBrandBlock, .heroPill, .hero h2, .hero p, .heroButtons'
    );
    heroEls.forEach((el, i) => {
      setTimeout(() => el.classList.add('animate'), i * 160);
    });

    /* ── Scroll-triggered fadeUp ────────────────────────── */
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('fadeUp'); }),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('[data-fade]').forEach((el) => observer.observe(el));

    /* ── FAQ accordion ──────────────────────────────────── */
    const handleFaq = (e) => {
      const btn  = e.currentTarget;
      const item = btn.closest('.faqItem');
      const icon = btn.querySelector('.icon');
      const isOpen = item.classList.contains('active');

      // Close all
      document.querySelectorAll('.faqItem').forEach((f) => {
        f.classList.remove('active');
        const ic = f.querySelector('.faqQuestion .icon');
        if (ic) ic.textContent = '+';
        f.querySelector('.faqQuestion').setAttribute('aria-expanded', 'false');
      });

      // Open clicked (if was closed)
      if (!isOpen) {
        item.classList.add('active');
        if (icon) icon.textContent = '−';
        btn.setAttribute('aria-expanded', 'true');
      }
    };

    const faqBtns = document.querySelectorAll('.faqQuestion');
    faqBtns.forEach((btn) => btn.addEventListener('click', handleFaq));

    /* ── WhatsApp tooltip auto-show ─────────────────────── */
    const tooltipTimer = setTimeout(() => {
      setShowWaTooltip(true);
      setTimeout(() => setShowWaTooltip(false), 5000);
    }, 3000);

    return () => {
      observer.disconnect();
      faqBtns.forEach((btn) => btn.removeEventListener('click', handleFaq));
      clearTimeout(tooltipTimer);
    };
  }, []);

  return (
    <>
      {/* ── Floating WhatsApp ───────────────────────────── */}
      <a
        href={CONFIG.company.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="floatingWhatsapp"
        aria-label="Chat with us on WhatsApp"
        onMouseEnter={() => setShowWaTooltip(true)}
        onMouseLeave={() => setShowWaTooltip(false)}
        onClick={() => gaEvent('whatsapp_click', { section: 'floating' })}
      >
        <span className="waPulse" aria-hidden="true" />
        <span className="waPulse waPulse2" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
          alt=""
          aria-hidden="true"
          className="waIcon"
          width={44}
          height={44}
        />
        <span className={`waTooltip${showWaTooltip ? ' waTooltipVisible' : ''}`}>
          💬 Chat with us!
        </span>
      </a>

      {/* ── Header ──────────────────────────────────────── */}
      <header className="header">
        <div className="logo">
          <Image
            src={CONFIG.company.logo}
            alt={`${CONFIG.company.brand} ${CONFIG.company.name} Logo`}
            width={28}
            height={28}
            className="logoImg"
            priority
          />
          <div>
            {CONFIG.company.brand}&apos;s {CONFIG.company.name}
            <span>{CONFIG.company.tagline}</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>

        <div className="headerAuth">
          <Link href={CONFIG.company.loginUrl} className="btnSignin">Sign In</Link>
          <Link href={CONFIG.company.registerUrl} className="btnSignup">Sign Up</Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="hero" aria-label="Hero">

        {/* Zodopt's + Promeet stacked heading */}
        <div className="heroBrandBlock">
          <p className="heroBrandLabel">{CONFIG.company.brand}&apos;s</p>
          <h1>{CONFIG.company.name}</h1>
        </div>

        {/* Pill */}
        <div className="heroPill" role="status" aria-live="polite">
          <span className="pillIcon" aria-hidden="true">⚡</span>
          <span className="pillText">GO LIVE IN JUST 15 MINUTES!</span>
        </div>

        <h2>{CONFIG.company.tagline}</h2>

        <p>
          A platform designed to digitalize organization entry management, streamline
          conference bookings and ensure a professional visitor experience.
        </p>

        <div className="heroButtons">
          <Link
            className="btnPrimary"
            href={CONFIG.company.registerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => gaEvent('cta_click', { section: 'hero', label: 'trial' })}
          >
            Start {CONFIG.trial.duration} Trial →
          </Link>
          <Link
            className="btnSecondary"
            href={CONFIG.company.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => gaEvent('cta_click', { section: 'hero', label: 'demo' })}
          >
            Chat with Us
          </Link>
        </div>
      </section>

      {/* ── Dashboard Glass ─────────────────────────────── */}
      <section className="dashboardGlass" aria-label="Live dashboard preview">
        <div className="dashboardCards">
          <div className="dashCard live">
            <div className="liveTop">
              <h3>⚡ Live Dashboard</h3>
              <span aria-label="Live indicator">● LIVE</span>
            </div>
            <div className="liveStats">
              <div className="stat">
                <h2>{CONFIG.stats.todayVisitors}</h2>
                <p>Visitors Today</p>
              </div>
              <div className="stat">
                <h2>{CONFIG.stats.activeMeetings}</h2>
                <p>Active Meetings</p>
              </div>
            </div>
          </div>

          <div className="dashCard meeting">
            <div className="meetingHead">
              <div className="icon" aria-hidden="true">📅</div>
              <div>
                <h3>Conference Room A</h3>
                <p>Board Meeting • 2:00 PM – 4:00 PM</p>
              </div>
            </div>
            <div className="bars" aria-hidden="true">
              <span className="fill" />
              <span />
              <span />
            </div>
            <div className="meetingStatus">
              <span>8 attendees confirmed</span>
              <strong>✔ Active</strong>
            </div>
          </div>

          <div className="dashCard pass">
            <small>DIGITAL VISITOR PASS</small>
            <h3>Anand</h3>
            <p>Meeting with HR Department</p>
            <p style={{ marginTop: '12px' }}>Valid until 5:00 PM</p>
          </div>
        </div>

        <div className="dashDivider" aria-hidden="true" />

        <div className="dashFeatures" aria-label="Key platform attributes">
          <div><span aria-hidden="true">🛡</span><h4>Simple</h4><p>Easy to Use</p></div>
          <div><span aria-hidden="true">☁</span><h4>Cloud</h4><p>Based Platform</p></div>
          <div><span aria-hidden="true">🔒</span><h4>Secure</h4><p>Data Protection</p></div>
        </div>
      </section>

      {/* ── Why Section ─────────────────────────────────── */}
      <section
        className="whySection"
        id="features"
        aria-label={`Why Organizations Love ${CONFIG.company.name}`}
      >
        <div className="headingContainer">
          <span className="badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" style={{ marginRight: '6px' }}>
              <path d="M7.5 1.018a.5.5 0 0 1 .45.28l3.5 7a.5.5 0 0 1-.9.44L8.19 4.665v6.67a.5.5 0 0 1-1 0V4.665L4.45 8.738a.5.5 0 1 1-.9-.44l3.5-7a.5.5 0 0 1 .45-.28z" />
            </svg>
            Powerful Features
          </span>
          <h2>
            Why Organizations Love <span>{CONFIG.company.name}</span>
          </h2>
          <p className="subheading">
            Everything you need to manage visitors and conference rooms seamlessly
          </p>
        </div>

        <div className="cardsContainer">
          {WHY_CARDS.map((card, i) => (
            <div key={i} className={`card ${card.className}`} tabIndex={0} role="article">
              <div className="iconContainer" aria-hidden="true">
                <IconLock size={24} />
              </div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────── */}
      <section className="howItWorks" id="how-it-works" aria-label="How it works">
        <div className="container">
          <span className="badge">✨ Simple Process</span>
          <h2 className="title">
            How <span>{CONFIG.company.name}</span> Works
          </h2>
          <p className="subtitle">
            A streamlined 4-step process to manage all your visitors and meetings
          </p>

          <div className="steps">
            {STEPS.map((step, i) => (
              <div key={i} className="stepCard">
                <div className={`icon ${step.color}`} aria-hidden="true">
                  <IconUser size={24} />
                </div>
                <span className="stepNo" aria-hidden="true">0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <p className="ctaText">Ready to experience the simplicity?</p>
          <Link
            href={CONFIG.company.loginUrl}
            className="ctaBtn"
            onClick={() => gaEvent('cta_click', { section: 'how_it_works' })}
          >
            Start Your Trial – Just {CONFIG.trial.price}
          </Link>
        </div>
      </section>

      {/* ── Everything Section ──────────────────────────── */}
      <section className="everythingSection" aria-label="Complete feature list">
        <div className="container">
          <span className="badge">✨ Complete Platform</span>
          <h2 className="title">
            Everything You Need, <span>All in One Place</span>
          </h2>
          <p className="subtitle">
            Comprehensive visitor and conference management features designed for modern organizations
          </p>

          <div className="featuresGrid">
            {FEATURES.map((feature, i) => (
              <div key={i} className="featureBox">{feature}</div>
            ))}
          </div>

          <div className="featuresCta">
            <Link
              href={CONFIG.company.loginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ctaBtn"
              onClick={() => gaEvent('cta_click', { section: 'features' })}
            >
              Get Started Today ↗
            </Link>
          </div>
        </div>
      </section>

      {/* ── Industries ──────────────────────────────────── */}
      <section className="industriesSection" id="industries" aria-label="Industries we serve">
        <div className="container">
          <span className="industryBadge">For Every Industry</span>
          <h2 className="industryTitle">
            Designed for <span>Modern Organizations</span>
          </h2>
          <p className="industrySubtitle">
            {CONFIG.company.name} adapts to your industry&apos;s unique needs with flexible configurations
          </p>

          <div className="industryGrid">
            {INDUSTRIES.map((ind, i) => (
              <div key={i} className="industryCard">
                <div className={`industryIcon ${ind.color}`} aria-hidden="true">
                  <IconBuilding size={24} />
                </div>
                <h3>{ind.title}</h3>
                <p>{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────── */}
      <section className="ctaSection" aria-label="Call to action">
        <div className="ctaBox">
          <div className="ctaIcon" aria-hidden="true">✨</div>
          <h2>Ready to Make Your Organization Smarter?</h2>
          <p>
            Join hundreds of organizations that have transformed their visitor and conference management
            with {CONFIG.company.name}
          </p>
          <div className="ctaActions">
            <Link
              href={CONFIG.company.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btnPrimary"
              onClick={() => gaEvent('cta_click', { section: 'cta_banner', label: 'demo' })}
            >
              Schedule a Demo →
            </Link>
          </div>
          <div className="ctaPoints">
            <span>● Free Trial Available</span>
            <span>● No Credit Card Required</span>
            <span>● Setup in Minutes</span>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section className="pricingSection" id="Plans" aria-label="Subscription plans">
        <div className="pricingHeader">
          <span className="pricingBadge">💎 Flexible Plans</span>
          <h2 className="pricingTitle">Subscription Plans</h2>
          <p className="pricingSubtitle">
            Choose the perfect plan for your organization. All plans include core features with scalable options.
          </p>
        </div>

        <div className="pricingCards">
          {PRICING_PLANS.map((plan, i) => (
            <div key={i} className={`pricingCard${plan.popular ? ' featured' : ''}`}>
              {plan.popular && <span className="popularBadge">🔥 Popular</span>}
              <h3 className="planName">{plan.name}</h3>
              <div className="planPrice">
                {plan.price}
                {plan.period && <span> / {plan.period}</span>}
              </div>
              <p className="planDuration">{plan.duration}</p>
              <ul className="planFeatures">
                {plan.features.map((f, j) => <li key={j}>{f}</li>)}
              </ul>
              <Link
                href={plan.ctaLink}
                className="planCta"
                onClick={() => {
                  gaEvent('pricing_click', { plan: plan.name });
                  if (plan.leadValue) gaEvent('generate_lead', { value: plan.leadValue, currency: 'INR', plan: plan.name.toLowerCase() });
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────── */}
      <section className="testimonialsSection" id="testimonials" aria-label="Customer testimonials">
        <div className="testimonialsContainer">
          <span className="sectionBadge">⭐ Customer Success Stories</span>
          <h2 className="sectionTitle">
            Trusted by <span>Organizations</span>
          </h2>
          <p className="sectionSubtitle">
            See what our customers have to say about their experience with {CONFIG.company.name}
          </p>

          <div className="testimonialCards">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`testimonialCard${t.featured ? ' featured' : ''}`}>
                <div className="stars" aria-label="5 star rating">★★★★★</div>
                <p className="review">{t.review}</p>
                <div className="user">
                  <div className="avatar" aria-hidden="true">{t.avatar}</div>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}<br />{t.company}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="testimonialStats" aria-label="Platform statistics">
            <div><h3>{CONFIG.stats.organizations}</h3><p>Organizations</p></div>
            <div><h3>{CONFIG.stats.visitorsManaged}</h3><p>Visitors Managed</p></div>
            <div><h3>{CONFIG.stats.rating}</h3><p>Customer Rating</p></div>
          </div>
        </div>
      </section>

      {/* ── Security ────────────────────────────────────── */}
      <section className="securitySection" aria-label="Security and compliance">
        <div className="securityContainer">
          <h2 className="securityTitle">Enterprise-Grade Security &amp; Compliance</h2>
          <p className="securitySubtitle">
            Your data is protected with industry-leading security standards
          </p>

          <div className="securityCards">
            {SECURITY.map((item, i) => (
              <div key={i} className="securityCard">
                <div className="securityIcon" style={{ background: item.color }} aria-hidden="true">
                  <IconShield size={22} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="securityBar">
            <div className="barItem"><h3>256-bit</h3><p>AES Encryption</p></div>
            <div className="divider" aria-hidden="true" />
            <div className="barItem"><h3>24/7</h3><p>Security Monitoring</p></div>
            <div className="divider" aria-hidden="true" />
            <div className="barItem"><h3>Daily</h3><p>Automated Backups</p></div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────── */}
      <section className="faqSection" id="faq" aria-label="Frequently asked questions">
        <div className="faqContainer">
          <span className="faqBadge">❓ Got Questions?</span>
          <h2 className="faqTitle">
            Frequently Asked <span>Questions</span>
          </h2>
          <p className="faqSubtitle">
            Everything you need to know about {CONFIG.company.name}
          </p>

          <div className="faqList" role="list">
            {FAQS.map((faq, i) => (
              <div key={i} className="faqItem" role="listitem">
                <button
                  className="faqQuestion"
                  aria-expanded="false"
                  aria-controls={`faq-answer-${i}`}
                >
                  <span>{faq.q}</span>
                  <span className="icon" aria-hidden="true">+</span>
                </button>
                <div className="faqAnswer" id={`faq-answer-${i}`} role="region">
                  {faq.a}
                </div>
              </div>
            ))}
          </div>

          <div className="faqCta">
            <h3>Still have questions?</h3>
            <p>Can&apos;t find the answer you&apos;re looking for? Our team is here to help.</p>
            <Link
              href={CONFIG.company.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="ctaBtn"
              onClick={() => gaEvent('cta_click', { section: 'faq' })}
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>

      {/* ── Get Started ─────────────────────────────────── */}
      <section className="getStarted" aria-label="Get started">
        <div className="gsContainer">
          <div className="gsLeft" data-fade>
            <span className="gsBadge">⚡ Start Your Free Trial</span>
            <h2>
              Get Started with <br />
              <span>{CONFIG.company.brand}&apos;s {CONFIG.company.name} Today</span>
            </h2>
            <p>
              Transform your visitor management and conference room booking experience.
              Contact us for a personalized demo.
            </p>
            <div className="gsContact">
              <div className="contactItem">
                <div className="icon whatsapp" aria-hidden="true">
                  <IconWhatsApp size={22} />
                </div>
                <span>
                  Chat on WhatsApp<br />
                  <strong>{CONFIG.company.phone}</strong>
                </span>
              </div>
              <div className="contactItem">
                <div className="icon email" aria-hidden="true">
                  <IconEmail size={22} />
                </div>
                <span>
                  Send us an email<br />
                  <strong>{CONFIG.company.email}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="gsRight" data-fade>
            <div className="gsCard whatsappCard">
              <h3>Chat on WhatsApp</h3>
              <p>Get instant answers to your questions from our team</p>
              <Link
                href={CONFIG.company.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                onClick={() => gaEvent('cta_click', { section: 'get_started', label: 'whatsapp' })}
              >
                Start Conversation →
              </Link>
            </div>
            <div className="gsCard demoCard">
              <h3>Request a Demo</h3>
              <p>See {CONFIG.company.name} in action with a personalized walkthrough</p>
              <Link
                href={`mailto:${CONFIG.company.email}`}
                className="btn secondary"
                onClick={() => gaEvent('cta_click', { section: 'get_started', label: 'email' })}
              >
                Schedule Demo →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="footer" aria-label="Site footer">
        <div className="footerTop">
          <div className="footerBrand" data-fade>
            <div className="logoWrap">
              <Image
                src={CONFIG.company.logo}
                alt={`${CONFIG.company.brand} ${CONFIG.company.name} Logo`}
                width={46}
                height={46}
              />
              <div>
                <h3>{CONFIG.company.brand}&apos;s {CONFIG.company.name}</h3>
                <span>{CONFIG.company.tagline}</span>
              </div>
            </div>
            <p>
              A platform designed to digitalize organization entry management, streamline
              conference bookings and ensure a professional visitor experience.
            </p>
            <div className="footerCta">
              <Link
                href={CONFIG.company.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btnPrimary"
              >
                WhatsApp →
              </Link>
              <Link href={`mailto:${CONFIG.company.email}`} className="btnSecondary">
                Email →
              </Link>
            </div>
          </div>

          <div className="footerLinks" data-fade>
            <h4>Key Features</h4>
            <ul>
              {FOOTER_FEATURES.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>

          <div className="footerLinks" data-fade>
            <h4>Industries</h4>
            <ul>
              {INDUSTRIES.map((ind, i) => <li key={i}>{ind.title}</li>)}
            </ul>
          </div>
        </div>

        <div className="footerTrust" data-fade>
          {TRUST_CARDS.map((card, i) => (
            <div key={i} className="trustCard">
              <span style={{ fontSize: '24px' }} aria-hidden="true">{card.icon}</span>
              <div>
                <strong>{card.title}</strong>
                <span>{card.subtitle}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="footerBottom" data-fade>
          <span>© {new Date().getFullYear()} {CONFIG.company.brand}&apos;s {CONFIG.company.name}. All rights reserved.</span>
          <Link
            href="https://zodopt.com/about-us/"
            target="_blank"
            rel="noopener noreferrer"
            className="footerLink"
          >
            © {CONFIG.company.brand}
          </Link>
          <div className="footerLinksInline">
            <Link href="https://zodopt.com/privacy-policy/" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            <Link href="https://zodopt.com/terms-and-conditions/" target="_blank" rel="noopener noreferrer">
              Terms and Conditions
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
