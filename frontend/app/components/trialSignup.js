/* Trial signup popup (embedded Razorpay Checkout), shared by the main
   landing page and the industry landing pages (/jewellery). Both inject
   TRIAL_MODAL_HTML into their markup and call initTrialSignup() from an
   effect, so the popup, its validation and the payment flow can't drift
   apart between pages. Any element with the `trial-cta` class opens it. */

export const TRIAL_MODAL_HTML = `
<div class="trial-modal-backdrop" id="trialModalBackdrop">
  <div class="trial-modal" role="dialog" aria-modal="true" aria-labelledby="trialModalTitle">
    <button type="button" class="trial-modal-close" id="trialModalClose" aria-label="Close">&times;</button>
    <div class="trial-modal-top">
      <img src="/haiv-full-logo.png" alt="Hai Visitor" class="trial-modal-logo" />
      <div class="trial-modal-wordmark">H<span>ai</span> Visitor</div>
      <div class="trial-modal-pill">15-Day Trial &middot; &#8377;49</div>
    </div>
    <div id="trialFormView">
      <h3 id="trialModalTitle">Start Your 15-Day Trial</h3>
      <p class="trial-modal-sub">Enter your email and phone number — payment happens right here, next step.</p>
      <form id="trialForm" novalidate>
        <div class="trial-field">
          <label for="trialEmail">Email <span class="trial-field-req">*</span></label>
          <input type="email" id="trialEmail" name="email" placeholder="you@company.com" autocomplete="email" />
          <span class="trial-field-err" id="trialEmailErr"></span>
        </div>
        <div class="trial-field">
          <label for="trialPhone">Phone Number <span class="trial-field-req">*</span></label>
          <input type="tel" id="trialPhone" name="phone" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" autocomplete="tel" />
          <span class="trial-field-err" id="trialPhoneErr"></span>
        </div>
        <div class="trial-modal-err" id="trialFormErr"></div>
        <button type="submit" class="btn btn-primary trial-modal-submit" id="trialSubmitBtn">Pay ₹49 & Start Trial →</button>
      </form>
    </div>
    <div id="trialSuccessView" class="trial-success" style="display:none;">
      <div class="trial-success-icon">✓</div>
      <h3>Account Created</h3>
      <p>Check your email for your login details.</p>
      <a class="btn btn-primary trial-modal-submit" href="/login">Sign in now →</a>
    </div>
    <div id="trialExistingView" class="trial-success" style="display:none;">
      <h3>Already Registered</h3>
      <p>This email or phone number already has a Hai Visitor account.</p>
      <a class="btn btn-primary trial-modal-submit" href="/login">Sign in now →</a>
    </div>
  </div>
</div>
`;

const META_PIXEL_ID = '1981723482403279';

// Must never fire real ad-conversion events from staging test traffic —
// same staging check as layout.js's GA/robots gating (NEXT_PUBLIC_SITE_URL
// already differs per deployment).
const IS_STAGING = (process.env.NEXT_PUBLIC_SITE_URL || '').includes('staging');

// Meta Pixel — landing pages only (not loaded on any other route). Standard
// client-side pixel, firing on the browser's own confirmation of events —
// same trust model as the snippet Meta's Events Manager hands out. Loaded
// once per mount; guarded against being injected twice (e.g. React 18
// strict-mode double-invoking effects in dev).
export const loadMetaPixel = () => {
  if (IS_STAGING || window.fbq) return;
  const n = window.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  n('init', META_PIXEL_ID);
  n('track', 'PageView');
};

/* Wires up the popup already in the DOM. `landing` tags the Razorpay order
   with the page the signup came from (e.g. 'jewellery'); the main landing
   page leaves it out. Returns a cleanup function for the effect. */
export const initTrialSignup = ({ landing } = {}) => {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'https://www.promeet.zodopt.in';

  // Razorpay's checkout.js can't run if injected via innerHTML, so it's
  // loaded once here instead of as a <script> tag in the markup.
  let razorpayScript = document.getElementById('razorpay-checkout-js');
  if (!razorpayScript) {
    razorpayScript = document.createElement('script');
    razorpayScript.id = 'razorpay-checkout-js';
    razorpayScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.head.appendChild(razorpayScript);
  }

  const backdrop    = document.getElementById('trialModalBackdrop');
  const closeBtn     = document.getElementById('trialModalClose');
  const formView      = document.getElementById('trialFormView');
  const successView   = document.getElementById('trialSuccessView');
  const existingView  = document.getElementById('trialExistingView');
  const form          = document.getElementById('trialForm');
  const emailInput    = document.getElementById('trialEmail');
  const phoneInput    = document.getElementById('trialPhone');
  const emailErr       = document.getElementById('trialEmailErr');
  const phoneErr       = document.getElementById('trialPhoneErr');
  const formErr        = document.getElementById('trialFormErr');
  const submitBtn      = document.getElementById('trialSubmitBtn');

  const clearErrors = () => {
    [emailErr, phoneErr, formErr].forEach(el => { if (el) el.textContent = ''; });
    [emailInput, phoneInput].forEach(el => el?.classList.remove('err'));
  };

  const resetToForm = () => {
    clearErrors();
    form?.reset();
    if (formView) formView.style.display = '';
    if (successView) successView.style.display = 'none';
    if (existingView) existingView.style.display = 'none';
  };

  const openModal = () => {
    resetToForm();
    backdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
    emailInput?.focus();
  };

  const closeModal = () => {
    backdrop?.classList.remove('open');
    document.body.style.overflow = '';
  };

  const ctaLinks = document.querySelectorAll('.trial-cta');
  const onCtaClick = (e) => { e.preventDefault(); openModal(); };
  ctaLinks.forEach(a => a.addEventListener('click', onCtaClick));

  closeBtn?.addEventListener('click', closeModal);
  const onBackdropClick = (e) => { if (e.target === backdrop) closeModal(); };
  backdrop?.addEventListener('click', onBackdropClick);

  // Disposable/throwaway domains and obviously-fake local@domain patterns
  // (test@test.com, asdf@asdf.com) rejected up front — a strict format
  // check alone lets those through.
  const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com',
    'guerrillamail.com', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
    'throwaway.email', 'getnada.com', 'dispostable.com', 'sharklasers.com',
    'test.com', 'example.com', 'sample.com', 'fake.com', 'none.com',
  ]);
  const FAKE_LOCAL_PARTS = new Set(['test', 'asdf', 'abc', 'xyz', 'admin', 'user', 'sample', 'fake', 'demo']);

  const validateEmailField = (showError) => {
    const email = emailInput.value.trim();
    // RFC-5322-ish practical check: no consecutive dots, valid TLD length.
    const shapeOk = /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email)
      && !email.includes('..');

    let reason = '';
    if (!email) reason = '';
    else if (!shapeOk) reason = 'Enter a valid email address';
    else {
      const [local, domain] = email.toLowerCase().split('@');
      if (DISPOSABLE_DOMAINS.has(domain)) reason = 'Please use a permanent, work or personal email address';
      else if (FAKE_LOCAL_PARTS.has(local) && local === domain.split('.')[0]) reason = 'Enter a valid email address';
    }

    if (showError) {
      emailErr.textContent = reason;
      emailInput.classList.toggle('err', !!reason);
    }
    return !reason && !!email;
  };

  const validatePhoneField = (showError) => {
    const phone = phoneInput.value.trim();
    let reason = '';
    if (phone && phone.length < 10) reason = ''; // still typing — no error yet
    else if (!/^[6-9]\d{9}$/.test(phone)) reason = 'Enter a valid 10-digit phone number';

    if (showError) {
      phoneErr.textContent = reason;
      phoneInput.classList.toggle('err', !!reason);
    }
    return !reason && phone.length === 10;
  };

  // Live validation: phone as-you-type (digits only, error once 10 typed),
  // email on blur (checking every keystroke on an email is just noise).
  const onPhoneInput = () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    validatePhoneField(phoneInput.value.length === 10);
    if (phoneInput.value.length < 10) { phoneErr.textContent = ''; phoneInput.classList.remove('err'); }
  };
  const onEmailBlur = () => validateEmailField(true);
  phoneInput?.addEventListener('input', onPhoneInput);
  emailInput?.addEventListener('blur', onEmailBlur);

  const validate = () => {
    clearErrors();
    const emailOk = validateEmailField(true);
    const phoneOk = validatePhoneField(true);
    return emailOk && phoneOk;
  };

  const resetSubmitBtn = () => {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pay ₹49 & Start Trial →';
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    try {
      const res = await fetch(`${API_BASE}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          phone: phoneInput.value.trim(),
          ...(landing ? { landing } : {}),
        }),
      });
      const data = await res.json();

      if (data?.code === 'already_registered') {
        if (formView) formView.style.display = 'none';
        if (existingView) existingView.style.display = '';
        resetSubmitBtn();
        return;
      }

      if (!res.ok || !window.Razorpay) {
        formErr.textContent = data?.message || 'Something went wrong. Please try again.';
        resetSubmitBtn();
        return;
      }

      // Order created — real purchase intent (email/phone validated, about
      // to see the Razorpay checkout), distinct from the Purchase event
      // fired only once payment actually completes below.
      window.fbq?.('track', 'Lead');

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: 'Hai Visitor',
        description: '15-Day Trial',
        prefill: { email: emailInput.value.trim(), contact: phoneInput.value.trim() },
        handler: () => {
          if (formView) formView.style.display = 'none';
          if (successView) successView.style.display = '';
          window.fbq?.('track', 'Purchase', {
            value: (data.amount || 4900) / 100,
            currency: data.currency || 'INR',
          });
        },
        modal: {
          ondismiss: () => { resetSubmitBtn(); },
        },
      });
      rzp.on('payment.failed', () => {
        formErr.textContent = 'Payment failed. Please try again.';
        resetSubmitBtn();
      });
      rzp.open();
      resetSubmitBtn();
    } catch (err) {
      console.error('TRIAL SIGNUP ERROR:', err);
      formErr.textContent = 'Unable to connect to server. Please try again.';
      resetSubmitBtn();
    }
  };
  form?.addEventListener('submit', onSubmit);

  return () => {
    ctaLinks.forEach(a => a.removeEventListener('click', onCtaClick));
    closeBtn?.removeEventListener('click', closeModal);
    backdrop?.removeEventListener('click', onBackdropClick);
    phoneInput?.removeEventListener('input', onPhoneInput);
    emailInput?.removeEventListener('blur', onEmailBlur);
    form?.removeEventListener('submit', onSubmit);
    document.body.style.overflow = '';
  };
};
