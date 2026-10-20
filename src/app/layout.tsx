import './globals.css';
import { assetUrl } from '@/utils/assetUrl';

const primaryFont = assetUrl('/fonts/润植家康熙字典美化体.woff2');

export const metadata = {
  title: 'CoScroll',
  description: 'Immersive Heart Sutra experience',
  other: { 'coscroll-release-id': process.env.COSCROLL_RELEASE_ID || 'development' },
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
        <style dangerouslySetInnerHTML={{__html: `@font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('${primaryFont}') format('woff2');
          font-display: swap;
        }`}} />
      </head>
      <body className="bg-night text-slateText">
        {children}
      </body>
    </html>
  )
}
