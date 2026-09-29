import JewelleryLanding from './JewelleryLanding';

const TITLE = 'Hai Visitor for Jewellery Showrooms | Every visit is worth remembering';
const DESCRIPTION =
  'Hai Visitor helps jewellery showroom teams register walk-ins, receive staff alerts and keep visitor records ready for future conversations. Start a 15-day trial for ₹49.';

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/jewellery' },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: '/jewellery',
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

export default function JewelleryPage() {
  return <JewelleryLanding />;
}
