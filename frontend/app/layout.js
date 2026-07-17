import Script from 'next/script';
import './globals.css';

const GA_ID = 'G-HRFN50WPZX';

/* ── Site-wide constants (single source of truth) ───────── */
export const SITE = {
  name:        'Zodopts Promeet',
  brand:       'Zodopt',
  tagline:     'Visitor Management Platform',
  domain:      'https://www.promeet.zodopt.com',
  phone:       '+91-8647878785',
  email:       'admin@promeet.zodopt.com',
  logo:        'https://www.promeet.zodopt.com/Brand%20Logo.png',
  ogImage:     'https://www.promeet.zodopt.com/og-image.png',
  trialPrice:  '49',
  trialCurrency:'INR',
  rating:      '4.9',
  reviewCount: '500',
};

/* ── Dynamic Metadata ────────────────────────────────────── */
export const metadata = {
  metadataBase: new URL(SITE.domain),

  title: {
    default:  `${SITE.name} – Visitor Management Platform | Conference Management Platform India`,
    template: `%s | ${SITE.name} by ${SITE.brand}`,
  },

  description:
    `${SITE.name} by ${SITE.brand} is India's smartest Visitor Management Platform and Conference Management Platform. Get digital visitor passes, a real-time live dashboard, conference room booking with Email & WhatsApp alerts. Go live in 15 minutes. Start your 15-day trial for ₹${SITE.trialPrice}.`,

  keywords: [
    'visitor management platform',
    'visitor management platform India',
    'visitor management platform Bengaluru',
    'conference management platform',
    'conference management platform India',
    'visitor management system',
    'visitor management software',
    'visitor management system for office',
    'top 10 visitor management system in india',
    'visitor management system India',
    'visitor management system Bengaluru',
    'visitor management system demo',
    'conference room booking',
    'conference room booking software India',
    'digital visitor pass',
    'office visitor tracking',
    'visitor check-in system',
    'Promeet',
    'Zodopt',
    'Promeet visitor management',
    'Visitor management system for schools',
    'Digital guest book for showrooms', 
    'Promeet pricing',
    'Zodopt Promeet',
    'visitor check-in software',
    'workplace management system',
    'workplace management system',
    'visitor management system for office',
    'touchless check-in system',
    'digital visitor pass / visitor badge',  
  ],

  authors:   [{ name: SITE.brand, url: 'https://zodopt.com' }],
  creator:   SITE.brand,
  publisher: SITE.brand,

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  alternates: {
    canonical: `${SITE.domain}/`,
  },

  openGraph: {
    type:        'website',
    locale:      'en_IN',
    url:         `${SITE.domain}/`,
    siteName:    `${SITE.name} by ${SITE.brand}`,
    title:       `${SITE.name} – Visitor Management Platform | Conference Management Platform`,
    description: `India's smartest Visitor Management Platform & Conference Management Platform. Digital passes, live dashboard, WhatsApp alerts. Go live in 15 minutes. Try for ₹${SITE.trialPrice}.`,
    images: [
      {
        url:    SITE.ogImage,
        width:  1200,
        height: 630,
        alt:    `${SITE.name} – Visitor Management Platform by ${SITE.brand}`,
      },
    ],
  },

  twitter: {
    card:        'summary_large_image',
    title:       `${SITE.name} – Visitor Management Platform | Conference Management Platform`,
    description: `Digital visitor passes, conference room booking & live dashboards for modern organizations. Start for ₹${SITE.trialPrice}.`,
    images:      [SITE.ogImage],
  },

  verification: {
    google: 'AW-17980176621', // ← replace with actual token
  },

  category: 'technology',
};

/* ── JSON-LD Structured Data (fully dynamic) ─────────────── */
const structuredData = [
  // 1. SoftwareApplication — rich result card
  {
    '@context':           'https://schema.org',
    '@type':              'SoftwareApplication',
    name:                 SITE.name,
    alternateName:        [`${SITE.brand}'s ${SITE.name}`, 'Visitor Management Platform India', 'Conference Management Platform India'],
    applicationCategory:  'BusinessApplication',
    operatingSystem:      'Web',
    description:
      `${SITE.name} is India's leading Visitor Management Platform and Conference Management Platform with digital visitor passes, real-time dashboards, conference room booking, and WhatsApp & email notifications for modern organizations.`,
    url: `${SITE.domain}/`,
    offers: {
      '@type':       'Offer',
      price:         SITE.trialPrice,
      priceCurrency: SITE.trialCurrency,
      description:   '15-day trial with full access to all Visitor Management Platform features',
    },
    aggregateRating: {
      '@type':       'AggregateRating',
      ratingValue:   SITE.rating,
      reviewCount:   SITE.reviewCount,
      bestRating:    '5',
      worstRating:   '1',
    },
    publisher: {
      '@type': 'Organization',
      name:    SITE.brand,
      url:     'https://zodopt.com',
    },
  },

  // 2. Organization — brand / Knowledge Panel
  {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name:       SITE.brand,
    url:        'https://zodopt.com',
    logo:       SITE.logo,
    contactPoint: {
      '@type':           'ContactPoint',
      telephone:         SITE.phone,
      contactType:       'customer support',
      availableLanguage: ['English', 'Hindi'],
    },
    sameAs: [`${SITE.domain}/`],
  },

  // 3. Product — for Google Shopping / rich snippets
  {
    '@context':   'https://schema.org',
    '@type':      'Product',
    name:         `${SITE.name} – Visitor Management Platform`,
    description:  `India's smartest Visitor Management Platform & Conference Management Platform. Digital passes, real-time dashboard, WhatsApp alerts.`,
    brand: {
      '@type': 'Brand',
      name:    SITE.brand,
    },
    offers: {
      '@type':       'Offer',
      url:           `${SITE.domain}/`,
      price:         SITE.trialPrice,
      priceCurrency: SITE.trialCurrency,
      availability:  'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type':       'AggregateRating',
      ratingValue:   SITE.rating,
      reviewCount:   SITE.reviewCount,
    },
  },

  // 4. WebSite — Sitelinks Search Box
  {
    '@context':      'https://schema.org',
    '@type':         'WebSite',
    name:            `${SITE.name} – Visitor Management Platform`,
    url:             `${SITE.domain}/`,
    potentialAction: {
      '@type':       'SearchAction',
      target:        `${SITE.domain}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },

  // 5. FAQPage — FAQ rich results in Google SERP
  {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name:    'What is Promeet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:    `${SITE.name} by ${SITE.brand} is India's smartest Visitor Management Platform and Conference Management Platform. It provides digital visitor passes, a live dashboard, conference room booking, and WhatsApp/email alerts.`,
        },
      },
      {
        '@type': 'Question',
        name:    'How much does Promeet cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:    `${SITE.name} offers a 15-day trial for just ₹${SITE.trialPrice}. The Business plan is ₹500/month. Enterprise pricing is custom.`,
        },
      },
      {
        '@type': 'Question',
        name:    'How quickly can I go live with Promeet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:    'Most organizations are up and running within 15 minutes. No hardware required — it\'s a fully cloud-based Visitor Management Platform.',
        },
      },
    ],
  },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* Google Analytics 4 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}</Script>

        {/* Structured Data */}
        {structuredData.map((schema, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
      </head>

      <body>
        {children}
      </body>
    </html>
  );
}
