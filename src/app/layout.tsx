import './globals.css';
import { assetUrl } from '@/utils/assetUrl';
import { createEntryBootstrap } from '@/config/entryBootstrap.server';
import { ENTRY_DATA_ID, serializeEntryData } from '@/config/entryBootstrap';

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
  const {data, hints} = createEntryBootstrap();
  const earlyPreparation = `(() => {
    const rootPath = ${serializeEntryData(process.env.NEXT_PUBLIC_BASE_PATH || '')};
    if (location.pathname !== rootPath && location.pathname !== rootPath + '/') return;
    const hints = ${serializeEntryData(hints)};
    const hint = hints[new URLSearchParams(location.search).get('project') || 'heart-sutra'];
    if (!hint) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const request = fetch(hint.audio, {method: 'HEAD', signal: controller.signal}).finally(() => clearTimeout(timeout));
    request.catch(() => {});
    window.__coscrollEntryAudio = {release: ${serializeEntryData(data.release)}, src: hint.audio, request};
    const preload = (href, as, type, priority = 'low') => {
      const link = document.createElement('link');
      link.rel = 'preload'; link.href = href; link.as = as;
      link.crossOrigin = 'anonymous'; link.fetchPriority = priority;
      if (type) link.type = type;
      document.head.appendChild(link);
    };
    preload(hint.model, 'fetch');
    if (hint.supplement) preload(${serializeEntryData(supplementFont)}, 'font', 'font/woff2');
    // Keep the full font and entry scripts ahead of 2.5 MB of textures on a
    // constrained connection. Start texture hints before the reading scene.
    const textures = () => {
      preload(${serializeEntryData(assetUrl('/textures/qwantani_moon_noon_puresky_1k.hdr'))}, 'fetch');
      preload(${serializeEntryData(assetUrl('/textures/normal.jpg'))}, 'image');
    };
    document.fonts.load('16px RunZhiJiaKangXiZidian', hint.supplement ? '心经栴' : '心经').then(textures, textures);
  })();`;
  return (
    <html lang="zh-Hans">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href={new URL(primaryFont, 'http://localhost').origin} crossOrigin="anonymous" />
        <link rel="preconnect" href={new URL(assetUrl('/audio/心经_2.mp3'), 'http://localhost').origin} crossOrigin="anonymous" />
        <link rel="preload" href={primaryFont} as="font" type="font/woff2" crossOrigin="anonymous" fetchPriority="low" />
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
        <script id={ENTRY_DATA_ID} type="application/json" dangerouslySetInnerHTML={{__html: serializeEntryData(data)}} />
        <script dangerouslySetInnerHTML={{__html: earlyPreparation}} />
      </head>
      <body className="bg-night text-slateText">
        {children}
      </body>
    </html>
  )
}
