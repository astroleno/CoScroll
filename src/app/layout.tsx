import './globals.css';
import { assetUrl } from '@/utils/assetUrl';
import { createEntryBootstrap } from '@/config/entryBootstrap.server';
import { ENTRY_DATA_ID, serializeEntryData } from '@/config/entryBootstrap';

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
  const {data, hints, font} = createEntryBootstrap();
  const earlyPreparation = `(() => {
    const rootPath = ${serializeEntryData(process.env.NEXT_PUBLIC_BASE_PATH || '')};
    if (location.pathname !== rootPath && location.pathname !== rootPath + '/') return;
    const hints = ${serializeEntryData(hints)};
    const hint = hints[new URLSearchParams(location.search).get('project') || 'heart-sutra'];
    if (!hint) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    // A one-byte GET follows the CDN's cached media path. Some edges leave HEAD
    // waiting until the timeout even when ordinary media ranges are available.
    const request = fetch(hint.audio, {headers: {Range: 'bytes=0-0'}, signal: controller.signal}).finally(() => clearTimeout(timeout));
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
    // Let the small reading font finish before large texture transfers compete
    // for a slow connection. Do not wait for every script via window.load.
    const warmTextures = () => {
      preload(${serializeEntryData(assetUrl('/textures/qwantani_moon_noon_puresky_1k.hdr'))}, 'fetch');
      preload(${serializeEntryData(assetUrl('/textures/normal.jpg'))}, 'image');
    };
    document.fonts.load('16px RunZhiJiaKangXiZidian', '心经').then(warmTextures, warmTextures);
  })();`;
  return (
    <html lang="zh-Hans">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href={new URL(font.entry, 'http://localhost').origin} crossOrigin="anonymous" />
        <link rel="preconnect" href={new URL(assetUrl('/audio/心经_2.mp3'), 'http://localhost').origin} crossOrigin="anonymous" />
        <link rel="preload" href={font.entry} as="font" type="font/woff2" crossOrigin="anonymous" fetchPriority="high" />
        <style dangerouslySetInnerHTML={{__html: `@font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('${font.full}') format('woff2');
          unicode-range: ${font.ranges.full};
          font-display: swap;
        }
        @font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('${font.entry}') format('woff2');
          unicode-range: ${font.ranges.entry};
          font-display: swap;
        }
        @font-face {
          font-family: 'RunZhiJiaKangXiZidian';
          src: url('${supplementFont}') format('woff2');
          unicode-range: U+6834;
          font-display: swap;
        }`}} />
        <script id={ENTRY_DATA_ID} type="application/json" dangerouslySetInnerHTML={{__html: serializeEntryData(data)}} />
        {/* An async classic script does not wait for the preceding stylesheet.
            The data URL keeps these build-validated hints inside this HTML. */}
        <script id="coscroll-entry-preparation" async src={`data:text/javascript;charset=utf-8,${encodeURIComponent(earlyPreparation)}`} />
      </head>
      <body className="bg-night text-slateText">
        {children}
      </body>
    </html>
  )
}
