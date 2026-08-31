import './guide.css';

export const metadata = {
  title: 'User Guide',
  description:
    "A click-by-click walkthrough of Hai Visitor — from the landing page trial signup through every dashboard module, with real page routes and pricing.",
  alternates: { canonical: '/guide' },
};

const BODY_HTML = `
<div class="guide-root">
<div class="guide-shell">

  <!-- ============ SIDEBAR ============ -->
  <nav class="guide-sidebar" aria-label="Guide sections">
    <div class="sb-brand">
      <div class="mark">H</div>
      <div class="name">Hai Visitor<small>Field Guide</small></div>
    </div>

    <a class="sb-home-link" href="/">← Back to haivisitor.zodopt.com</a>

    <div class="sb-group">
      <div class="sb-label">Getting started</div>
      <a class="sb-link" href="#getting-started"><span class="num">01</span> Sign up &amp; pay</a>
      <a class="sb-link" href="#login"><span class="num">02</span> Logging in</a>
      <a class="sb-link" href="#dashboard"><span class="num">03</span> Home dashboard</a>
    </div>

    <div class="sb-group">
      <div class="sb-label">Core modules</div>
      <a class="sb-link" href="#visitors"><span class="num">04</span> Visitor management</a>
      <a class="sb-link" href="#employees"><span class="num">05</span> Employee directory</a>
      <a class="sb-link" href="#conference"><span class="num">06</span> Conference rooms</a>
      <a class="sb-link" href="#reports"><span class="num">07</span> Reports &amp; analytics</a>
      <a class="sb-link" href="#form-builder"><span class="num">08</span> Form builder</a>
    </div>

    <div class="sb-group">
      <div class="sb-label">Account</div>
      <a class="sb-link" href="#billing"><span class="num">09</span> Plans &amp; billing</a>
      <a class="sb-link" href="#settings"><span class="num">10</span> Account settings</a>
      <a class="sb-link" href="#appendix"><span class="num">11</span> Status glossary</a>
    </div>

    <div class="sb-theme-note">Every screen below is a faithful mock of the real product — colors, labels and buttons match what you'll actually see.</div>
  </nav>

  <!-- ============ MAIN ============ -->
  <main class="guide-main">

    <!-- ============ COVER ============ -->
    <header class="cover">
      <div class="cover-eyebrow">● Complete Walkthrough</div>
      <h1>Everything Hai Visitor does, <em>click by click.</em></h1>
      <p>From the very first "Start Trial" button on the public website through to running reports on a Tuesday afternoon — this guide follows the exact screens, buttons and page redirects you'll encounter, in order.</p>
      <div class="cover-meta">
        <div><b>11</b><span>Sections</span></div>
        <div><b>10 min</b><span>Sign-up to first check-in</span></div>
        <div><b>₹49</b><span>To start your trial</span></div>
      </div>
    </header>

    <!-- ============ 01 GETTING STARTED ============ -->
    <section class="mod" id="getting-started">
      <div class="mod-eyebrow"><span class="dot"></span>01 · Getting Started</div>
      <h2>Signing up and paying for your trial</h2>
      <p class="mod-sub">There are two doors into Hai Visitor. Most people arrive through the public marketing site; some go straight to the registration form if they already have the link. Both end up in the same place.</p>
      <div class="mod-routes"><span class="route">/</span><span class="route">/register</span><span class="route">/subscription</span></div>

      <div class="panel">
        <ol class="steps">
          <li><b>Arrive at the public site</b> — either by visiting the landing page at <span class="field">/</span> and reading through the site, or by navigating <b>directly</b> to <span class="field">/register</span> if you already have that link (e.g. from a sales conversation). Both paths land on the same registration form.</li>
          <li>On the landing page, click <b>"Start 15-Day Trial for ₹49 →"</b> in the hero section (or the matching button in the pricing section). This takes you to <span class="field">/register</span>.</li>
          <li>Fill in <b>Company Information</b>: Company Name, Admin Email, Admin Phone (a fixed <span class="field">+91</span> prefix — enter the 10-digit number only), and optionally a WhatsApp URL (any <span class="field">wa.me</span> or <span class="field">whatsapp.com</span> link) if you already run a WhatsApp Business number for the team.</li>
          <li>Upload your <b>Company Logo</b> (JPG, PNG or WEBP, under 3MB) — required, since it appears on every visitor pass and registration page your visitors see.</li>
          <li>Set a <b>Password</b> (min. 8 characters, one uppercase letter, one number, one symbol — a live strength bar confirms it) and re-enter it to confirm.</li>
          <li>Click <b>"Register &amp; Continue."</b> Your account and company are created immediately, and you're logged in automatically.</li>
          <li>You land on <span class="field">/subscription</span> — a one-time plan-selection screen shown only while your account has no active plan yet. Toggle between <b>Monthly</b> and <b>Annual</b> pricing, then pick a card.</li>
          <li>Click <b>"Proceed to Payment"</b> on the Trial card (₹49, 15 days). A Razorpay checkout window opens in place — pay by card, UPI, or netbanking.</li>
          <li>On successful payment, the window closes and you're redirected to <span class="field">/home</span> — your dashboard, fully unlocked for the next 15 days.</li>
        </ol>

        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/</span></div>
            <div class="frame-body">
              <div class="mk mk-hero">
                <div class="mk-ticker">₹49 ONLY — 15-DAY TRIAL &nbsp;★&nbsp; NO HARDWARE NEEDED &nbsp;★&nbsp; GO LIVE IN 15 MINUTES</div>
                <div class="mk-nav">
                  <div class="mk-logo">H<em>ai</em> VISITOR</div>
                  <div class="mk-navlinks"><span>About</span><span>Features</span><span>Pricing</span><span>FAQ</span></div>
                </div>
                <div class="mk-h1">You spend money bringing customers in. <span>Don't let their data walk out.</span></div>
                <div class="mk-p">Hai Visitor connects the walk-ins generated by your marketing to an organised digital visitor database.</div>
                <div class="mk-btn mk-btn-primary">Start 15-Day Trial for ₹49 →</div>
              </div>
              <div class="mk-trust">
                <div><b>₹49</b><span>15-DAY TRIAL</span></div>
                <div><b>15 Min</b><span>SETUP TIME</span></div>
                <div><b>No Hardware</b><span>JUST A QR CODE</span></div>
                <div><b>AWS</b><span>CLOUD-HOSTED</span></div>
              </div>
            </div>
          </div>

          <div class="frame" style="margin-top:18px;">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/register</span></div>
            <div class="frame-body mk-page">
              <div class="mk mk-card">
                <div class="mk-card-title"><span class="mk-dot"></span> Company Information</div>
                <div class="mk-field"><span class="mk-label">Company Name *</span><div class="mk-input">Enter your company name</div></div>
                <div class="mk-row2">
                  <div class="mk-field"><span class="mk-label">Admin Email *</span><div class="mk-input">admin@company.com</div></div>
                  <div class="mk-field"><span class="mk-label">Admin Phone *</span><div class="mk-input filled">+91 &nbsp;98XXXXXXXX</div></div>
                </div>
                <div class="mk-card-title" style="margin-top:6px;"><span class="mk-dot green"></span> Company Logo</div>
                <div class="mk-upload">Click to upload company logo<br/>JPG, PNG or WEBP (Max 3MB)</div>
                <div class="mk-card-title" style="margin-top:10px;"><span class="mk-dot gold"></span> Security</div>
                <div class="mk-row2">
                  <div class="mk-field"><span class="mk-label">Password *</span><div class="mk-input filled">••••••••••</div>
                    <div class="mk-strength"><span class="on"></span><span class="on"></span><span class="on"></span><span></span></div>
                  </div>
                  <div class="mk-field"><span class="mk-label">Confirm Password *</span><div class="mk-input filled">••••••••••</div></div>
                </div>
                <div class="mk-submit">Register &amp; Continue</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="note tip">The Company Logo and a WhatsApp URL both feed real features later — the logo appears on visitor passes, and the WhatsApp URL becomes the "Chat with us" link shown to visitors.</div>

      <div style="margin-top:36px;">
        <div class="mod-eyebrow" style="margin-top:0;"><span class="dot"></span>Choosing a plan</div>
        <p class="mod-sub" style="max-width:60ch;">The <span class="route">/subscription</span> screen only ever appears once — the first time your account has no plan. After that, plan changes happen from <b>Plans &amp; Billing</b> inside the dashboard (see section 09).</p>
        <div class="frame" style="margin-top:20px; max-width:640px;">
          <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/subscription</span></div>
          <div class="frame-body mk-page">
            <div class="mk-plans">
              <div class="mk-plan mk">
                <h4>TRIAL</h4>
                <div class="p">₹49<span>/15 days</span></div>
                <ul><li>100 Visitor Bookings</li><li>2 Conference Rooms</li><li>Email Support</li></ul>
                <div class="btn">Proceed to Payment</div>
              </div>
              <div class="mk-plan pop mk">
                <div class="mk-plan-badge">MOST POPULAR</div>
                <h4>BUSINESS</h4>
                <div class="p">₹500<span>/mo</span></div>
                <ul><li>Unlimited Visitors</li><li>Custom Fields</li><li>Priority Support</li></ul>
                <div class="btn">Proceed to Payment</div>
              </div>
              <div class="mk-plan gold mk">
                <h4>ENTERPRISE</h4>
                <div class="p">₹1,000<span>/mo</span></div>
                <ul><li>Unlimited Visitors</li><li>Unlimited Bookings</li><li>Dedicated Support</li></ul>
                <div class="btn">Proceed to Payment</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 02 LOGIN ============ -->
    <section class="mod" id="login">
      <div class="mod-eyebrow"><span class="dot"></span>02 · Returning Users</div>
      <h2>Logging back in</h2>
      <p class="mod-sub">Once your company exists, every future visit starts here. Hai Visitor accepts either your email <b>or</b> phone number — no need to remember which one you registered with.</p>
      <div class="mod-routes"><span class="route">/login</span></div>

      <div class="panel">
        <ol class="steps">
          <li>Go to <span class="field">/login</span>. The left panel shows the Hai Visitor brand and three info tabs (<b>About</b>, <b>Plans</b>, <b>Contact</b>) — useful if you're evaluating the product before signing in.</li>
          <li>Enter your <b>Email or Phone Number</b> in the single identifier field.</li>
          <li>Enter your <b>Password</b>. A show/hide eye icon and a Caps Lock warning both appear as you type.</li>
          <li>Click <b>LOGIN</b>. Five failed attempts trigger a 30-second cooldown before you can try again — a safeguard against brute-force guessing, not a lockout of your account.</li>
          <li>Forgot your password? Use the <b>"Forgot Password?"</b> link, which walks you through emailing yourself a reset code.</li>
        </ol>

        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/login</span></div>
            <div class="frame-body">
              <div class="mk-split mk">
                <div class="mk-split-left">
                  <div class="navtabs"><span>ABOUT</span><span>PLANS</span><span>CONTACT</span></div>
                  <div class="center">
                    <div class="mk-mark">H</div>
                    <b>VISITOR MANAGEMENT PLATFORM</b>
                    <span>Streamline check-ins · Enhance security</span>
                  </div>
                </div>
                <div class="mk-split-right">
                  <div class="mk-login-title">LOGIN TO YOUR ACCOUNT</div>
                  <div class="mk-field"><span class="mk-label">Email or Phone Number</span><div class="mk-input">Enter your email or phone number</div></div>
                  <div class="mk-field"><span class="mk-label">Password</span><div class="mk-input filled">••••••••</div></div>
                  <div class="mk-submit" style="background:linear-gradient(135deg,#4A00A0,#8B2BE2);">LOGIN</div>
                  <div class="mk-login-links"><span>New Registration?</span><span>|</span><span>Forgot Password?</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="mod-sub" style="margin-top:30px;">What happens next depends entirely on your subscription's status — the login page silently routes you to the right place:</p>
      <table class="rtable">
        <tr><th>Account status</th><th>Where you land</th><th>Why</th></tr>
        <tr><td>pending</td><td>/subscription</td><td>No plan chosen yet — first login only</td></tr>
        <tr><td>trial / active</td><td>/home</td><td>Normal, unlocked dashboard</td></tr>
        <tr><td>grace_period</td><td>/home</td><td>Access continues; a renewal banner is shown</td></tr>
        <tr><td>expired</td><td>/home</td><td>Dashboard loads, but most modules show "Renew to unlock"</td></tr>
      </table>
    </section>

    <!-- ============ 03 HOME DASHBOARD ============ -->
    <section class="mod" id="dashboard">
      <div class="mod-eyebrow"><span class="dot"></span>03 · The Hub</div>
      <h2>Your home dashboard</h2>
      <p class="mod-sub">Everything else in this guide is reached from here. The hamburger icon top-left opens a slide-out menu that's your gateway to every module.</p>
      <div class="mod-routes"><span class="route">/home</span></div>

      <div class="panel">
        <ol class="steps">
          <li>The <b>header</b> shows your company name and logo, a hamburger menu button, and Logout.</li>
          <li>The main area shows a welcome banner and one card per module your plan includes — <b>Visitor Management</b> always; <b>Conference Booking</b> only on Enterprise.</li>
          <li>An <b>insight strip</b> surfaces useful one-line nudges (e.g. "12 visitors came through yesterday") — purely informational.</li>
          <li>Tap the <b>hamburger icon</b> to open the slide-out Menu — this is where Plans &amp; Billing, Reports, Employee Directory, Form Builder and My Account all live.</li>
          <li>If your subscription has lapsed, module cards show a lock icon and "Renew your plan to unlock this module" instead of their usual description — click through to <b>Plans &amp; Billing</b> to fix that.</li>
        </ol>

        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/home</span></div>
            <div class="frame-body mk-page">
              <div class="mk-dash-header" style="border-radius:10px 10px 0 0;">
                <div class="mk-hamburger"><span></span><span></span><span></span></div>
                <div class="co">Zodopt Technology Solutions</div>
                <div class="mk-logout">Logout</div>
              </div>
              <div class="mk-card" style="border-radius:0 0 10px 10px; border-top:none;">
                <div style="font-size:11px; font-weight:800; color:#1a0038;">Good afternoon 👋</div>
                <div class="mk-modgrid">
                  <div class="mk-modcard"><div class="ic"></div><b>Visitor Management</b><span>Check-ins, passes &amp; history</span></div>
                  <div class="mk-modcard"><div class="ic" style="background:var(--grad-amber);"></div><b>Conference Booking</b><span>Rooms &amp; meeting schedules</span></div>
                </div>
              </div>
            </div>
          </div>

          <div class="frame" style="margin-top:16px; max-width:300px;">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url" style="text-align:center;">Menu</span></div>
            <div class="frame-body" style="background:#8B2BE2; padding:0;">
              <div class="mk-drawer" style="border-radius:0;">
                <div class="mk-drawer-item"><div class="dicon"></div> Plans &amp; Billing</div>
                <div class="mk-drawer-item"><div class="dicon"></div> Reports &amp; Analytics</div>
                <div class="mk-drawer-item"><div class="dicon"></div> Employee Directory</div>
                <div class="mk-drawer-item"><div class="dicon"></div> Form Builder</div>
                <div class="mk-drawer-item"><div class="dicon"></div> User Guide</div>
                <div class="mk-drawer-item"><div class="dicon"></div> My Account</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 04 VISITOR MANAGEMENT ============ -->
    <section class="mod" id="visitors">
      <div class="mod-eyebrow"><span class="dot"></span>04 · Core Module</div>
      <h2>Visitor management, both sides</h2>
      <p class="mod-sub">This module has two halves: what <b>your team</b> sees on the dashboard, and what the <b>visitor</b> fills in on their own phone after scanning your QR code.</p>
      <div class="mod-routes"><span class="route">/visitor/dashboard</span><span class="route">/visitor/[company-slug]</span><span class="route">/v/pass</span></div>

      <h3 style="font-size:15px; font-weight:900; margin-top:34px; margin-bottom:6px;">Your side — the front-desk dashboard</h3>
      <div class="panel">
        <ol class="steps">
          <li>Open <b>Visitor Management</b> from the home dashboard. You'll see your unique <b>QR code</b> and registration link at the top — print the QR, or display it on a tablet at reception.</li>
          <li>Below it, a <b>live visitor list</b> updates automatically as people register, showing name, purpose, host, and a colour-coded status.</li>
          <li>When a visitor's meeting concludes, click <b>Check Out</b> next to their row — or let the system auto-check-out everyone at day's end.</li>
          <li>Click any row to see full visitor details, including their photo and ID proof if your Form Builder settings require it.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/visitor/dashboard</span></div>
            <div class="frame-body mk-page">
              <div class="mk-card" style="display:flex; gap:12px; align-items:center;">
                <div class="mk-qrbox"></div>
                <div>
                  <div style="font-size:9.5px; font-weight:800; color:#1a0038;">Your registration QR</div>
                  <div style="font-size:8px; color:#8578A8; font-weight:700; margin-top:2px;">haivisitor.zodopt.com/visitor/zodopt-tech</div>
                </div>
              </div>
              <div class="mk-card">
                <table class="mk-table mk">
                  <tr><th>Visitor</th><th>Purpose</th><th>Status</th></tr>
                  <tr><td><span class="mk-av" style="background:#221C53;">RH</span>Ramesh H.</td><td>Sofa Enquiry</td><td><span class="mk-badge accepted">Accepted</span></td></tr>
                  <tr><td><span class="mk-av" style="background:#0E7490;">VM</span>Vikram M.</td><td>Tiles</td><td><span class="mk-badge checkedin">Checked In</span></td></tr>
                  <tr><td><span class="mk-av" style="background:#9F1239;">MI</span>Mohan I.</td><td>Recliner</td><td><span class="mk-badge pending">Pending</span></td></tr>
                  <tr><td><span class="mk-av" style="background:#6D28D9;">SD</span>Sneha D.</td><td>Wardrobe</td><td><span class="mk-badge checkedout">Checked Out</span></td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 style="font-size:15px; font-weight:900; margin-top:36px; margin-bottom:6px;">Their side — the visitor's own phone</h3>
      <div class="panel">
        <ol class="steps">
          <li>The visitor <b>scans your QR code</b> or opens the registration link — no app, no login, no account needed.</li>
          <li><b>Step 1:</b> Name, Phone, and Email (if enabled in Form Builder).</li>
          <li><b>Step 2:</b> Purpose of Visit (a category/sub-category picker your team configures), Person to Meet (searchable by name or department), and any company/organisation fields you've turned on.</li>
          <li><b>Step 3:</b> ID Proof — type + number — and a live photo capture, both optional per your Form Builder settings.</li>
          <li>On submit, the person they're meeting gets an <b>instant WhatsApp message</b> with Accept / Decline buttons.</li>
          <li>The visitor receives their own <b>digital pass</b> — name, photo, and live status — that updates in real time as their visit progresses.</li>
          <li><b>Returning visitors:</b> if the same phone number has visited before, the OTP step is skipped entirely — they go straight to a pre-filled review screen.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/visitor/zodopt-tech</span></div>
            <div class="frame-body mk-page">
              <div class="mk-card">
                <div class="mk-steps-chip"><span class="on">Step 1</span><span>Step 2</span><span>Step 3</span></div>
                <div class="mk-field"><span class="mk-label">Full Name *</span><div class="mk-input">Enter your name</div></div>
                <div class="mk-row2">
                  <div class="mk-field"><span class="mk-label">Phone *</span><div class="mk-input filled">+91 98XXXXXXXX</div></div>
                  <div class="mk-field"><span class="mk-label">Email</span><div class="mk-input">you@email.com</div></div>
                </div>
                <div class="mk-label">Purpose of Visit</div>
                <div class="mk-purpose"><span class="sel">Sales Enquiry</span><span>Interview</span><span>Delivery</span><span>Other</span></div>
              </div>
              <div class="mk-card">
                <div class="mk-camera">📷 Tap to capture photo</div>
              </div>
            </div>
          </div>
          <div style="display:flex; gap:14px; margin-top:16px;">
            <div class="frame" style="flex:1;">
              <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">WhatsApp</span></div>
              <div class="frame-body mk-page" style="padding:14px;">
                <div class="mk-whatsapp mk">
                  <b>New Visitor Request</b><br/>Ramesh H. is here for "Sofa Enquiry" — meet now?
                  <div class="actions"><span class="accept">✓ Accept</span><span class="decline">✕ Decline</span></div>
                </div>
              </div>
            </div>
            <div class="frame" style="flex:1;">
              <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">/v/pass</span></div>
              <div class="frame-body mk-page" style="padding:14px;">
                <div class="mk-pass mk">
                  <div class="photo"></div>
                  <b>Ramesh H.</b><span>Sofa Enquiry · Host: Suresh</span>
                  <div class="qr"></div>
                  <span class="mk-badge accepted" style="background:rgba(255,255,255,0.2); color:#fff;">Accepted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="note info">Once a host accepts (or the visitor checks in), a <b>feedback message</b> goes out on WhatsApp roughly an hour later, asking for a quick 👍 Excellent / 😊 Good / 👎 Could Be Better rating — replying with a star also triggers their checkout.</div>
    </section>

    <!-- ============ 05 EMPLOYEE DIRECTORY ============ -->
    <section class="mod" id="employees">
      <div class="mod-eyebrow"><span class="dot"></span>05 · Staff Setup</div>
      <h2>Employee directory</h2>
      <p class="mod-sub">Before visitors can select who they're meeting, your team needs to exist in the system. This is also where you decide whether conference rooms are open to everyone or staff-only.</p>
      <div class="mod-routes"><span class="route">/visitor/admin</span></div>

      <div class="panel">
        <ol class="steps">
          <li>From the Menu, open <b>Employee Directory</b>.</li>
          <li>Click <b>Add Employee</b> and fill in Name, Email, Phone, and Department — this is exactly who visitors will be able to search for as "Person to Meet."</li>
          <li>Got a whole team to add at once? Click <b>Bulk Upload</b> and drop in an Excel file — errors on individual rows are flagged before anything is saved.</li>
          <li>Use the <b>search bar</b> and the <b>Active / Inactive</b> filter to find anyone quickly; mark someone Inactive when they leave rather than deleting them, to preserve their visit history.</li>
          <li>Flip <b>"Restrict conference booking to employees only"</b> if you don't want the public booking link open to anyone with the URL.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/visitor/admin</span></div>
            <div class="frame-body mk-page">
              <div class="mk-card" style="display:flex; justify-content:space-between; align-items:center;">
                <div class="mk-input" style="width:130px;">Search employees…</div>
                <div style="display:flex; gap:6px;">
                  <div class="mk-btn" style="background:#ede8f8; color:#6200d6; padding:6px 12px; font-size:9px;">Bulk Upload</div>
                  <div class="mk-btn" style="background:#6200d6; color:#fff; padding:6px 12px; font-size:9px;">+ Add Employee</div>
                </div>
              </div>
              <div class="mk-card">
                <table class="mk-table mk">
                  <tr><th>Name</th><th>Department</th><th>Status</th></tr>
                  <tr><td><span class="mk-av" style="background:#4A00A0;">SR</span>Suresh R.</td><td>Sales</td><td><span class="mk-badge accepted">Active</span></td></tr>
                  <tr><td><span class="mk-av" style="background:#D97706;">DK</span>Divya K.</td><td>Design</td><td><span class="mk-badge accepted">Active</span></td></tr>
                  <tr><td><span class="mk-av" style="background:#6b7280;">AM</span>Arjun M.</td><td>Sales</td><td><span class="mk-badge auto">Inactive</span></td></tr>
                </table>
              </div>
              <div class="mk-toggle mk">
                <div class="l">Restrict conference booking to employees only<small>Public booking link stays open when off</small></div>
                <div class="mk-switch"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 06 CONFERENCE ROOMS ============ -->
    <section class="mod" id="conference">
      <div class="mod-eyebrow"><span class="dot"></span>06 · Enterprise Feature</div>
      <h2>Conference room booking</h2>
      <p class="mod-sub">Available on the Enterprise plan. Rooms are set up once by your team, then bookable by anyone with the link (or employees-only, per the toggle above).</p>
      <div class="mod-routes"><span class="route">/conference/dashboard</span><span class="route">/conference/book</span><span class="route">/conference/bookings</span></div>

      <div class="panel">
        <ol class="steps">
          <li>From the home dashboard, open <b>Conference Booking</b> → <b>Manage Rooms</b> to add each room with a name, photo, and capacity.</li>
          <li>Share your booking link — anyone with it (or logged-in employees, if restricted) can reach <span class="field">/conference/book</span>.</li>
          <li>The booker picks a <b>room card</b>, then a date and a 15-minute time slot from the day's availability grid.</li>
          <li>They fill in their name, phone, and meeting purpose, then confirm — the room's calendar updates instantly.</li>
          <li>Your team reviews and manages every booking from <span class="field">/conference/bookings</span>, with the option to cancel or reassign a room.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/conference/book</span></div>
            <div class="frame-body mk-page">
              <div class="mk-card">
                <div class="mk-card-title"><span class="mk-dot"></span> Choose a room</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                  <div class="mk-room mk"><div class="img"></div><div class="b"><b>Boardroom A</b><span>Capacity: 10</span></div></div>
                  <div class="mk-room mk"><div class="img"></div><div class="b"><b>Huddle Room</b><span>Capacity: 4</span></div></div>
                </div>
                <div class="mk-label" style="margin-top:12px;">Today's availability</div>
                <div class="mk-slots">
                  <span>9:00 AM</span><span>9:15 AM</span><span class="taken">9:30 AM</span><span>9:45 AM</span><span class="taken">10:00 AM</span><span>10:15 AM</span><span>10:30 AM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 07 REPORTS ============ -->
    <section class="mod" id="reports">
      <div class="mod-eyebrow"><span class="dot"></span>07 · Insight</div>
      <h2>Reports &amp; analytics</h2>
      <p class="mod-sub">Every visit and booking rolls up here — filterable by period, exportable, and broken down by status so you can spot patterns without digging through raw lists.</p>
      <div class="mod-routes"><span class="route">/home/reports</span></div>

      <div class="panel">
        <ol class="steps">
          <li>Open <b>Reports &amp; Analytics</b> from the Menu.</li>
          <li>Pick a period along the top — <b>Today, Week, Month, Quarter, Year</b> — every chart and figure below updates instantly.</li>
          <li>The <b>KPI cards</b> show totals with a percentage change against the previous equal period, so you know at a glance if footfall is up or down.</li>
          <li>A day-of-week chart highlights your busiest days; a status breakdown shows the accepted/declined/checked-out split.</li>
          <li>Click <b>Export</b> to download the underlying data as CSV, for anything you want to analyse further outside the app.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/home/reports</span></div>
            <div class="frame-body mk-page">
              <div class="mk-pill-row" style="margin-bottom:10px;">
                <span class="mk-pill">Today</span><span class="mk-pill on">Week</span><span class="mk-pill">Month</span><span class="mk-pill">Quarter</span><span class="mk-pill">Year</span>
              </div>
              <div class="mk-kpi">
                <div class="mk-kpicard"><b>184</b><span>Total Visitors</span></div>
                <div class="mk-kpicard"><b>92%</b><span>Accept Rate</span></div>
                <div class="mk-kpicard"><b>26m</b><span>Avg. Duration</span></div>
              </div>
              <div class="mk-card">
                <div class="mk-card-title"><span class="mk-dot"></span> Visitors by day</div>
                <div class="mk-chart mk">
                  <div style="height:40%;"></div><div style="height:70%;"></div><div style="height:55%;"></div><div style="height:90%;"></div><div style="height:65%;"></div><div style="height:100%;"></div><div style="height:30%;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 08 FORM BUILDER ============ -->
    <section class="mod" id="form-builder">
      <div class="mod-eyebrow"><span class="dot"></span>08 · Customisation</div>
      <h2>Form builder</h2>
      <p class="mod-sub">Every field a visitor fills in — beyond the basics of name and phone — can be turned on or off here, and the "Purpose of Visit" list is entirely yours to define.</p>
      <div class="mod-routes"><span class="route">/home/form-builder</span></div>

      <div class="panel">
        <ol class="steps">
          <li>Open <b>Form Builder</b> from the Menu — three tabs sit along the top.</li>
          <li><b>Field Toggles:</b> every optional field (Email, From Company, Department, Address, ID Proof, Belongings Checklist, etc.) is a switch, tagged by which registration step it appears on.</li>
          <li><b>Purpose of Visit:</b> build your own category list (up to 10) with optional sub-categories (up to 10 each) — e.g. "Sales Enquiry → Sofa / Modular Kitchen / Tiles."</li>
          <li><b>Custom Fields:</b> add up to 5 fully custom fields (Text, Number, or Dropdown with up to 20 options) for anything specific to your business the built-in fields don't cover.</li>
          <li>Changes save immediately and apply to the very next visitor registration — no publish step.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/home/form-builder</span></div>
            <div class="frame-body mk-page">
              <div class="mk-pill-row" style="margin-bottom:10px;">
                <span class="mk-pill on">Field Toggles</span><span class="mk-pill">Purpose of Visit</span><span class="mk-pill">Custom Fields</span>
              </div>
              <div class="mk-toggle mk"><div class="l">Email Address<small>Step 1</small></div><div class="mk-switch on"></div></div>
              <div class="mk-toggle mk"><div class="l">Person to Meet<small>Step 2 · disables approval WhatsApp too</small></div><div class="mk-switch on"></div></div>
              <div class="mk-toggle mk"><div class="l">ID Proof<small>Step 3 · type + number</small></div><div class="mk-switch"></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 09 PLANS & BILLING ============ -->
    <section class="mod" id="billing">
      <div class="mod-eyebrow"><span class="dot"></span>09 · Subscription</div>
      <h2>Plans &amp; billing</h2>
      <p class="mod-sub">Every plan action — renewing, upgrading, switching billing cycle, or cancelling — lives on one dedicated page, reachable even when your subscription has lapsed.</p>
      <div class="mod-routes"><span class="route">/home/plans</span></div>

      <div class="panel">
        <ol class="steps">
          <li>Open <b>Plans &amp; Billing</b> from the Menu — always reachable, even on an expired account.</li>
          <li>The top pill shows your <b>current plan</b> and its live status (Active, Trial, Grace Period, Expired).</li>
          <li>Below, plan+billing-cycle cards are laid out separately — e.g. <b>Business Monthly</b> and <b>Business Annual</b> as distinct cards, not a toggle — the one matching what you're already on carries a green <b>"Current Plan"</b> badge.</li>
          <li>If auto-debit is live, you'll see an "Auto-renews on [date]" note instead of a Renew button — nothing to click, your card/UPI mandate handles it.</li>
          <li>Click a card's button to <b>upgrade</b>, <b>renew</b>, or (once your plan has lapsed) <b>switch down</b> a tier.</li>
          <li><b>Cancel Subscription</b> sits at the bottom for Business/Enterprise plans — stops future charges, while access continues until your paid-through date.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/home/plans</span></div>
            <div class="frame-body mk-page">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="mk-plan mk" style="position:relative;">
                  <div class="mk-current-badge">Current Plan</div>
                  <h4>BUSINESS</h4><span style="font-size:7.5px; font-weight:800; color:#8578A8; text-transform:uppercase;">Monthly</span>
                  <div class="p" style="margin-top:4px;">₹500<span>+GST/mo</span></div>
                  <div class="btn" style="background:#e5ddf5; color:#6200d6;">Renew Business</div>
                </div>
                <div class="mk-plan mk">
                  <h4>BUSINESS</h4><span style="font-size:7.5px; font-weight:800; color:#8578A8; text-transform:uppercase;">Annual</span>
                  <div class="p" style="margin-top:4px;">₹5,500<span>+GST/yr</span></div>
                  <div class="btn">Switch to Annual</div>
                </div>
                <div class="mk-plan gold mk">
                  <h4>ENTERPRISE</h4><span style="font-size:7.5px; font-weight:800; color:#8578A8; text-transform:uppercase;">Monthly</span>
                  <div class="p" style="margin-top:4px;">₹1,000<span>+GST/mo</span></div>
                  <div class="btn">Upgrade to Enterprise</div>
                </div>
                <div class="mk-plan gold mk">
                  <h4>ENTERPRISE</h4><span style="font-size:7.5px; font-weight:800; color:#8578A8; text-transform:uppercase;">Annual</span>
                  <div class="p" style="margin-top:4px;">₹10,000<span>+GST/yr</span></div>
                  <div class="btn">Upgrade to Enterprise</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 10 SETTINGS ============ -->
    <section class="mod" id="settings">
      <div class="mod-eyebrow"><span class="dot"></span>10 · Housekeeping</div>
      <h2>Account settings</h2>
      <p class="mod-sub">Your company profile, logo, and your own login details all live under My Account.</p>
      <div class="mod-routes"><span class="route">/home/settings</span></div>

      <div class="panel">
        <ol class="steps">
          <li>Open <b>My Account</b> from the Menu.</li>
          <li>Edit your <b>Company Name</b>, upload a new <b>Logo</b>, and update the <b>WhatsApp URL</b> shown to visitors — each field saves independently, no single "Save all" step.</li>
          <li>Set a custom <b>Visitor Code Prefix</b> (used on every visitor's ID, e.g. <span class="field">CMP16-...</span>) — confirm carefully, since changing it affects all future codes.</li>
          <li>Update your own <b>Name, Phone</b>, or <b>Password</b> under the User Profile section.</li>
        </ol>
        <div>
          <div class="frame">
            <div class="frame-bar"><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-dot"></span><span class="frame-url">haivisitor.zodopt.com/home/settings</span></div>
            <div class="frame-body mk-page">
              <div class="mk-card">
                <div class="mk-card-title"><span class="mk-dot"></span> Company Profile</div>
                <div class="mk-field"><span class="mk-label">Company Name</span><div class="mk-input filled">Zodopt Technology Solutions</div></div>
                <div class="mk-field"><span class="mk-label">WhatsApp URL</span><div class="mk-input filled">wa.me/9198XXXXXXXX</div></div>
              </div>
              <div class="mk-card">
                <div class="mk-card-title"><span class="mk-dot gold"></span> User Profile</div>
                <div class="mk-row2">
                  <div class="mk-field"><span class="mk-label">Name</span><div class="mk-input filled">Admin User</div></div>
                  <div class="mk-field"><span class="mk-label">Phone</span><div class="mk-input filled">+91 98XXXXXXXX</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 11 APPENDIX ============ -->
    <section class="mod" id="appendix">
      <div class="mod-eyebrow"><span class="dot"></span>11 · Reference</div>
      <h2>Status glossary</h2>
      <p class="mod-sub">Every colour-coded badge you'll see across the visitor list, dashboard and reports, explained.</p>

      <div class="glossary">
        <div class="g-item"><div class="top"><span class="mk-badge pending">Pending</span></div><p>Registered, waiting on their host to accept.</p></div>
        <div class="g-item"><div class="top"><span class="mk-badge accepted">Accepted</span></div><p>Host approved the visit — visitor is on their way in.</p></div>
        <div class="g-item"><div class="top"><span class="mk-badge declined">Declined</span></div><p>Host declined the meeting request.</p></div>
        <div class="g-item"><div class="top"><span class="mk-badge checkedin">Checked In</span></div><p>Visitor has arrived and is currently on-site.</p></div>
        <div class="g-item"><div class="top"><span class="mk-badge checkedout">Checked Out</span></div><p>Visit complete — checked out manually or via feedback reply.</p></div>
        <div class="g-item"><div class="top"><span class="mk-badge auto">Auto Checked Out</span></div><p>Automatically closed out at day's end if never manually checked out.</p></div>
      </div>

      <div class="contact-card">
        <div class="contact-item"><b>Email</b><span>admin@haivisitor.zodopt.com</span></div>
        <div class="contact-item"><b>Phone</b><span>+91 8647878785</span></div>
        <div class="contact-item"><b>Support Hours</b><span>Mon–Fri, 9AM–6PM IST</span></div>
      </div>
    </section>

    <footer class="guide-footer">Hai Visitor — a visitor management platform by Zodopt. This guide mirrors the live product; screens may evolve as features ship.</footer>

  </main>
</div>
</div>
`;

export default function GuidePage() {
  return <div dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
