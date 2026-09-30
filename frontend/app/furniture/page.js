import FurnitureLanding from './FurnitureLanding';

const TITLE = 'Hai Visitor for Furniture & Interior Showrooms | Every visit is worth remembering';
const DESCRIPTION =
  'Hai Visitor helps showroom teams register walk-ins, receive staff alerts and keep visitor records ready for future conversations. Start a 15-day trial for ₹49.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/furniture' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/furniture',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function FurniturePage() {
  return <FurnitureLanding />;
}
