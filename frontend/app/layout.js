import './globals.css'

export const metadata = {
  title: 'Promeet',
  description: 'Enterprise-grade Visitor and Conference booking management platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
