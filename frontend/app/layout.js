import Script from 'next/script';
import './globals.css';

const GA_ID = 'AW-17980176621';

export const metadata = {
  metadataBase: new URL('https://www.promeet.zodopt.com'),

  title: {
    default: "Promeet – Visitor Management System | Conference Room Booking India",
    template: "%s | Promeet",
  },

  description:
    "Promeet by Zodopt is India's smart Visitor Management System. Digital visitor passes, real-time dashboard, conference room booking with email & WhatsApp alerts. Go live in 15 minutes. Start your 15-day trial for ₹49.",

  keywords: [
    'visitor management system',
    'visitor management software',
    'visitor management system for office',
    'top 10 visitor management system in india',
    'visitor management system India',
    'visitor management system Bengaluru',
    'visitor management system demo',
    'conference room booking',
    'conference management platform',
    'digital visitor pass',
    'office visitor tracking',
    'Promeet',
    'Zodopt',
  ],

  authors:   [{ name: 'Zodopt', url: 'https://zodopt.com' }],
  creator:   'Zodopt',
  publisher: 'Zodopt',

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
    canonical: 'https://www.promeet.zodopt.com/',
  },

  openGraph: {
    type:        'website',
    locale:      'en_IN',
    url:         'https://www.promeet.zodopt.com/',
    siteName:    'Promeet',
    title:       'Promeet – Visitor Management System | Conference Room Booking',
    description: "India's smartest Visitor & Conference Management Platform. Digital passes, live dashboard, WhatsApp alerts. Go live in 15 minutes.",
    images: [
      {
        url:    '/og-image.png',
        width:  1200,
        height: 630,
        alt:    'Promeet – Visitor Management System by Zodopt',
      },
    ],
  },

  twitter: {
    card:        'summary_large_image',
    title:       'Promeet – Visitor Management System',
    description: 'Digital visitor passes, conference room booking & live dashboards for modern organizations. Start for ₹49.',
    images:      ['/og-image.png'],
  },

  verification: {
    google: 'YOUR_GOOGLE_SEARCH_CONSOLE_TOKEN', // replace with actual token from Search Console
  },

  category: 'technology',
};

/* ── JSON-LD Structured Data ─────────────────────────── */
const structuredData = [
  // 1. SoftwareApplication — powers the rich result card in Google
  {
    '@context':           'https://schema.org',
    '@type':              'SoftwareApplication',
    name:                 'Promeet',
    alternateName:        "Zodopt's Promeet",
    applicationCategory:  'BusinessApplication',
    operatingSystem:      'Web',
    description:
      'Visitor Management System with digital passes, conference room booking, live dashboard and WhatsApp notifications for modern organizations in India.',
    url: 'https://www.promeet.zodopt.com/',
    offers: {
      '@type':      'Offer',
      price:        '49',
      priceCurrency:'INR',
      description:  '15-day trial with full access to all features',
    },
    aggregateRating: {
      '@type':       'AggregateRating',
      ratingValue:   '4.9',
      reviewCount:   '500',
      bestRating:    '5',
      worstRating:   '1',
    },
    publisher: {
      '@type': 'Organization',
      name:    'Zodopt',
      url:     'https://zodopt.com',
    },
  },

  // 2. Organization — brand identity for Knowledge Panel
  {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name:       'Zodopt',
    url:        'https://zodopt.com',
    logo:       'https://www.promeet.zodopt.com/Brand%20Logo.png',
    contactPoint: {
      '@type':            'ContactPoint',
      telephone:          '+91-8647878785',
      contactType:        'customer support',
      availableLanguage:  ['English', 'Hindi'],
    },
    sameAs: ['https://www.promeet.zodopt.com/'],
  },

  // 3. WebSite — enables Google Sitelinks Search Box
  {
    '@context':        'https://schema.org',
    '@type':           'WebSite',
    name:              'Promeet',
    url:               'https://www.promeet.zodopt.com/',
    potentialAction: {
      '@type':       'SearchAction',
      target:        'https://www.promeet.zodopt.com/?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data – injected once at layout level */}
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

        {/* ── Google Tag Manager / Ads ── */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { page_path: window.location.pathname });
          `}
        </Script>
      </body>
    </html>
  );
}
