'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import './landing.css';

export default function LandingPage() {
  useEffect(() => {
    // Animate hero elements on load with staggered timing
    const heroElements = document.querySelectorAll('.badge, .hero h1, .hero h2, .hero p, .heroButtons');
    heroElements.forEach((el, i) => {
      setTimeout(() => el.classList.add('animate'), i * 160);
    });

    // Animate sections on scroll
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fadeUp');
        }
      });
    }, observerOptions);

    // Observe fade-up elements
    document.querySelectorAll('.fadeUp').forEach(el => {
      observer.observe(el);
    });

    // FAQ accordion functionality
    const questions = document.querySelectorAll('.faqQuestion');
    questions.forEach(question => {
      question.addEventListener('click', () => {
        const item = question.closest('.faqItem');
        const icon = question.querySelector('.icon');

        // Close other items
        document.querySelectorAll('.faqItem').forEach(faq => {
          if (faq !== item) {
            faq.classList.remove('active');
            const otherIcon = faq.querySelector('.icon');
            if (otherIcon) otherIcon.textContent = '+';
          }
        });

        // Toggle current item
        const isOpen = item.classList.contains('active');
        item.classList.toggle('active');
        if (icon) icon.textContent = isOpen ? '+' : '−';
      });
    });

    // Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);

  const whyCards = [
    { title: 'Instant Digital Visitor Pass', desc: 'Visitors receive secure virtual passes via Email/WhatsApp eliminating manual paper slips.', className: 'card1' },
    { title: 'Powerful Live Dashboard', desc: 'Track check-ins, check-outs, approvals and analytics in real time.', className: 'card2' },
    { title: 'Conference Room Booking + Email Alerts', desc: 'Employees can instantly book conference rooms. Organizers receive confirmation notifications.', className: 'card3' },
    { title: 'Company Specific Public URL', desc: 'Each company receives a dedicated access link where employees log in via OTP. No HR dependency, no onboarding workload.', className: 'card4' },
    { title: 'Zero Manual Work', desc: 'No registers, no spreadsheets, no paper passes. Everything automated.', className: 'card5' },
    { title: 'Secure & Enterprise Ready', desc: 'Role based authentication, encryption and compliance aligned security.', className: 'card6' }
  ];

  const steps = [
    { title: 'Visitor Registration', desc: 'Visitors can quickly register their arrival using either by scanning a QR code or a web link, making the check-in process seamless.', color: 'orange' },
    { title: 'Visitor Notification', desc: 'Visitor receives instant notification via email or WhatsApp.', color: 'purple' },
    { title: 'Digital Pass Issued', desc: 'Visitor receives a secure digital pass. Valid for specified duration and location.', color: 'blue' },
    { title: 'Track & Analyze', desc: 'Monitor activity on a live dashboard. Generate reports and maintain compliance.', color: 'pink' }
  ];

  const features = [
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
    'QR code based bookings'
  ];

  const industries = [
    { title: 'Corporates', desc: 'Enterprise offices with high visitor traffic and multiple meeting rooms', color: 'blue' },
    { title: 'IT Parks', desc: 'Technology campuses with multiple tenants and shared conference facilities', color: 'violet' },
    { title: 'Co-working Spaces', desc: 'Flexible workspaces managing visitors for multiple companies', color: 'green' },
    { title: 'Manufacturing Units', desc: 'Production facilities requiring strict security and visitor tracking', color: 'amber' },
    { title: 'Enterprises', desc: 'Large organizations with multi-location visitor management needs', color: 'red' },
    { title: 'Educational Institutions', desc: 'Universities and colleges managing campus visitors and event bookings', color: 'sky' }
  ];

  const testimonials = [
    { name: 'Rajesh Kumar', role: 'IT Manager', company: 'Tech Solutions Pvt Ltd', review: 'Promeet has completely transformed how we manage visitors. The digital passes and real-time dashboard have eliminated all manual work. Highly recommended!', featured: true },
    { name: 'Priya Sharma', role: 'HR Director', company: 'Global Enterprises', review: 'The conference room booking feature is a game-changer. No more double bookings or confusion. Our employees love how easy it is to use.' },
    { name: 'Amit Patel', role: 'Facility Manager', company: 'Manufacturing Co.', review: 'Security has improved significantly since we started using Promeet. We always know who is on our premises. WhatsApp notifications are very convenient.' }
  ];

  const securityFeatures = [
    { title: 'ISO 27001', desc: 'Information Security' },
    { title: 'SSL/TLS', desc: 'Encrypted Data' },
    { title: 'GDPR', desc: 'Compliant' },
    { title: '99.9%', desc: 'Uptime SLA' }
  ];

  const faqs = [
    { q: 'How does the 15-day trial work?', a: 'Pay just ₹49 to start your 15-day trial. You get full access to all Professional plan features. After the trial, you can choose to continue with a paid plan or cancel anytime with no further charges.' },
    { q: 'How long does it take to set up Promeet?', a: 'Setup is incredibly quick! Most organizations are up and running within 10 minutes. We provide step-by-step guidance, and our team is available to help with onboarding and training.' },
    { q: 'Is my data secure with Promeet?', a: 'Absolutely. We use enterprise-grade encryption, secure cloud storage, and comply with data protection regulations. Your visitor data is stored securely and only accessible to authorized personnel.' },
    { q: 'Does Promeet work offline?', a: 'Promeet requires an internet connection for real-time notifications and cloud sync. However, we offer offline modes for visitor check-in at reception with automatic sync when connected.' },
    { q: 'What happens to my data if I cancel?', a: 'You can export all your data before cancellation. We provide data export in standard formats (EXCEL, PDF). After cancellation, we retain your data for 30 days before permanent deletion.' },
    { q: 'Do you provide training for our team?', a: 'Yes! All plans include onboarding training. We provide video tutorials, documentation, and live training sessions. Enterprise customers get dedicated training programs.' },
    { q: 'Can we use Promeet across multiple office locations?', a: 'Yes! Professional and Enterprise plans support multiple locations. Each location can have its own settings, hosts, and reporting while maintaining centralized management.' },
    { q: 'What kind of support do you offer?', a: 'We offer email and WhatsApp support for all plans. Professional plans get priority support with faster response times. Enterprise customers have access to phone support and a dedicated account manager.' }
  ];

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="logo">
          <Image 
            src="/Brand Logo.png" 
            alt="Promeet Logo" 
            width={28}
            height={28}
            className="logoImg"
            priority
          />
          <div>
            Promeet <span>Visitor Management System</span>
          </div>
        </div>

        <nav>
          <a href="#features">Features</a>
          <a href="#Plans">Pricing</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#industries">Industries</a>
          <a href="#testimonials">Testimonials</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="headerAuth">
          <Link href="https://www.promeet.zodopt.com/auth/login" className="btnSignin">
            Sign In
          </Link>
          <Link href="https://www.promeet.zodopt.com/auth/login" className="btnSignup">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="badge">✨ Enterprise-Grade Platform</div>
        <h1>Promeet</h1>

        <div className="scrollContainer">
          <h1 className="scrollText">
            GO LIVE IN JUST 15 MINUTES!
          </h1>
        </div>

        <h2>Visitor Management System</h2>
        <p>A platform designed to digitalize organization entry management, streamline conference bookings and ensure a professional visitor experience.</p>

        <div className="heroButtons">
          <Link className="btnPrimary" href="https://www.promeet.zodopt.com/auth/login" target="_blank" rel="noopener noreferrer">
            Start 15-Day Trial →
          </Link>
          <Link className="btnSecondary" href="https://wa.me/918647878785" target="_blank" rel="noopener noreferrer">
            Watch Demo
          </Link>
        </div>
      </section>

      {/* Dashboard Glass Section */}
      <section className="dashboardGlass">
        <div className="dashboardCards">
          <div className="dashCard live">
            <div className="liveTop">
              <h3>⚡ Live Dashboard</h3>
              <span>● LIVE</span>
            </div>
            <div className="liveStats">
              <div className="stat">
                <h2>248</h2>
                <p>Visitors Today</p>
              </div>
              <div className="stat">
                <h2>12</h2>
                <p>Active Meetings</p>
              </div>
            </div>
          </div>

          <div className="dashCard meeting">
            <div className="meetingHead">
              <div className="icon">📅</div>
              <div>
                <h3>Conference Room A</h3>
                <p>Board Meeting • 2:00 PM - 4:00 PM</p>
              </div>
            </div>
            <div className="bars">
              <span className="fill"></span>
              <span></span>
              <span></span>
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

        <div className="dashDivider"></div>

        <div className="dashFeatures">
          <div><span>🛡</span><h4>Simple</h4><p>Easy to Use</p></div>
          <div><span>☁</span><h4>Cloud</h4><p>Based Platform</p></div>
          <div><span>🔒</span><h4>Secure</h4><p>Data Protection</p></div>
        </div>
      </section>

      {/* Why Section */}
      <section className="whySection" id="features" aria-label="Why Organizations Love Promeet">
        <div className="headingContainer">
          <span className="badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '6px' }}>
              <path d="M7.5 1.018a.5.5 0 0 1 .45.28l3.5 7a.5.5 0 0 1-.9.44L8.19 4.665v6.67a.5.5 0 0 1-1 0V4.665L4.45 8.738a.5.5 0 1 1-.9-.44l3.5-7a.5.5 0 0 1 .45-.28z"/>
            </svg>
            Powerful Features
          </span>
          <h2>
            Why Organizations Love <span>Promeet</span>
          </h2>
          <p className="subheading">
            Everything you need to manage visitors and conference rooms seamlessly
          </p>
        </div>

        <div className="cardsContainer">
          {whyCards.map((card, i) => (
            <div key={i} className={`card ${card.className}`} tabIndex={0} role="article">
              <div className="iconContainer">
                <svg xmlns="http://www.w3.org/2000/svg" fill="white" height="24" viewBox="0 0 24 24" width="24">
                  <path d="M12 2a5 5 0 0 0-5 5v4H6v10h12V11h-1v-4a5 5 0 0 0-5-5z"/>
                </svg>
              </div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="howItWorks" id="how-it-works">
        <div className="container">
          <span className="badge">✨ Simple Process</span>
          <h2 className="title">
            How <span>Promeet</span> Works
          </h2>
          <p className="subtitle">
            A streamlined 4-step process to manage all your visitors and meetings
          </p>

          <div className="steps">
            {steps.map((step, i) => (
              <div key={i} className="stepCard">
                <div className={`icon ${step.color}`}>
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/>
                  </svg>
                </div>
                <span className="stepNo">0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <p className="ctaText">Ready to experience the simplicity?</p>
          <Link href="https://www.promeet.zodopt.com/auth/login" className="ctaBtn">
            Start Your Trial – Just ₹49
          </Link>
        </div>
      </section>

      {/* Everything Section */}
      <section className="everythingSection">
        <div className="container">
          <span className="badge">✨ Complete Platform</span>
          <h2 className="title">
            Everything You Need, <span>All in One Place</span>
          </h2>
          <p className="subtitle">
            Comprehensive visitor and conference management features designed for modern organizations
          </p>

          <div className="featuresGrid">
            {features.map((feature, i) => (
              <div key={i} className="featureBox">{feature}</div>
            ))}
          </div>

          <div className="featuresCta">
            <Link href="https://www.promeet.zodopt.com/auth/login" target="_blank" rel="noopener noreferrer" className="ctaBtn">
              Get Started Today ↗
            </Link>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="industriesSection" id="industries">
        <div className="container">
          <span className="industryBadge">For Every Industry</span>
          <h2 className="industryTitle">
            Designed for <span>Modern Organizations</span>
          </h2>
          <p className="industrySubtitle">
            Promeet adapts to your industry's unique needs with flexible configurations
          </p>

          <div className="industryGrid">
            {industries.map((industry, i) => (
              <div key={i} className="industryCard">
                <div className={`industryIcon ${industry.color}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="6" y="3" width="5" height="18" rx="1"/>
                    <rect x="13" y="7" width="5" height="14" rx="1"/>
                  </svg>
                </div>
                <h3>{industry.title}</h3>
                <p>{industry.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="ctaSection">
        <div className="ctaBox">
          <div className="ctaIcon">✨</div>
          <h2>Ready to Make Your Organization Smarter?</h2>
          <p>
            Join hundreds of organizations that have transformed their visitor and
            conference management with Promeet
          </p>
          <div className="ctaActions">
            <Link href="https://wa.me/918647878785" target="_blank" rel="noopener noreferrer" className="btnPrimary">
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

      {/* Pricing Section */}
      <section className="pricingSection" id="Plans">
        <div className="pricingHeader">
          <span className="pricingBadge">💎 Flexible Plans</span>
          <h2 className="pricingTitle">Subscription Plans</h2>
          <p className="pricingSubtitle">
            Choose the perfect plan for your organization. All plans include core features with scalable options.
          </p>
        </div>

        <div className="pricingCards">
          <div className="pricingCard">
            <h3 className="planName">Trial</h3>
            <div className="planPrice">₹49 <span>/ 15 days</span></div>
            <p className="planDuration">Perfect for testing the platform</p>
            <ul className="planFeatures">
              <li>Valid for 15 Days</li>
              <li>100 Visitor Bookings</li>
              <li>100 Conference Bookings</li>
              <li>2 Conference Rooms</li>
            </ul>
            <Link href="https://www.promeet.zodopt.com/auth/login" className="planCta">
              Get Started
            </Link>
          </div>

          <div className="pricingCard featured">
            <span className="popularBadge">🔥 Popular</span>
            <h3 className="planName">Business</h3>
            <div className="planPrice">₹500 <span>/ month</span></div>
            <p className="planDuration">Ideal for growing organizations</p>
            <ul className="planFeatures">
              <li>Unlimited Visitors</li>
              <li>1000 Conference Bookings/month</li>
              <li>Up to 6 Conference Rooms</li>
              <li>Advanced Analytics & Reports</li>
            </ul>
            <Link href="https://www.promeet.zodopt.com/auth/login" className="planCta">
              Get Started
            </Link>
          </div>

          <div className="pricingCard">
            <h3 className="planName">Enterprise</h3>
            <div className="planPrice">Custom</div>
            <p className="planDuration">For large organizations</p>
            <ul className="planFeatures">
              <li>Unlimited Visitors</li>
              <li>Unlimited Conference Bookings</li>
              <li>Unlimited Conference Rooms</li>
              <li>Customised Support</li>
            </ul>
            <Link href="https://wa.me/918647878785" className="planCta">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonialsSection" id="testimonials">
        <div className="testimonialsContainer">
          <span className="sectionBadge">⭐ Customer Success Stories</span>
          <h2 className="sectionTitle">
            Trusted by <span>Organizations</span>
          </h2>
          <p className="sectionSubtitle">
            See what our customers have to say about their experience with Promeet
          </p>

          <div className="testimonialCards">
            {testimonials.map((testimonial, i) => (
              <div key={i} className={`testimonialCard ${testimonial.featured ? 'featured' : ''}`}>
                <div className="stars">★★★★★</div>
                <p className="review">{testimonial.review}</p>
                <div className="user">
                  <div className="avatar">👨‍💼</div>
                  <div>
                    <strong>{testimonial.name}</strong>
                    <span>{testimonial.role}<br/>{testimonial.company}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="testimonialStats">
            <div><h3>500+</h3><p>Organizations</p></div>
            <div><h3>50K+</h3><p>Visitors Managed</p></div>
            <div><h3>4.9/5</h3><p>Customer Rating</p></div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="securitySection">
        <div className="securityContainer">
          <h2 className="securityTitle">
            Enterprise-Grade Security & Compliance
          </h2>
          <p className="securitySubtitle">
            Your data is protected with industry-leading security standards
          </p>

          <div className="securityCards">
            {securityFeatures.map((item, i) => (
              <div key={i} className="securityCard">
                <div className="securityIcon" style={{ background: ['#4f6df5', '#059669', '#7c3aed', '#ff6a00'][i] }}>
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z"/>
                  </svg>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="securityBar">
            <div className="barItem"><h3>256-bit</h3><p>AES Encryption</p></div>
            <div className="divider"></div>
            <div className="barItem"><h3>24/7</h3><p>Security Monitoring</p></div>
            <div className="divider"></div>
            <div className="barItem"><h3>Daily</h3><p>Automated Backups</p></div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faqSection" id="faq">
        <div className="faqContainer">
          <span className="faqBadge">❓ Got Questions?</span>
          <h2 className="faqTitle">
            Frequently Asked <span>Questions</span>
          </h2>
          <p className="faqSubtitle">
            Everything you need to know about Promeet
          </p>

          <div className="faqList">
            {faqs.map((faq, i) => (
              <div key={i} className="faqItem">
                <button className="faqQuestion" aria-expanded="false">
                  <span>{faq.q}</span>
                  <span className="icon">+</span>
                </button>
                <div className="faqAnswer">{faq.a}</div>
              </div>
            ))}
          </div>

          <div className="faqCta">
            <h3>Still have questions?</h3>
            <p>Can't find the answer you're looking for? Our team is here to help.</p>
            <Link href="https://wa.me/918647878785" target="_blank" rel="noopener noreferrer" className="ctaBtn">
              Contact Support
            </Link>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section className="getStarted">
        <div className="gsContainer">
          <div className="gsLeft fadeUp">
            <span className="gsBadge">⚡ Start Your Free Trial</span>
            <h2>
              Get Started with <br />
              <span>Promeet Today</span>
            </h2>
            <p>
              Transform your visitor management and conference room booking experience.
              Contact us for a personalized demo.
            </p>
            <div className="gsContact">
              <div className="contactItem">
                <div className="icon whatsapp">
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M20.52 3.48A11.91 11.91 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.88 11.88 0 0 0 5.75 1.47c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.17-3.46-8.42z"/>
                  </svg>
                </div>
                <span>Chat on WhatsApp<br/><strong>+91 86478 78785</strong></span>
              </div>
              <div className="contactItem">
                <div className="icon email">
                  <svg viewBox="0 0 24 24" fill="white">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <span>Send us an email<br/><strong>admin@promeet.zodopt.com</strong></span>
              </div>
            </div>
          </div>

          <div className="gsRight fadeUp delay1">
            <div className="gsCard whatsappCard">
              <h3>Chat on WhatsApp</h3>
              <p>Get instant answers to your questions from our team</p>
              <Link href="https://wa.me/918647878785" target="_blank" rel="noopener noreferrer" className="btn">
                Start Conversation →
              </Link>
            </div>
            <div className="gsCard demoCard">
              <h3>Request a Demo</h3>
              <p>See Promeet in action with a personalized walkthrough</p>
              <Link href="mailto:admin@promeet.zodopt.com" className="btn secondary">
                Schedule Demo →
              </Link>
            </div>
          </div>
        </div>

        <div className="gsFeatures fadeUp delay2">
          <div className="featureBox"><h4>⚡ Quick Setup</h4><p>Get started in minutes, not days</p></div>
          <div className="featureBox"><h4>🎧 24/7 Support</h4><p>We're here whenever you need us</p></div>
          <div className="featureBox"><h4>🛡 Secure & Reliable</h4><p>Enterprise-grade security standards</p></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footerTop">
          <div className="footerBrand fadeUp">
            <div className="logoWrap">
              <Image 
                src="/Brand Logo.png" 
                alt="Promeet Logo"
                width={46}
                height={46}
              />
              <div>
                <h3>Promeet</h3>
                <span>Visitor Management System</span>
              </div>
            </div>
            <p>
              A platform designed to digitalize organization entry
              management, streamline conference bookings and ensure a
              professional visitor experience.
            </p>
            <div className="footerCta">
              <Link href="https://wa.me/918647878785" target="_blank" rel="noopener noreferrer" className="btnPrimary">
                WhatsApp →
              </Link>
              <Link href="mailto:admin@promeet.zodopt.com" className="btnSecondary">
                Email →
              </Link>
            </div>
          </div>

          <div className="footerLinks fadeUp delay1">
            <h4>Key Features</h4>
            <ul>
              <li>Digital Visitor Passes</li>
              <li>Live Dashboard</li>
              <li>Conference Booking</li>
              <li>Email & WhatsApp Alerts</li>
              <li>Multi-location Support</li>
              <li>Analytics & Reports</li>
            </ul>
          </div>

          <div className="footerLinks fadeUp delay2">
            <h4>Industries</h4>
            <ul>
              <li>Corporates</li>
              <li>IT Parks</li>
              <li>Co-working Spaces</li>
              <li>Manufacturing Units</li>
              <li>Enterprises</li>
              <li>Educational Institutions</li>
            </ul>
          </div>
        </div>

        <div className="footerTrust fadeUp delay3">
          <div className="trustCard">
            <span style={{ fontSize: '24px' }}>🛡</span>
            <div><strong>Secure</strong><span>Enterprise Grade</span></div>
          </div>
          <div className="trustCard">
            <span style={{ fontSize: '24px' }}>🕒</span>
            <div><strong>24/7</strong><span>Support</span></div>
          </div>
          <div className="trustCard">
            <span style={{ fontSize: '24px' }}>✔</span>
            <div><strong>Reliable</strong><span>99.9% Uptime</span></div>
          </div>
        </div>

        <div className="footerBottom fadeUp delay4">
          <span>© 2026 Promeet. All rights reserved.</span>
          <Link href="https://zodopt.com/about-us/" target="_blank" rel="noopener noreferrer" className="footerLink">
            <span>© Zodopt</span>
          </Link>
          <div className="footerLinksInline">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#security">Security</a>
          </div>
        </div>
      </footer>
    </>
  );
}
