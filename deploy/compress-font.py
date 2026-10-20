"""Losslessly package the existing Chinese typeface for the web."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

root = Path(__file__).resolve().parents[1]
source = root / 'public/fonts/润植家康熙字典美化体.ttf'
destination = source.with_suffix('.woff2')
original = TTFont(source)
original.flavor = 'woff2'
original.save(destination)

# Verify all glyphs and metrics, not just the current sutra's characters.
original = TTFont(source)
packed = TTFont(destination)
assert original.getBestCmap() == packed.getBestCmap()
assert original['hmtx'].metrics == packed['hmtx'].metrics
assert original['head'].unitsPerEm == packed['head'].unitsPerEm
before, after = original.getGlyphSet(), packed.getGlyphSet()
assert set(before.keys()) == set(after.keys())
for name in before.keys():
    left, right = RecordingPen(), RecordingPen()
    before[name].draw(left)
    after[name].draw(right)
    assert left.value == right.value, f'Glyph outline changed: {name}'
print(json.dumps({'sourceBytes': source.stat().st_size,
                  'woff2Bytes': destination.stat().st_size,
                  'glyphs': len(before.keys()), 'allOutlinesAndMetrics': 'identical'}))
