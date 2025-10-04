import './globals.css';

export const metadata = {
  title: 'CoScroll',
  description: 'Immersive Heart Sutra experience',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-Hans">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-night text-slateText">
        {children}
      </body>
    </html>
  )
}
