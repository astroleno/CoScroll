import './globals.css';
import { assetUrl } from '@/utils/assetUrl';

const primaryFont = assetUrl('/fonts/润植家康熙字典美化体.woff2');
const supplementFont = assetUrl('/fonts/lotus-supplement.woff2');

export const metadata = {
  title: 'CoScroll',
  description: '随声观经：心经与妙法莲华经',
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
        <link rel="preload" href={primaryFont} as="font" type="font/woff2" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{__html: `@font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('${primaryFont}') format('woff2');
          font-display: swap;
        }
        @font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('${supplementFont}') format('woff2');
          unicode-range: U+6834;
          font-display: swap;
        }`}} />
      </head>
      <body className="bg-night text-slateText">
        {children}
      </body>
    </html>
  )
}
