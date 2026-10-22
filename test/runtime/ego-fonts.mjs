/** Validate actual font selection, decoded glyph pixels and unseen CJK fallback. */
export async function verifyFontDelivery(page, {characters: requestedCharacters} = {}) {
  const before = await page.evaluate(() => {
    const entry = performance.getEntriesByType('resource').find(r => r.name.includes('/fonts/coscroll-entry.woff2'));
    if (!entry) throw Error('Entry font was not requested');
    const full = new URL('润植家康熙字典美化体.woff2', entry.name).href;
    const face = [...document.fonts].find(f => f.family.replace(/['"]/g, '') === 'RunZhiJiaKangXiZidian' && f.unicodeRange.startsWith('U+0-1F'));
    return {entry: entry.name, full, status: face?.status,
      requests: performance.getEntriesByType('resource').filter(r => r.name === full).length};
  });
  if (before.requests || before.status !== 'unloaded') throw Error('Complete font was fetched without an unseen glyph');
  await page.evaluate(async full => {
    const probe = window.__originalFontProbe = new FontFace('CoScrollOriginalProbe', `url("${full}")`);
    document.fonts.add(probe);await probe.load();
    await document.fonts.load('96px RunZhiJiaKangXiZidian', '心经栴龍');
  }, before.full);
  const fallback = await page.evaluate(full => ({ready: document.fonts.check('96px RunZhiJiaKangXiZidian', '龍'),
    requests: performance.getEntriesByType('resource').filter(r => r.name === full).map(r => ({start: r.startTime, duration: r.duration})),
    status: [...document.fonts].find(f => f.family.replace(/['"]/g, '') === 'RunZhiJiaKangXiZidian' && f.unicodeRange.startsWith('U+0-1F'))?.status,
  }), before.full);
  if (!fallback.ready || fallback.status !== 'loaded') throw Error('Unseen glyph did not activate the complete font');
  const characters = requestedCharacters ?? await page.evaluate(() => [...new Set(window.__infiniteRegression.readProps().lyrics.map(l => l.text).join('') + '心经栴龍')]);
  const pixels = [];
  for (let index = 0; index < characters.length; index += 8) pixels.push(...await page.evaluate(chars => {
    const canvases = [document.createElement('canvas'), document.createElement('canvas')];
    const px = 96 * devicePixelRatio, padding = px * .45, height = Math.ceil(px * 2);
    const contexts = canvases.map(c => {c.width = Math.ceil(px * 1.9);c.height = height;return c.getContext('2d', {willReadFrequently: true});});
    return chars.map(char => {
      const images = contexts.map((ctx, i) => {
        ctx.clearRect(0, 0, canvases[i].width, height);
        ctx.font = `${px}px ${i ? 'CoScrollOriginalProbe, ' : ''}RunZhiJiaKangXiZidian`;
        ctx.textBaseline = 'middle';ctx.textAlign = 'center';ctx.fillStyle = '#ffffff';
        ctx.fillText(char, canvases[i].width / 2, padding + px * 1.1 / 2);
        return ctx.getImageData(0, 0, canvases[i].width, height).data;
      });
      let max = 0, changed = 0;
      for (let n = 0; n < images[0].length; n++) {const d = Math.abs(images[0][n] - images[1][n]);max = Math.max(max, d);if(d)changed++;}
      return {char, max, changed};
    });
  }, characters.slice(index, index + 8)));
  await page.evaluate(() => {document.fonts.delete(window.__originalFontProbe);delete window.__originalFontProbe;});
  if (pixels.some(p => p.max)) throw Error('Glyph pixels changed: ' + JSON.stringify(pixels.filter(p => p.max)));
  return {before, fallback, pixels};
}
