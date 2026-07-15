'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import './landing-page.css';

const gaEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};

const WA_URL = 'https://wa.me/916366834745?text=Hi%2C+Can+i+know+more+about+Promeet+-+Visitor+Management+Platform';

const WHY_CARDS = [
  { color: 'purple', title: 'Instant Digital Visitor Pass', desc: 'Visitors receive secure virtual passes via Email/WhatsApp eliminating manual paper slips.',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 15.7c.5-1.4 1.7-2.3 3-2.3s2.5.9 3 2.3"/><line x1="14.5" y1="9" x2="19" y2="9"/><line x1="14.5" y1="13" x2="19" y2="13"/></svg> },
  { color: 'orange', title: 'Powerful Live Dashboard', desc: 'Track check-ins, check-outs, approvals and analytics in real time.',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13a8 8 0 1 1 16 0"/><path d="M12 13l3.5-4"/><path d="M4 13h1M19 13h1"/></svg> },
  { color: 'blue', title: 'Conference Room Booking + Email Alerts', desc: 'Employees can instantly book conference rooms. Organizers receive confirmation notifications.',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 15h2m4 0h2"/></svg> },
  { color: 'teal', title: 'Company Specific Public URL', desc: 'Each company receives a dedicated access link where employees log in via OTP. No HR dependency, no onboarding workload.',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l1.93-1.93a5 5 0 0 0-7.07-7.07L10.5 5.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-1.93 1.93a5 5 0 0 0 7.07 7.07L13.5 18.5"/></svg> },
  { color: 'amber', title: 'Zero Manual Work', desc: 'No registers, no spreadsheets, no paper passes. Everything automated.',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg> },
  { color: 'green', title: 'Secure & Enterprise Ready', desc: 'Role based authentication, encryption and compliance aligned security.',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l7 3v6c0 5-3.5 8.5-7 9.5-3.5-1-7-4.5-7-9.5v-6l7-3z"/><path d="M9 12l2 2 4-4.2"/></svg> },
];

const STEPS = [
  { color: 'orange', title: 'Visitor Registration', desc: 'Visitors register their arrival by scanning a QR code or using a web link, making check-in seamless.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM14 20h3M20 14v3M20 20h.01"/></svg> },
  { color: 'purple', title: 'Visitor Notification', desc: 'Visitor receives instant notification via email or WhatsApp.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
  { color: 'blue', title: 'Digital Pass Issued', desc: 'Visitor receives a secure digital pass valid for a specified duration and location.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 15.7c.5-1.4 1.7-2.3 3-2.3s2.5.9 3 2.3"/><line x1="14.5" y1="9" x2="19" y2="9"/><line x1="14.5" y1="13" x2="19" y2="13"/></svg> },
  { color: 'pink', title: 'Track & Analyze', desc: 'Monitor activity on a live dashboard. Generate reports and maintain compliance.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="6" width="3" height="14"/><rect x="16" y="9" width="3" height="11"/></svg> },
];

const FEATURES = [
  'Visitor Walk-in management','Digital visitor passes','Visitor notifications via email/WhatsApp','Conference room scheduling',
  'Meeting configuration, reschedule and cancel','Meeting confirmations','Comprehensive visitor analytics & reports',
  'Integration with access control systems','Multi-location support','Role-based access control','Mobile-responsive interface','QR code based bookings',
];

const INDUSTRIES = [
  { color: 'blue', title: 'Corporates', desc: 'Enterprise offices with high visitor traffic and multiple meeting rooms.' },
  { color: 'violet', title: 'IT Parks', desc: 'Technology campuses with multiple tenants and shared conference facilities.' },
  { color: 'green', title: 'Co-working Spaces', desc: 'Flexible workspaces managing visitors for multiple companies.' },
  { color: 'amber', title: 'Manufacturing Units', desc: 'Production facilities requiring strict security and visitor tracking.' },
  { color: 'red', title: 'Enterprises', desc: 'Large organizations with multi-location visitor management needs.' },
  { color: 'sky', title: 'Educational Institutions', desc: 'Universities and colleges managing campus visitors and event bookings.' },
];

const CheckSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

const PLANS = [
  { name: 'Trial', price: '₹49', period: '15 days', duration: 'Perfect for testing the platform', popular: false, accent: '#ff6a00',
    features: ['Valid for 15 days','100 Visitor Bookings','100 Conference Bookings','2 Conference Rooms'], cta: 'Get Started', isEnterprise: false },
  { name: 'Business', price: '₹500', period: 'month', duration: 'Ideal for growing organizations', popular: true, accent: '#7c3aed',
    features: ['Unlimited Visitors','1000 Conference Bookings/month','Up to 6 Conference Rooms','Advanced Analytics & Reports'], cta: 'Get Started', isEnterprise: false },
  { name: 'Enterprise', price: 'Custom', period: '', duration: 'For large organizations', popular: false, accent: '#ec4899',
    features: ['Unlimited Visitors','Unlimited Conference Bookings','Unlimited Conference Rooms','Customised Support'], cta: 'Contact Sales', isEnterprise: true },
];

const renderStars = (r) => {
  const f = Math.floor(r);
  const h = r % 1 >= 0.25;
  return (
    <>
      {'★'.repeat(f)}
      {h && <span style={{ display:'inline-block', clipPath:'inset(0 50% 0 0)', WebkitClipPath:'inset(0 50% 0 0)', letterSpacing:0 }}>★</span>}
    </>
  );
};

const TESTIMONIALS = [
  { name: 'Priya Nair', review: "Promeet's dashboard makes it so easy to see check-ins and check-outs in real time. The digital visitor pass feature alone has cut down so much manual paperwork at our front desk.", stars: 5 },
  { name: 'Rajesh Iyer', review: "The conference room booking with instant email alerts is genuinely useful — no more double bookings or confusion between teams. The platform feels well-built and reliable.", stars: 4.5 },
  { name: 'Ananya Deshmukh', review: "WhatsApp notifications for visitor passes are a nice touch — visitors get their pass instantly without any hassle. Setup was quick and the interface is clean and easy to use.", stars: 4 },
];

const SECURITY = [
  { color: '#4f6df5', title: 'ISO 27001', desc: 'Information Security',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5L7 21l5-3 5 3-1.5-8.5"/></svg> },
  { color: '#059669', title: 'SSL/TLS', desc: 'Encrypted Data',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> },
  { color: '#7c3aed', title: 'GDPR', desc: 'Compliant',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l7 3v6c0 5-3.5 8.5-7 9.5-3.5-1-7-4.5-7-9.5v-6l7-3z"/><path d="M9 12l2 2 4-4.2"/></svg> },
  { color: '#ff6a00', title: '99.9%', desc: 'Uptime SLA',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> },
];

const FAQS = [
  { q: 'How does the 15-day trial work?', a: 'Pay just ₹49 to start your 15-day trial. You get full access to all Professional plan features. After the trial, choose to continue with a paid plan or cancel anytime — no further charges.' },
  { q: 'How long does it take to set up?', a: 'Setup is incredibly quick! Most organizations are up and running within 15 minutes. We provide step-by-step guidance and our team is available to help with onboarding.' },
  { q: 'Is my data secure?', a: 'Absolutely. We use enterprise-grade encryption, secure cloud storage, and comply with data protection regulations.' },
  { q: 'Does it work offline?', a: 'An internet connection is required for real-time notifications and cloud sync. Offline check-in mode is available at reception with automatic sync when reconnected.' },
  { q: 'What happens to my data if I cancel?', a: 'You can export all data before cancellation in Excel or PDF format. We retain your data for 30 days post-cancellation before permanent deletion.' },
  { q: 'Do you provide training for our team?', a: 'Yes! All plans include onboarding training — video tutorials, documentation, and live sessions.' },
  { q: 'Can we use it across multiple office locations?', a: 'Yes! Professional and Enterprise plans support multiple locations, each with its own settings, hosts, and reporting.' },
  { q: 'What kind of support do you offer?', a: 'Email and WhatsApp support for all plans. Professional plans get priority support. Enterprise customers get phone support and a dedicated account manager.' },
];

const FAQ_COLORS = ['#7c3aed','#ff6a00','#ec4899','#4f6df5','#0d9488','#d97706','#059669','#2a1150'];

const BuildingSvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="8" height="18"/><rect x="13" y="8" width="8" height="13"/>
    <line x1="7" y1="8" x2="7" y2="8.01"/><line x1="7" y1="12" x2="7" y2="12.01"/>
    <line x1="17" y1="12" x2="17" y2="12.01"/><line x1="17" y1="16" x2="17" y2="16.01"/>
  </svg>
);

const FeatureTick = () => (
  <span className="featureTick">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  </span>
);

export default function HomePage() {
  const router = useRouter();
  const [activeCarousel, setActiveCarousel] = useState(0);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [openFaqs, setOpenFaqs] = useState(new Set());
  const [showWaTooltip, setShowWaTooltip] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const VP_STATIC = {
    name: 'Anand Sharma', phone: '+91 98765 43210',
    meeting: 'Priya Singh — HR Department', purpose: 'Job Interview Discussion', company: 'Tech Corp',
  };
  const [vpPass, setVpPass] = useState({
    badge: 'VP-4821', name: 'Anand Sharma', phone: '+91 98765 43210',
    meeting: 'Priya Singh — HR Department', purpose: 'Job Interview Discussion', company: 'Tech Corp', checkin: '10:30 AM',
  });
  const carouselTimerRef = useRef(null);
  const n = WHY_CARDS.length;

  const startCarousel = useCallback(() => {
    clearInterval(carouselTimerRef.current);
    carouselTimerRef.current = setInterval(() => {
      setActiveCarousel(prev => (prev + 1) % n);
    }, 2000);
  }, [n]);

  const resetCarousel = useCallback((idx) => {
    setActiveCarousel(idx);
    startCarousel();
  }, [startCarousel]);

  useEffect(() => {
    startCarousel();
    return () => clearInterval(carouselTimerRef.current);
  }, [startCarousel]);

  useEffect(() => {
    const show = setTimeout(() => setShowWaTooltip(true), 3000);
    const hide = setTimeout(() => setShowWaTooltip(false), 8000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  const getCardClass = (i) => {
    let diff = i - activeCarousel;
    if (diff > n / 2) diff -= n;
    if (diff < -n / 2) diff += n;
    if (diff === 0) return 'pos-0';
    if (diff === -1) return 'pos--1';
    if (diff === 1) return 'pos-1';
    if (diff === -2) return 'pos--2';
    if (diff === 2) return 'pos-2';
    return 'pos-hidden';
  };

  const handleGeneratePass = () => {
    const badgeNum = Math.floor(1000 + Math.random() * 9000);
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const badge = `VP-${badgeNum}`;
    setVpPass({
      badge, checkin: now,
      name: VP_STATIC.name, phone: VP_STATIC.phone,
      meeting: VP_STATIC.meeting, purpose: VP_STATIC.purpose, company: VP_STATIC.company,
    });
    gaEvent('visitor_pass_generated', { name: VP_STATIC.name, company: VP_STATIC.company, purpose: VP_STATIC.purpose });
    setShowPass(true);
  };

  const toggleFaq = (i) => {
    setOpenFaqs(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  };

  const initials = (vpPass.name || 'V').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'V';
  const halfFaq = Math.ceil(FAQS.length / 2);

  return (
    <div className="pmLanding">
      {/* ── FLOATING WHATSAPP ── */}
      <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="floatingWhatsapp" aria-label="Chat with us on WhatsApp"
        onMouseEnter={() => setShowWaTooltip(true)} onMouseLeave={() => setShowWaTooltip(false)}>
        <span className="waPulse" aria-hidden="true" />
        <span className="waPulse waPulse2" aria-hidden="true" />
        <span className="waIconWrap">
          <Image className="waIconImg" src="/whatsapp-icon.png" alt="WhatsApp" width={64} height={64} />
        </span>
        <span className={`waTooltip${showWaTooltip ? ' waTooltipVisible' : ''}`}>Chat with us on WhatsApp</span>
      </a>

      {/* ── HEADER ── */}
      <header>
        <div className="logo">
          <Image className="logoDot" src="/promeet-logo.png" alt="Promeet logo" width={40} height={40} />
          <div>Zodopt&apos;s Promeet<span>Visitor Management Platform</span></div>
        </div>
        <nav>
          <a href="#features-section">Features</a>
          <a href="#Plans">Pricing</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#industries-section">Industries</a>
          <a href="#testimonials-section">Testimonials</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="headerAuth">
          <Link className="btnSignin" href="/auth/login">Sign In</Link>
          <Link className="btnSignup" href="/auth/register">Sign Up</Link>
        </div>
        <button className={`hamburger${isMobileNavOpen ? ' active' : ''}`}
          onClick={() => setIsMobileNavOpen(v => !v)} aria-label="Toggle navigation">
          <span /><span /><span />
        </button>
      </header>

      {/* ── MOBILE NAV ── */}
      <nav className={`mobileNav${isMobileNavOpen ? ' open' : ''}`}>
        {[['Features','#features-section'],['Pricing','#Plans'],['How It Works','#how-it-works'],['Industries','#industries-section'],['Testimonials','#testimonials-section'],['FAQ','#faq']].map(([label, href]) => (
          <a key={href} href={href} onClick={() => setIsMobileNavOpen(false)}>{label}</a>
        ))}
        <div className="headerAuth" style={{ display: 'flex' }}>
          <Link className="btnSignin" href="/auth/login" onClick={() => setIsMobileNavOpen(false)}>Sign In</Link>
          <Link className="btnSignup" href="/auth/register" onClick={() => setIsMobileNavOpen(false)}>Sign Up</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero gridBg" aria-label="Hero">
        <div className="heroGlow heroGlow1" /><div className="heroGlow heroGlow2" />
        <div className="heroBrandBlock">
          <p className="heroBrandLabel"><span className="heroBrandLine" />Zodopt&apos;s<span className="heroBrandLine" /></p>
          <h1>Promeet</h1>
        </div>
        <div className="heroPill" role="status" aria-live="polite">
          <span className="pillIcon" aria-hidden="true">⚡</span>
          <span className="pillText">GO LIVE IN JUST 15 MINUTES!</span>
        </div>
        <h2>Visitor Management Platform</h2>
        <p>A platform designed to digitalize organization entry management, streamline conference bookings and ensure a professional visitor experience.</p>
        <div className="heroButtons">
          <Link className="btnPrimary" href="/auth/register" onClick={() => gaEvent('cta_click', { section: 'hero', label: 'trial' })}>Start 15 days Trial →</Link>
          <a className="btnSecondary" href={WA_URL} target="_blank" rel="noopener noreferrer">Chat with Us</a>
        </div>
      </section>

      {/* ── DASHBOARD GLASS ── */}
      <section className="dashboardGlass gridBg">
        <div className="container">
          <div className="dashboardCards">
            <div className="dashCard visitStatus" onClick={() => router.push('/auth/login')} style={{ cursor: 'pointer' }}>
              <div className="visitStatusHead">
                <h3>Visit Status</h3>
                <p>Distribution for this period</p>
              </div>
              <div className="visitStatusBody">
                <div className="donutWrap">
                  <svg viewBox="0 0 100 100" width="110" height="110">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#6b6480" strokeWidth="14" strokeDasharray="125.6 251.2" strokeDashoffset="0" transform="rotate(-90 50 50)"/>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#7c3aed" strokeWidth="14" strokeDasharray="125.6 251.2" strokeDashoffset="-125.6" transform="rotate(-90 50 50)"/>
                  </svg>
                  <div className="donutCenter"><strong>6</strong><span>TOTAL</span></div>
                </div>
                <div className="visitLegend">
                  <div className="visitLegendRow">
                    <span className="visitLegendLeft"><span className="visitDot" style={{ background: '#6b6480' }} />Auto Checked Out</span>
                    <span className="visitLegendRight"><span className="visitCount">3</span><span className="visitPct">50%</span></span>
                  </div>
                  <div className="visitLegendRow">
                    <span className="visitLegendLeft"><span className="visitDot" style={{ background: '#7c3aed' }} />Checked Out</span>
                    <span className="visitLegendRight"><span className="visitCount">3</span><span className="visitPct">50%</span></span>
                  </div>
                </div>
              </div>
              <div className="visitBar"><span className="segGray" /><span className="segPurple" /></div>
            </div>

            <div className="dashCard meeting peakHours" onClick={() => router.push('/auth/login')} style={{ cursor: 'pointer' }}>
              <div className="peakHead">
                <h3>Peak Check-in Hours</h3>
                <p>Busiest times of day (IST)</p>
              </div>
              <div className="peakBars">
                {[24,20,28,22,32,26,36,30,90,40,62,28,84,60,26,22,18,16].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} className={h >= 80 ? 'peak' : h >= 55 ? 'peakMed' : ''} />
                ))}
              </div>
              <div className="peakLabels">
                {['12am','4am','8am','12pm','4pm','8pm'].map(l => <span key={l}>{l}</span>)}
              </div>
            </div>

            <div className="vpCard" onClick={() => router.push('/auth/login')} style={{ cursor: 'pointer' }}>
              <div className="vpCardHeader">
                <span className="vpCardHeaderLeft"><span className="vpDot" /><small>VISITOR PASS</small></span>
                <span className="vpCardId">{vpPass.badge}</span>
              </div>
              <div className="vpCardTop">
                <div className="vpCardDetails">
                  <div className="vpDetailRow"><span className="vpLabel">Name</span><span className="vpValue">{vpPass.name}</span></div>
                  <div className="vpDetailRow"><span className="vpLabel">Phone</span><span className="vpValue" style={{filter:'blur(4px)',userSelect:'none'}}>{vpPass.phone}</span></div>
                  <div className="vpDetailRow"><span className="vpLabel">Meeting</span><span className="vpValue">{vpPass.meeting}</span></div>
                  <div className="vpDetailRow"><span className="vpLabel">Purpose</span><span className="vpValue">{vpPass.purpose}</span></div>
                  <div className="vpDetailRow"><span className="vpLabel">Check-in</span><span className="vpValue">{vpPass.checkin}</span></div>
                </div>
                <span className="vpAvatar">{initials}</span>
              </div>
              <div className="vpWaBanner">
                <div className="vpWaBannerLeft">
                  <span className="vpWaBannerIcon">
                    <Image src="/whatsapp-icon.png" alt="WhatsApp" width={26} height={26} />
                  </span>
                  <div className="vpWaBannerText">
                    <strong>Stay Connected with Promeet</strong>
                    <span>Join our WhatsApp group for updates and support</span>
                  </div>
                </div>
                <button className="vpWaBannerBtn" type="button" onClick={e => { e.stopPropagation(); window.open('https://whatsapp.com/channel/0029Vb920FW6xCSXrse9QS2v', '_blank'); }}>Join WhatsApp Group</button>
              </div>
            </div>
          </div>

          <div className="dashboardBottom">
            <div className="vpForm">
              {!showPass ? (
                <>
                  <h3>Enter Your Details</h3>
                  {[
                    { label: 'FULL NAME',       value: VP_STATIC.name },
                    { label: 'PHONE NUMBER',    value: VP_STATIC.phone },
                    { label: 'MEETING WITH',    value: VP_STATIC.meeting },
                    { label: 'MEETING PURPOSE', value: VP_STATIC.purpose },
                    { label: 'COMPANY',         value: VP_STATIC.company },
                  ].map(f => (
                    <div className="formGroup" key={f.label}>
                      <label style={{fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',color:'#888'}}>{f.label}</label>
                      <div style={{padding:'10px 14px',background:'#f7f5fb',borderRadius:10,fontSize:'15px',color:'#1a1a2e',fontWeight:500}}>{f.value}</div>
                    </div>
                  ))}
                  <button className="vpBtn" onClick={handleGeneratePass}>Generate My Visitor Pass</button>
                </>
              ) : (
                <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <h3 style={{margin:0}}>Your Visitor Pass</h3>
                    <button onClick={() => setShowPass(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#888',lineHeight:1}}>✕</button>
                  </div>
                  <div style={{background:'linear-gradient(135deg,#7c3aed11,#ec489911)',borderRadius:14,padding:'18px 16px',display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',color:'#7c3aed'}}>● VISITOR PASS</span>
                      <span style={{fontWeight:700,color:'#7c3aed',fontSize:13}}>{vpPass.badge}</span>
                    </div>
                    {[
                      { label: 'NAME',    value: vpPass.name },
                      { label: 'PHONE',   value: vpPass.phone, blur: true },
                      { label: 'MEETING', value: vpPass.meeting },
                      { label: 'PURPOSE', value: vpPass.purpose },
                      { label: 'CHECK-IN',value: vpPass.checkin },
                    ].map(r => (
                      <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #e5e0f5'}}>
                        <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.08em',color:'#888'}}>{r.label}</span>
                        <span style={{fontWeight:600,fontSize:14,color:'#1a1a2e',filter:r.blur?'blur(4px)':'none',userSelect:r.blur?'none':'auto'}}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <button className="vpBtn" style={{marginTop:14,background:'#25d366'}} onClick={() => window.open('https://whatsapp.com/channel/0029Vb920FW6xCSXrse9QS2v','_blank')}>
                    Join WhatsApp Group
                  </button>
                </>
              )}
            </div>

            <div className="waPhone">
              <div className="waHeader">
                <span className="waBack">‹</span>
                <div className="waAvatar" style={{ background: '#fff', overflow: 'hidden', padding: 0 }}>
                  <Image src="/promeet-logo.png" alt="Promeet logo" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div className="waHeaderText">
                  <div className="name">Promeet</div>
                  <div className="handle">Zodopts_Promeet</div>
                </div>
              </div>
              <div className="waBody">
                <div className="waBubble">
                  <p className="title">Your Digital Visitor Pass</p>
                  <p>Welcome to Promeet!</p>
                  <p>Your visitor pass is ready. Please show this at reception.</p>
                  <p>View Pass:</p>
                  <span className="link" style={{ display:'block',color:'#25d366',wordBreak:'break-all',margin:'0 0 12px' }}>
                    https://www.promeet.zodopt.com/v/pass?code=<strong>{vpPass.badge}</strong>
                  </span>
                  <div className="details">
                    <div>Visitor ID: <strong>{vpPass.badge}</strong></div>
                    <div>Name: <strong>{vpPass.name}</strong></div>
                    <div>Purpose: <strong>{vpPass.purpose}</strong></div>
                    <div>Check-in: <span>{vpPass.checkin}</span></div>
                  </div>
                  <p>Please show your visitor pass at the reception.</p>
                  <div className="timestamp">{vpPass.checkin}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY SECTION — 3D CAROUSEL ── */}
      <section className="whySection gridBg" id="features-section">
        <div className="container">
          <span className="badge">Powerful Features</span>
          <h2>Why Organizations Love <span>Promeet</span></h2>
          <p className="subheading">Everything you need to manage visitors and conference rooms seamlessly</p>
          <div className="carousel3D">
            <button className="carouselArrow left" onClick={() => resetCarousel((activeCarousel - 1 + n) % n)} aria-label="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div className="carouselStage">
              {WHY_CARDS.map((card, i) => (
                <div key={i} className={`card ${card.color} ${getCardClass(i)}`} onClick={() => resetCarousel(i)}>
                  <div className={`iconContainer ${card.color}`}>{card.icon}</div>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </div>
              ))}
            </div>
            <button className="carouselArrow right" onClick={() => resetCarousel((activeCarousel + 1) % n)} aria-label="Next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
          </div>
          <div className="carouselDots">
            {WHY_CARDS.map((_, i) => (
              <button key={i} className={`carouselDot${i === activeCarousel ? ' active' : ''}`}
                onClick={() => resetCarousel(i)} aria-label={`Go to slide ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="howItWorks gridBg" id="how-it-works">
        <div className="container">
          <h2 className="title">How <span>Promeet</span> Works</h2>
          <p className="subtitle">A streamlined 4-step process to manage all your visitors and meetings</p>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={i} className="stepCard" onClick={() => { gaEvent('cta_click', { section: 'how_it_works' }); router.push('/auth/register'); }}
                tabIndex={0} role="link" style={{ cursor: 'pointer' }}>
                <div className={`icon ${s.color}`}>{s.icon}</div>
                <span className="stepNo">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="ctaText">Ready to experience the simplicity?</p>
          <Link className="ctaBtn" href="/auth/register" onClick={() => gaEvent('cta_click', { section: 'how_it_works', label: 'trial' })}>Start Your Trial – Just ₹49</Link>
        </div>
      </section>

      {/* ── EVERYTHING SECTION ── */}
      <section className="everythingSection gridBg">
        <div className="container">
          <h2 className="title">Everything You Need, <span>All in One Place</span></h2>
          <p className="subtitle">Comprehensive visitor and conference management features designed for modern organizations</p>
          <div className="featuresGrid">
            {FEATURES.map((f, i) => (
              <div key={i} className="featureBox"><FeatureTick /><span>{f}</span></div>
            ))}
          </div>
          <Link className="ctaBtn" href="/auth/login" onClick={() => gaEvent('cta_click', { section: 'features' })}>Get Started Today ↗</Link>
        </div>
      </section>

      {/* ── INDUSTRIES ── */}
      <section className="industriesSection gridBg" id="industries-section">
        <div className="container">
          <h2 className="industryTitle">Designed for <span>Modern Organizations</span></h2>
          <p className="industrySubtitle">Promeet adapts to your industry&apos;s unique needs with flexible configurations</p>
          <div className="industryGrid">
            {INDUSTRIES.map((ind, i) => (
              <div key={i} className="industryCard" onClick={() => window.open(WA_URL, '_blank')} tabIndex={0} role="link" style={{ cursor: 'pointer' }}>
                <div className={`industryIcon ${ind.color}`}><BuildingSvg /></div>
                <h3>{ind.title}</h3>
                <p>{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="pricingSection gridBg" id="Plans">
        <h2 className="pricingTitle">Subscription Plans</h2>
        <p className="pricingSubtitle">Choose the perfect plan for your organization. All plans include core features with scalable options.</p>
        <div className="pricingCards">
          {PLANS.map((p, i) => (
            <div key={i} className={`pricingCard${p.popular ? ' featured' : ''}`} style={{ '--plan-accent': p.accent }}>
              {p.popular && <span className="popularBadge">★ Most Popular</span>}
              <div className="planIcon">
                {i === 0 && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>}
                {i === 1 && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5c2.8 1.4 4.8 4.2 4.8 8.5 0 2.5-.8 4.8-1.8 6.5H9c-1-1.7-1.8-4-1.8-6.5 0-4.3 2-7.1 4.8-8.5z"/><circle cx="12" cy="10" r="1.8"/><path d="M9 17.5l-2.5 3.5M15 17.5l2.5 3.5"/><path d="M7.2 13c-1.5.3-2.7 1.3-3.2 3 1.7.4 3.2 0 4.3-1M16.8 13c1.5.3 2.7 1.3 3.2 3-1.7.4-3.2 0-4.3-1"/></svg>}
                {i === 2 && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="18"/><rect x="13" y="8" width="8" height="13"/><line x1="7" y1="8" x2="7" y2="8.01"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="17" y1="12" x2="17" y2="12.01"/><line x1="17" y1="16" x2="17" y2="16.01"/></svg>}
              </div>
              <h3 className="planName">{p.name}</h3>
              <div className="planPrice">{p.price}{p.period && <span> / {p.period}</span>}</div>
              <p className="planDuration">{p.duration}</p>
              <ul className="planFeatures">
                {p.features.map((f, j) => (
                  <li key={j}><span className="checkIcon"><CheckSvg /></span>{f}</li>
                ))}
              </ul>
              {p.isEnterprise ? (
                <a className="planCta" href={WA_URL} target="_blank" rel="noopener noreferrer"
                  onClick={() => gaEvent('pricing_click', { plan: p.name })}>{p.cta}</a>
              ) : (
                <Link className="planCta" href="/auth/register"
                  onClick={() => { gaEvent('pricing_click', { plan: p.name }); gaEvent('generate_lead', { value: i === 0 ? 49 : 500, currency: 'INR', plan: p.name.toLowerCase() }); }}>{p.cta}</Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── COMBINED CTA + SECURITY ── */}
      <section className="combinedSection gridBg">
        <div className="combinedInner">
          <div className="combinedCta">
            <h2>Ready to Make Your Organization Smarter?</h2>
            <p>Join hundreds of organizations that have transformed their visitor and conference management with Promeet</p>
            <div className="ctaActions">
              <a className="btnPrimary" href={WA_URL} target="_blank" rel="noopener noreferrer"
                onClick={() => gaEvent('cta_click', { section: 'cta_banner', label: 'demo' })}>Schedule a Demo →</a>
            </div>
            <div className="ctaPoints">
              <span>● Free Trial Available</span>
              <span>● No Credit Card Required</span>
              <span>● Setup in Minutes</span>
            </div>
          </div>
          <div className="combinedDivider" />
          <div className="combinedSecurity">
            <h2>Enterprise-Grade Security &amp; Compliance</h2>
            <p>Your data is protected with industry-leading security standards</p>
            <div className="securityCards">
              {SECURITY.map((s, i) => (
                <div key={i} className="securityCard" onClick={() => window.open('https://zodopt.com/about-us/', '_blank')} tabIndex={0} role="link" style={{ cursor: 'pointer' }}>
                  <div className="securityIcon" style={{ background: s.color }}>{s.icon}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="securityBar">
              <div className="barItem"><h3>256-bit</h3><p>AES Encryption</p></div>
              <div className="divider" />
              <div className="barItem"><h3>24/7</h3><p>Security Monitoring</p></div>
              <div className="divider" />
              <div className="barItem"><h3>Daily</h3><p>Automated Backups</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="testimonialsSection gridBg" id="testimonials-section">
        <h2 className="sectionTitle">Trusted by <span>Organizations</span></h2>
        <p className="sectionSubtitle">See what our customers have to say about their experience with Promeet</p>
        <div className="testimonialCards">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`testimonialCard${i === 0 ? ' featured' : ''}`}
              onClick={() => window.open(WA_URL, '_blank')} tabIndex={0} role="link" style={{ cursor: 'pointer' }}>
              <div className="stars">{renderStars(t.stars)}</div>
              <p className="review">{t.review}</p>
              <div className="user">
                <div><strong>{t.name}</strong><span></span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="faqSection gridBg" id="faq">
        <div className="faqContainer">
          <h2 className="faqTitle">Frequently Asked <span>Questions</span></h2>
          <p className="faqSubtitle">Everything you need to know about Promeet</p>
          <div className="faqGrid">
            <div className="faqCol">
              {FAQS.slice(0, halfFaq).map((faq, i) => (
                <div key={i} className={`faqItem${openFaqs.has(i) ? ' open' : ''}`} onClick={() => toggleFaq(i)}>
                  <div className="faqItemHead">
                    <h4>{faq.q}</h4>
                    <span className="faqItemToggle" style={{ background: FAQ_COLORS[i % FAQ_COLORS.length] }}>+</span>
                  </div>
                  <div className={`faqItemAnswer${openFaqs.has(i) ? ' open' : ''}`}>{faq.a}</div>
                </div>
              ))}
            </div>
            <div className="faqCol">
              {FAQS.slice(halfFaq).map((faq, i) => {
                const idx = i + halfFaq;
                return (
                  <div key={idx} className={`faqItem${openFaqs.has(idx) ? ' open' : ''}`} onClick={() => toggleFaq(idx)}>
                    <div className="faqItemHead">
                      <h4>{faq.q}</h4>
                      <span className="faqItemToggle" style={{ background: FAQ_COLORS[idx % FAQ_COLORS.length] }}>+</span>
                    </div>
                    <div className={`faqItemAnswer${openFaqs.has(idx) ? ' open' : ''}`}>{faq.a}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="faqCta">
            <h3>Still have questions?</h3>
            <p>Our team is here to help you get started with Promeet</p>
            <a className="ctaBtn" href={WA_URL} target="_blank" rel="noopener noreferrer"
              onClick={() => gaEvent('cta_click', { section: 'faq' })}>Chat with Our Team →</a>
          </div>
        </div>
      </section>

      {/* ── GET STARTED ── */}
      <section className="getStarted gridBg">
        <div className="gsContainer">
          <div className="gsLeft">
            <span className="gsBadge">⚡ Start Your Free Trial</span>
            <h2>Get Started with <br /><span>Zodopt&apos;s Promeet Today</span></h2>
            <p>Transform your visitor management and conference room booking experience. Contact us for a personalized demo.</p>
            <div className="gsContact">
              <a className="contactItem" href={WA_URL} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                onClick={() => gaEvent('cta_click', { section: 'get_started', label: 'whatsapp' })}>
                <div className="icon whatsapp">
                  <Image src="/whatsapp-icon.png" alt="WhatsApp" width={20} height={20} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span>Chat on WhatsApp<br /><strong>+91 63668 34745</strong></span>
              </a>
              <a className="contactItem" href="mailto:admin@promeet.zodopt.com"
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                onClick={() => gaEvent('cta_click', { section: 'get_started', label: 'email' })}>
                <div className="icon email">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <span>Send us an email<br /><strong>admin@promeet.zodopt.com</strong></span>
              </a>
            </div>
          </div>
          <div className="gsRight">
            <div className="gsCard whatsappCard">
              <h3>Chat on WhatsApp</h3>
              <p>Get instant answers to your questions from our team</p>
              <a className="btn" href={WA_URL} target="_blank" rel="noopener noreferrer">Start Conversation →</a>
            </div>
            <div className="gsCard demoCard">
              <h3>Request a Demo</h3>
              <p>See Promeet in action with a personalized walkthrough</p>
              <a className="btn secondary" href="mailto:admin@promeet.zodopt.com">Schedule Demo →</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer gridBg">
        <div className="footerTop">
          <div className="footerBrand">
            <div className="logoWrap">
              <Image className="logoDot" src="/promeet-logo.png" alt="Promeet logo" width={40} height={40} />
              <div><h3>Zodopt&apos;s Promeet</h3><span>Visitor Management Platform</span></div>
            </div>
            <p>A platform designed to digitalize organization entry management, streamline conference bookings and ensure a professional visitor experience.</p>
            <div className="footerCta">
              <a className="btnPrimary" href={WA_URL} target="_blank" rel="noopener noreferrer">WhatsApp →</a>
              <a className="btnSecondary" href="mailto:admin@promeet.zodopt.com">Email →</a>
            </div>
          </div>
          <div className="footerLinks">
            <h4>Key Features</h4>
            <ul>
              {['Digital Visitor Passes','Live Dashboard','Conference Booking','Email & WhatsApp Alerts','Multi-location Support','Analytics & Reports'].map(f => (
                <li key={f}><a href="#features-section" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>{f}</a></li>
              ))}
            </ul>
          </div>
          <div className="footerLinks">
            <h4>Industries</h4>
            <ul>
              {INDUSTRIES.map(ind => (
                <li key={ind.title}><a href="#industries-section" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>{ind.title}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footerTrust">
          {[
            { label: 'Secure', sub: 'Enterprise Grade', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l7 3v6c0 5-3.5 8.5-7 9.5-3.5-1-7-4.5-7-9.5v-6l7-3z"/><path d="M9 12l2 2 4-4.2"/></svg> },
            { label: '24/7', sub: 'Support', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { label: 'Reliable', sub: '99.9% Uptime', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg> },
          ].map((tc, i) => (
            <div key={i} className="trustCard" onClick={() => router.push('/auth/register')} style={{ cursor: 'pointer' }}>
              {tc.icon}
              <div><strong>{tc.label}</strong><span>{tc.sub}</span></div>
            </div>
          ))}
        </div>
        <div className="footerBottom">
          <span>© 2026 Zodopt&apos;s Promeet. All rights reserved.</span>
          <a href="https://zodopt.com/about-us/" target="_blank" rel="noopener noreferrer">© Zodopt</a>
          <div className="footerLinksInline">
            <a href="https://zodopt.com/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <a href="https://zodopt.com/terms-and-conditions/" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
