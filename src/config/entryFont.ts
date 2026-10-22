/** Disjoint faces keep FontFaceSet.load from fetching both files for one glyph. */
export function entryFontRanges(codepoints: readonly number[]) {
  const values = Array.from(new Set(codepoints)).sort((a, b) => a - b);
  if (!values.length || values.some(n => !Number.isInteger(n) || n < 0 || n > 0x10ffff || n === 0x6834)) {
    throw new Error('Invalid entry font codepoints');
  }
  const ranges = (points: readonly number[]) => {
    const result: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      let end = start;
      while (points[i + 1] === end + 1) end = points[++i];
      result.push('U+' + start.toString(16).toUpperCase() + (end === start ? '' : '-' + end.toString(16).toUpperCase()));
    }
    return result.join(',');
  };
  const omitted = [...values, 0x6834].sort((a, b) => a - b), full: string[] = [];
  let next = 0;
  for (const value of [...omitted, 0x110000]) {
    if (value > next) full.push('U+' + next.toString(16).toUpperCase() + (value - 1 === next ? '' : '-' + (value - 1).toString(16).toUpperCase()));
    next = value + 1;
  }
  return {entry: ranges(values), full: full.join(','), supplement: 'U+6834'};
}
