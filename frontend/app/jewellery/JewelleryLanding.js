'use client';
import { useEffect } from 'react';
import { TRIAL_MODAL_HTML, initTrialSignup, loadMetaPixel } from '../components/trialSignup';
import '../components/industry-tailwind.css';
import './design.css';
import '../components/industry-landing.css';
import './jewellery.css';

/* Jewellery landing page. The markup is the design export
   (hai-visitor-website/index.html) with the site's logo, the shared trial
   popup, the offer ticker and the WhatsApp button added. Every "Start trial"
   button carries `trial-cta`, which opens the same popup as the main landing
   page; signups from here are tagged 'jewellery'. */

const WHATSAPP_URL =
  'https://wa.me/916366834745?text=' +
  encodeURIComponent('Hi, I run a jewellery showroom and want to know more about Hai Visitor');

const TICKER_ITEMS = [
  '₹49 ONLY — 15-DAY TRIAL', 'NO HARDWARE NEEDED', 'GO LIVE IN 15 MINUTES',
  'INSTANT WHATSAPP ALERTS', 'BUILD YOUR CUSTOMER DATABASE',
];
// Listed twice so the track can loop seamlessly at -50%.
const TICKER_HTML = [...TICKER_ITEMS, ...TICKER_ITEMS]
  .map((t) => `<span>${t}</span><span>★</span>`)
  .join('');

const BODY_HTML = `
<!-- OFFER TICKER (fixed top) -->
<div class="offer-ticker"><div class="ot-track">${TICKER_HTML}</div></div>

<main id="top" class="min-h-screen overflow-hidden bg-background text-foreground">
    <a href="#content"
        class="fixed left-3 top-3 z-[70] -translate-y-24 bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0">Skip
        to main content</a>

    <!-- Header: fixed, medium height -->
    <header class="hv-header">
        <nav class="section-shell flex items-center justify-between" aria-label="Main navigation">
            <a href="#top" class="brand-lockup text-paper" aria-label="Hai Visitor home"><span
                    class="brand-lockup__emblem hv-logo" aria-hidden="true"><img src="/v-mark.png" alt=""
                        width="64" height="64" /></span><span
                    class="brand-lockup__name">H<span>ai</span> Visitor</span></a>
            <button type="button" class="hv-btn hv-btn--gold hv-btn--sm trial-cta">Start trial</button>
        </nav>
    </header>

    <!-- Hero -->
    <section id="content" class="hv-hero">
        <div class="section-shell hv-hero__grid">
            <div class="hv-hero__copy animate-rise">
                <p class="hv-kicker text-xs text-primary">VIBE · Visit. Interact. Build. Engage.</p>
                <h1 class="mt-5">Every visit is worth <em>remembering.</em></h1>
                <p class="mt-5 max-w-xl text-lg leading-8 text-paper/75">Register in-store walk-ins, alert the right
                    team member and keep visitor records ready for your next conversation.</p>
                <div class="mt-7">
                    <button type="button" class="hv-btn hv-btn--gold trial-cta">Start 15-day trial @ ₹49</button>
                </div>
                <p class="mt-4 text-xs text-paper/55">15-day paid trial · 100 visitor bookings included</p>
            </div>
            <div class="hv-hero__media">
                <img src="/jewellery/hero.jpg"
                    alt="An Indian customer trying earrings with a showroom associate in a jewellery showroom"
                    width="1920" height="1088" />
            </div>
        </div>
    </section>

    <!-- Capture / Connect / Engage -->
    <section id="how-it-works" class="bg-paper py-20">
        <div class="section-shell">
            <div class="max-w-3xl">
                <p class="text-xs uppercase text-primary">The VIBE approach</p>
                <h2 class="mt-4 text-5xl">From first visit to a better next conversation.</h2>
                <p class="mt-7 max-w-2xl leading-7 text-muted-foreground">A simple in-store process makes visitor
                    details available to the people serving them, while every later conversation remains personal
                    and permission-led.</p>
            </div>
            <div class="mt-14 grid gap-4 md:grid-cols-3">
                <article class="journey-card group journey-card--capture hv-c hv-c-gold">
                    <div class="flex items-start justify-between">
                        <span class="hv-tag-inline text-xs font-semibold tracking-[0.2em]">01 / CAPTURE</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round" class="size-7" aria-hidden="true">
                            <rect width="5" height="5" x="3" y="3" rx="1"></rect>
                            <rect width="5" height="5" x="16" y="3" rx="1"></rect>
                            <rect width="5" height="5" x="3" y="16" rx="1"></rect>
                            <path d="M21 16h-3a2 2 0 0 0-2 2v3"></path>
                            <path d="M21 21v.01"></path>
                            <path d="M12 7v3a2 2 0 0 1-2 2H7"></path>
                            <path d="M3 12h.01"></path>
                            <path d="M12 3h.01"></path>
                            <path d="M12 16v.01"></path>
                            <path d="M16 12h1"></path>
                            <path d="M21 12v.01"></path>
                            <path d="M12 21v-1"></path>
                        </svg>
                    </div>
                    <h3>Register the visit.</h3>
                    <p class="mt-3 text-sm leading-6">A customer scans the showroom’s QR and enters their details.
                    </p>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-5 transition-transform duration-300 group-hover:translate-x-2"
                        aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </article>
                <article class="journey-card group journey-card--connect hv-c hv-c-peach">
                    <div class="flex items-start justify-between">
                        <span class="text-xs font-semibold tracking-[0.2em]">02 / CONNECT</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round" class="size-7" aria-hidden="true">
                            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                            <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
                            <path d="M3 12A9 3 0 0 0 21 12"></path>
                        </svg>
                    </div>
                    <h3>Keep the record.</h3>
                    <p class="mt-3 text-sm leading-6">Saved visitor details stay available to the team for a better
                        next conversation.</p>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-5 transition-transform duration-300 group-hover:translate-x-2"
                        aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </article>
                <article class="journey-card group journey-card--engage hv-c hv-c-sage">
                    <div class="flex items-start justify-between">
                        <span class="text-xs font-semibold tracking-[0.2em]">03 / ENGAGE</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                            stroke-linejoin="round" class="size-7" aria-hidden="true">
                            <path
                                d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719">
                            </path>
                        </svg>
                    </div>
                    <h3>Brand WhatsApp opt-in.</h3>
                    <p class="mt-3 text-sm leading-6">Visitors choose whether your authorised team can reconnect
                        through your brand’s WhatsApp channel.</p>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-5 transition-transform duration-300 group-hover:translate-x-2"
                        aria-hidden="true">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </article>
            </div>
        </div>
    </section>

    <!-- Industries -->
    <section class="hv-industries py-20">
        <div class="section-shell">
            <div class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                    <p class="text-xs uppercase" style="color:var(--hv-gold-text)">The first interaction matters</p>
                    <h2 class="mt-4 max-w-2xl text-4xl lg:text-5xl">Built for considered showroom visits.</h2>
                </div>
                <p class="max-w-md text-sm leading-6 text-muted-foreground">The QR belongs inside your showroom.
                    Your team stays part of the experience.</p>
            </div>
            <div class="hv-grid">
                <article class="industry-card industry-card--fashion hv-c hv-c-rose">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-7" aria-hidden="true">
                        <path
                            d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z">
                        </path>
                    </svg>
                    <div>
                        <h3 class="text-lg">Fashion</h3>
                        <p class="mt-2 text-xs leading-5">Personal attention, remembered.</p>
                    </div>
                </article>
                <article class="industry-card industry-card--jewellery">
                    <span class="hv-tag">Featured</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-7" aria-hidden="true">
                        <path d="M10.5 3 8 9l4 13 4-13-2.5-6"></path>
                        <path
                            d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z">
                        </path>
                        <path d="M2 9h20"></path>
                    </svg>
                    <div>
                        <h3>Jewellery</h3>
                        <p class="mt-2 text-xs leading-5">Considered visits, thoughtfully recorded.</p>
                    </div>
                </article>
                <article class="industry-card industry-card--automobile hv-c hv-c-sky">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-7" aria-hidden="true">
                        <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"></path>
                        <path d="M7 14h.01"></path>
                        <path d="M17 14h.01"></path>
                        <rect width="18" height="8" x="3" y="10" rx="2"></rect>
                        <path d="M5 18v2"></path>
                        <path d="M19 18v2"></path>
                    </svg>
                    <div>
                        <h3 class="text-lg">Premium automobile</h3>
                        <p class="mt-2 text-xs leading-5">Every showroom conversation in view.</p>
                    </div>
                </article>
                <article class="industry-card industry-card--interiors hv-c hv-c-sage">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="size-7" aria-hidden="true">
                        <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"></path>
                        <path
                            d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z">
                        </path>
                        <path d="M4 18v2"></path>
                        <path d="M20 18v2"></path>
                        <path d="M12 4v9"></path>
                    </svg>
                    <div>
                        <h3 class="text-lg">Home &amp; interiors</h3>
                        <p class="mt-2 text-xs leading-5">Longer journeys, easier continuity.</p>
                    </div>
                </article>
            </div>
        </div>
    </section>

    <!-- Walkthrough -->
    <section id="walkthrough" class="bg-ink py-20 text-paper">
        <div class="section-shell">
            <div class="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                    <p class="text-xs uppercase text-primary">A look inside the visit</p>
                    <h2 class="mt-4 text-5xl">Four steps. One clear process.</h2>
                </div>
                <p class="max-w-md text-sm leading-6 text-paper/65">Explore the in-store journey. The screens shown
                    are an illustrative workflow, with dummy data only.</p>
            </div>
            <div role="tablist" aria-label="Visitor journey"
                class="grid grid-cols-2 border border-paper/20 sm:grid-cols-4">
                <button role="tab" data-tab-index="0" aria-selected="true"
                    class="min-h-20 border-r border-paper/20 px-4 text-left text-sm transition-colors last:border-r-0 bg-primary text-primary-foreground"><span
                        class="block text-xs opacity-60">01</span>Scan in-store</button>
                <button role="tab" data-tab-index="1" aria-selected="false"
                    class="min-h-20 border-r border-paper/20 px-4 text-left text-sm transition-colors last:border-r-0 bg-ink text-paper/65 hover:bg-paper hover:text-ink"><span
                        class="block text-xs opacity-60">02</span>Register</button>
                <button role="tab" data-tab-index="2" aria-selected="false"
                    class="min-h-20 border-r border-paper/20 px-4 text-left text-sm transition-colors last:border-r-0 bg-ink text-paper/65 hover:bg-paper hover:text-ink"><span
                        class="block text-xs opacity-60">03</span>Choose opt-in</button>
                <button role="tab" data-tab-index="3" aria-selected="false"
                    class="min-h-20 border-r border-paper/20 px-4 text-left text-sm transition-colors last:border-r-0 bg-ink text-paper/65 hover:bg-paper hover:text-ink"><span
                        class="block text-xs opacity-60">04</span>WhatsApp</button>
            </div>

            <!-- Step 1: Scan -->
            <div data-panel-index="0" class="grid border-x border-b border-paper/20 lg:grid-cols-[1.2fr_.8fr]">
                <div class="relative flex items-center justify-center overflow-hidden bg-ink">
                    <img src="/jewellery/showroom.jpg" alt="Customer using a showroom QR registration point"
                        class="absolute inset-0 size-full object-cover" />
                    <div class="relative animate-drift w-[260px] border border-paper/20 bg-background p-3 shadow-2xl">
                        <div class="min-h-[420px] border border-border bg-card p-7 text-ink">
                            <p class="text-[10px] uppercase text-primary">At your showroom</p>
                            <h3 class="hv-phone-title">Scan to register your visit</h3>
                            <div class="hv-qr">
                                <img src="/jewellery/qr.svg" alt="Sample registration QR code (illustration)" />
                                <p>Counter 03 · Mumbai showroom</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-center bg-paper text-ink">
                    <p class="text-xs font-semibold tracking-[0.2em] text-primary">STEP 01 / 04</p>
                    <h3 class="mt-4 text-4xl">An easy welcome.</h3>
                    <p class="mt-4 max-w-md leading-7 text-ink/65">The visitor scans a QR displayed at your showroom
                        counter. This visual is a non-functional placeholder.</p>
                    <p class="mt-10 border-t border-ink/15 pt-5 text-xs text-ink/60">Illustrative product flow ·
                        This QR is not a registration link</p>
                </div>
            </div>

            <!-- Step 2: Register form -->
            <div data-panel-index="1" hidden class="grid border-x border-b border-paper/20 lg:grid-cols-[1.2fr_.8fr]">
                <div class="relative flex items-center justify-center overflow-hidden bg-ink">
                    <img src="/jewellery/showroom.jpg" alt="" class="absolute inset-0 size-full object-cover" />
                    <div class="relative w-[260px] border border-paper/20 bg-background p-3 shadow-2xl">
                        <div class="min-h-[420px] border border-border bg-card p-7 text-ink">
                            <p class="text-[10px] uppercase text-primary">Visitor registration</p>
                            <h3 class="hv-phone-title">Tell us about you</h3>
                            <form class="hv-form" data-demo-form>
                                <label>Name
                                    <input type="text" name="name" autocomplete="name" placeholder="Ananya Rao"
                                        required /></label>
                                <label>Phone number
                                    <input type="tel" name="phone" autocomplete="tel" inputmode="tel"
                                        pattern="[0-9+\\s-]{10,15}" placeholder="+91 98765 43210" required /></label>
                                <label>Email ID
                                    <input type="email" name="email" autocomplete="email"
                                        placeholder="ananya@example.com" required /></label>
                                <button type="submit" class="hv-btn hv-btn--gold hv-btn--block">Submit</button>
                                <p class="hv-form__done" hidden>Thank you! Your visit is registered.</p>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-center bg-paper text-ink">
                    <p class="text-xs font-semibold tracking-[0.2em] text-primary">STEP 02 / 04</p>
                    <h3 class="mt-4 text-4xl">Register in seconds.</h3>
                    <p class="mt-4 max-w-md leading-7 text-ink/65">The visitor enters their name, phone number and
                        email on their own phone. The relevant team member is alerted straight away.</p>
                    <p class="mt-10 border-t border-ink/15 pt-5 text-xs text-ink/60">Illustrative product flow ·
                        Dummy data only</p>
                </div>
            </div>

            <!-- Step 3: Opt-in + community -->
            <div data-panel-index="2" hidden class="grid border-x border-b border-paper/20 lg:grid-cols-[1.2fr_.8fr]">
                <div class="relative flex items-center justify-center overflow-hidden bg-ink">
                    <img src="/jewellery/showroom.jpg" alt="" class="absolute inset-0 size-full object-cover" />
                    <div class="relative animate-drift w-[260px] border border-paper/20 bg-background p-3 shadow-2xl">
                        <div class="min-h-[420px] border border-border bg-card p-7 text-ink">
                            <p class="text-[10px] uppercase text-primary">Visitor choice</p>
                            <h3 class="hv-phone-title">Stay in touch?</h3>
                            <div class="hv-choices">
                                <div class="hv-choice"><span>WhatsApp updates</span><span
                                        class="hv-pill hv-pill--yes">YES</span></div>
                                <div class="hv-choice"><span>Visit reminders</span><span class="hv-pill">NO</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-center bg-paper text-ink">
                    <p class="text-xs font-semibold tracking-[0.2em] text-primary">STEP 03 / 04</p>
                    <h3 class="mt-4 text-4xl">Opt-in stays optional.</h3>
                    <p class="mt-4 max-w-md leading-7 text-ink/65">The visitor can choose whether to receive further
                        messages from your brand — and can join your WhatsApp community for launches and offers.</p>
                    <p class="mt-10 border-t border-ink/15 pt-5 text-xs text-ink/60">Illustrative product flow ·
                        Dummy data only</p>
                </div>
            </div>

            <!-- Step 4: WhatsApp chat -->
            <div data-panel-index="3" hidden class="grid border-x border-b border-paper/20 lg:grid-cols-[1.2fr_.8fr]">
                <div class="relative flex items-center justify-center overflow-hidden bg-ink">
                    <img src="/jewellery/showroom.jpg" alt="" class="absolute inset-0 size-full object-cover" />
                    <div class="hv-phone relative animate-drift">
                        <div class="hv-wa text-ink">
                            <div class="hv-wa__status"><span>10:32</span><span class="hv-wa__notch"></span><span>5G ▮▮▮</span></div>
                            <div class="hv-wa__bar">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
                                <img class="hv-wa__dp" src="/v-mark.png" alt="" width="64" height="64" />
                                <div class="hv-wa__who">
                                    <strong>Elegance Jewellers</strong>
                                    <span>Community · 1.2K members</span>
                                </div>
                                <svg class="hv-wa__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect></svg>
                                <svg class="hv-wa__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                            </div>
                            <div class="hv-wa__body">
                                <span class="hv-wa__day">Today</span>
                                <div class="hv-wa__msg">
                                    <span class="hv-wa__from">Team Elegance · Admin</span>
                                    <div class="hv-wa__media">
                                        <img src="/jewellery/showroom.jpg" alt="" />
                                        <span class="hv-wa__ribbon"><b>15% OFF</b>Today only</span>
                                    </div>
                                    <p>✨ Today’s community offer: <b>15% off making charges</b> on all jewellery.</p>
                                    <div class="hv-wa__preview">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                                        <span><b>Visit our website</b>Explore the new collection</span>
                                    </div>
                                    <span class="hv-wa__time">10:30 AM</span>
                                    <span class="hv-wa__react">❤️ 🔥 👍 <b>86</b></span>
                                </div>
                                <div class="hv-wa__msg hv-wa__msg--short">
                                    <p>💍 New bridal arrivals in store this weekend.</p>
                                    <span class="hv-wa__time">10:31 AM</span>
                                </div>
                            </div>
                            <div class="hv-wa__foot">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>Only admins can send messages
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-center bg-paper text-ink">
                    <p class="text-xs font-semibold tracking-[0.2em] text-primary">STEP 04 / 04</p>
                    <h3 class="mt-4 text-4xl">Engage, with permission.</h3>
                    <p class="mt-4 max-w-md leading-7 text-ink/65">Visitors who join your WhatsApp community get
                        today’s offers and new arrivals, with a link back to your website.</p>
                    <ul class="hv-perks">
                        <li><span>%</span>Daily offers in one tap</li>
                        <li><span>★</span>New arrivals, straight to their phone</li>
                        <li><span>↗</span>A link back to your website</li>
                    </ul>
                    <p class="mt-10 border-t border-ink/15 pt-5 text-xs text-ink/60">Illustrative product flow ·
                        Dummy data only</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Now / Next / Over time -->
    <section id="why" class="bg-paper py-20">
        <div class="section-shell">
            <p class="text-xs uppercase text-primary">The value grows with each visit</p>
            <h2 class="mt-4 text-5xl">Useful today. More useful over time.</h2>
            <p class="mt-5 max-w-2xl leading-7 text-muted-foreground">Keep each step practical: welcome visitors,
                make the team aware and give them a record they can refer to when it is appropriate to reconnect.
            </p>
            <div class="hv-value-grid">
                <article class="hv-value hv-value--now hv-c hv-c-gold">
                    <span class="hv-value__word">Now</span>
                    <h3>Know who visited.</h3>
                    <p>QR registration creates a digital visitor record and alerts the relevant staff.</p>
                </article>
                <article class="hv-value hv-value--next hv-c hv-c-peach">
                    <span class="hv-value__word">Next</span>
                    <h3>Continue the conversation.</h3>
                    <p>Your team can follow up with people who have chosen to share their details and receive
                        messages.</p>
                </article>
                <article class="hv-value hv-value--over hv-c hv-c-sage">
                    <span class="hv-value__word">Over time</span>
                    <h3>See the bigger picture.</h3>
                    <p>Review saved records and available reports to understand showroom activity.</p>
                </article>
            </div>
        </div>
    </section>

    <!-- In-store moment -->
    <section class="hv-story py-20">
        <div class="section-shell hv-story__grid">
            <div>
                <p class="text-xs uppercase text-primary">An in-store moment, not an online ad QR</p>
                <h2 class="mt-4">Made for real showroom teams</h2>
                <p class="mt-4 text-xl font-semibold">Simple to put into practice.</p>
                <p class="mt-3 leading-7 text-muted-foreground">Place a QR at reception or a counter. Let visitors
                    register on their own phones, while your team stays focused on the in-person experience.</p>
                <div class="hv-stats">
                    <div class="hv-stat hv-stat--gold hv-c hv-c-gold">
                        <span class="hv-stat__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" aria-hidden="true">
                                <rect width="14" height="20" x="5" y="2" rx="2"></rect>
                                <path d="M12 18h.01"></path>
                            </svg></span>
                        <strong>No hardware</strong>
                        <p>No dedicated registration device required.</p>
                    </div>
                    <div class="hv-stat hv-stat--coral hv-c hv-c-peach">
                        <span class="hv-stat__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg></span>
                        <strong>≈ 15 min</strong>
                        <p>Indicative standard setup time.</p>
                    </div>
                    <div class="hv-stat hv-stat--teal hv-c hv-c-sage">
                        <span class="hv-stat__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" aria-hidden="true">
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                            </svg></span>
                        <strong>Staff alerts</strong>
                        <p>Let the relevant team member know a visitor has registered.</p>
                    </div>
                    <div class="hv-stat hv-stat--blue hv-c hv-c-sky">
                        <span class="hv-stat__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                stroke-linejoin="round" aria-hidden="true">
                                <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                                <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
                                <path d="M3 12A9 3 0 0 0 21 12"></path>
                            </svg></span>
                        <strong>Visitor records</strong>
                        <p>Keep details available in the dashboard.</p>
                    </div>
                </div>
            </div>
            <div class="hv-story__media">
                <img src="/jewellery/showroom.jpg" alt="Visitor scanning a QR code in a luxury jewellery showroom" />
            </div>
        </div>
    </section>

    <!-- Trial -->
    <section id="trial" class="bg-primary py-20 text-ink">
        <div class="section-shell grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-center">
            <div>
                <p class="text-xs uppercase text-deep">Put it to work in your showroom</p>
                <h2 class="mt-4 max-w-3xl">Start remembering every registered visit.</h2>
                <p class="mt-5 max-w-2xl text-lg leading-8 text-ink/70">Test the QR registration and team
                    notification flow with real showroom walk-ins during the paid trial.</p>
                <div class="mt-10 flex flex-wrap gap-3 text-sm">
                    <span class="px-4 py-2">15 days</span><span class="px-4 py-2">100 visitor bookings</span><span
                        class="px-4 py-2">No dedicated hardware</span>
                </div>
            </div>
            <div class="hv-price-card">
                <p class="hv-kicker text-xs text-ink/60">Paid trial</p>
                <p class="hv-price">₹49</p>
                <p class="mb-7 text-sm text-ink/70">Try Hai Visitor in your own showroom.</p>
                <button type="button" class="hv-btn hv-btn--ink hv-btn--block trial-cta">Start 15-day trial</button>
            </div>
        </div>
    </section>

    <!-- FAQ -->
    <section class="bg-paper py-20">
        <div class="section-shell">
            <div class="hv-faq">
            <div class="hv-faq__intro">
                <p class="text-xs uppercase text-primary">Common questions</p>
                <h2 class="mt-4 text-5xl">Questions before you start</h2>
                <p>Clear answers for showroom owners.</p>
            </div>
            <div class="divide-y divide-border border-y border-border">
                <details class="group py-6">
                    <summary
                        class="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-medium">
                        Does the visitor scan the QR in the ad?<span
                            class="text-primary transition-transform group-open:rotate-45">+</span></summary>
                    <p class="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">No. The registration QR is
                        displayed inside your showroom. The QR shown here is only an illustration.</p>
                </details>
                <details class="group py-6">
                    <summary
                        class="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-medium">
                        Is WhatsApp opt-in required?<span
                            class="text-primary transition-transform group-open:rotate-45">+</span></summary>
                    <p class="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">The visitor chooses whether to
                        opt in. Staff notification and saved registration details are separate from the visitor’s
                        choice to receive messages from the brand.</p>
                </details>
                <details class="group py-6">
                    <summary
                        class="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-medium">
                        Does it automatically send marketing campaigns or guarantee sales?<span
                            class="text-primary transition-transform group-open:rotate-45">+</span></summary>
                    <p class="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">No. Hai Visitor supports
                        registration, alerts and access to visitor records. Any later customer conversation is
                        planned and carried out by your team.</p>
                </details>
                <details class="group py-6">
                    <summary
                        class="flex cursor-pointer list-none items-center justify-between gap-5 text-lg font-medium">
                        What does the ₹49 trial include?<span
                            class="text-primary transition-transform group-open:rotate-45">+</span></summary>
                    <p class="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">A 15-day paid trial with 100
                        visitor bookings. Check the registration page for current terms before paying.</p>
                </details>
            </div>
            </div>
        </div>
    </section>

    <footer class="hv-footer border-t border-paper/10 bg-deep text-paper">
        <div class="section-shell flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p class="text-xs uppercase tracking-[0.16em] text-paper/60">Visit. Interact. Build. Engage.</p>
            <p class="text-xs text-paper/60">Zodopt Technology Solutions Pvt Ltd</p>
        </div>
    </footer>
</main>

<!-- Sticky CTA (all screen sizes), same as the main landing page -->
<div class="sticky-cta">
  <a class="btn btn-primary trial-cta" href="#trial">Start 15-Day Trial for ₹49 →</a>
</div>

<!-- WhatsApp float -->
<a class="wa-float" href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"><img src="/whatsapp-icon.png" alt="WhatsApp" /></a>

<!-- TRIAL SIGNUP POPUP -->
${TRIAL_MODAL_HTML}
`;

/* Walkthrough tabs: switch the visible step panel, advancing every 3s while
   the section is in view. Pauses while the visitor hovers over it (mouse
   only: on touch a tap would otherwise "hover" forever) or types in the demo
   form. Returns a cleanup function. */
const initWalkthrough = () => {
  const tabs = document.querySelectorAll('.jw [data-tab-index]');
  const panels = document.querySelectorAll('.jw [data-panel-index]');
  const section = document.getElementById('walkthrough');
  if (!tabs.length || !panels.length || !section) return () => {};

  const ACTIVE = ['bg-primary', 'text-primary-foreground'];
  const INACTIVE = ['bg-ink', 'text-paper/65', 'hover:bg-paper', 'hover:text-ink'];
  const INTERVAL = 3000;
  let current = 0;
  let visible = false, hovering = false, typing = false, timer = null;

  const select = (index) => {
    current = index;
    tabs.forEach((t, i) => {
      const selected = i === index;
      t.setAttribute('aria-selected', selected ? 'true' : 'false');
      ACTIVE.forEach((c) => t.classList.toggle(c, selected));
      INACTIVE.forEach((c) => t.classList.toggle(c, !selected));
    });
    panels.forEach((p) => { p.hidden = p.getAttribute('data-panel-index') !== String(index); });
  };

  const stop = () => { clearInterval(timer); timer = null; };
  const restart = () => {
    stop();
    if (!visible) return;
    timer = setInterval(() => {
      if (!hovering && !typing && !document.hidden) select((current + 1) % tabs.length);
    }, INTERVAL);
  };

  const onTabClick = (e) => {
    select(Array.prototype.indexOf.call(tabs, e.currentTarget));
    restart();
  };
  tabs.forEach((tab) => tab.addEventListener('click', onTabClick));

  const onEnter = (e) => { hovering = e.pointerType === 'mouse'; };
  const onLeave = () => { hovering = false; restart(); };
  const onFocusIn = (e) => { typing = e.target.matches('input'); };
  const onFocusOut = () => { typing = false; };
  section.addEventListener('pointerenter', onEnter);
  section.addEventListener('pointerleave', onLeave);
  section.addEventListener('focusin', onFocusIn);
  section.addEventListener('focusout', onFocusOut);

  // "In view" = at least a third of the viewport is covered by the section.
  const checkVisible = () => {
    const r = section.getBoundingClientRect();
    const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    const nowVisible = shown > innerHeight / 3;
    if (nowVisible === visible) return;
    visible = nowVisible;
    if (visible) { select(0); restart(); } else { stop(); }
  };
  window.addEventListener('scroll', checkVisible, { passive: true });
  window.addEventListener('resize', checkVisible);
  checkVisible();

  // Walkthrough register form: demo only, shows a confirmation instead of submitting.
  const forms = document.querySelectorAll('.jw [data-demo-form]');
  const onDemoSubmit = (e) => {
    e.preventDefault();
    e.currentTarget.querySelector('.hv-form__done').hidden = false;
    e.currentTarget.reset();
  };
  forms.forEach((f) => f.addEventListener('submit', onDemoSubmit));

  return () => {
    stop();
    tabs.forEach((tab) => tab.removeEventListener('click', onTabClick));
    section.removeEventListener('pointerenter', onEnter);
    section.removeEventListener('pointerleave', onLeave);
    section.removeEventListener('focusin', onFocusIn);
    section.removeEventListener('focusout', onFocusOut);
    window.removeEventListener('scroll', checkVisible);
    window.removeEventListener('resize', checkVisible);
    forms.forEach((f) => f.removeEventListener('submit', onDemoSubmit));
  };
};

export default function JewelleryLanding() {
  useEffect(() => {
    loadMetaPixel();
    const cleanupWalkthrough = initWalkthrough();
    const cleanupTrial = initTrialSignup({ landing: 'jewellery' });
    return () => {
      cleanupWalkthrough();
      cleanupTrial();
    };
  }, []);

  return <div className="jw lp" dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
