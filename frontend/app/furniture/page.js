import FurnitureLanding from './FurnitureLanding';

const TITLE = 'Hai Visitor for Furniture & Home Décor Showrooms | Zodopt';
const DESCRIPTION =
  'Digitise furniture and home décor showroom walk-ins with QR registration, instant staff alerts and organised visitor records.';
const OG_TITLE = 'Hai Visitor for Furniture & Home Décor Showrooms';
const OG_DESCRIPTION =
  'Capture every showroom walk-in, engage the right consultant and keep visitor history organised.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: 'Zodopt Technology Solutions Pvt Ltd' }],
  alternates: { canonical: '/furniture' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/furniture',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function FurniturePage() {
  return <FurnitureLanding />;
}
