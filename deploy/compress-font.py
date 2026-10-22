"""Package unchanged entry glyphs; retain the complete original web font."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
source = root / 'public/fonts/润植家康熙字典美化体.ttf'
complete = source.with_suffix('.woff2')
entry_path = root / 'public/fonts/coscroll-entry.woff2'
manifest_path = root / 'src/config/entry-font.json'

if not complete.exists():
    if args.check:
        raise RuntimeError('Complete web font is missing')
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(complete)

def verify_glyphs(before, after, codepoints):
    left_map, right_map = before.getBestCmap(), after.getBestCmap()
    left_set, right_set = before.getGlyphSet(), after.getGlyphSet()
    assert before['head'].unitsPerEm == after['head'].unitsPerEm
    for table, fields in [('hhea', ['ascent', 'descent', 'lineGap']),
                          ('OS/2', ['sTypoAscender', 'sTypoDescender', 'sTypoLineGap',
                                    'usWinAscent', 'usWinDescent', 'sxHeight', 'sCapHeight'])]:
        for field in fields:
            assert getattr(before[table], field, None) == getattr(after[table], field, None), (table, field)
    for codepoint in codepoints:
        left, right = left_map[codepoint], right_map[codepoint]
        assert before['hmtx'].metrics[left] == after['hmtx'].metrics[right], hex(codepoint)
        a, b = DecomposingRecordingPen(left_set), DecomposingRecordingPen(right_set)
        left_set[left].draw(a)
        right_set[right].draw(b)
        assert a.value == b.value, f'Glyph outline changed: U+{codepoint:04X}'
        if 'glyf' in before and 'glyf' in after:
            a, b = before['glyf'][left], after['glyf'][right]
            assert (a.program.getBytecode() if hasattr(a, 'program') else b'') == (
                b.program.getBytecode() if hasattr(b, 'program') else b''), hex(codepoint)

original, packed = TTFont(source), TTFont(complete)
assert original.getBestCmap() == packed.getBestCmap()
assert original['hmtx'].metrics == packed['hmtx'].metrics
verify_glyphs(original, packed, original.getBestCmap())

# ASCII also covers default FontFaceSet checks and all player timestamps.
characters = set(map(chr, range(32, 127)))
characters.update('心经王菲妙法莲华经赞诗模型制作中暂用占位目标字')
for path in sorted((root / 'public/projects').glob('*.json')):
    project = json.loads(path.read_text())
    lyrics = (root / 'public' / project['assets']['lyrics']['src'].lstrip('/')).resolve()
    if not lyrics.is_relative_to(root / 'public/lyrics'):
        raise RuntimeError('Project lyrics escaped the published lyrics directory')
    characters.update(lyrics.read_text())
    characters.update(project['project']['name'])
    characters.update(project['assets']['audio'].get('artist', ''))

codepoints = sorted(set(map(ord, characters)) & set(packed.getBestCmap()))
entry = TTFont(complete, recalcBBoxes=False, recalcTimestamp=False)
options = subset.Options()
options.layout_features = ['*']
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=codepoints)
subsetter.subset(entry)
entry.flavor = 'woff2'
buffer = io.BytesIO()
entry.save(buffer)
entry_bytes = buffer.getvalue()
verify_glyphs(packed, TTFont(io.BytesIO(entry_bytes)), codepoints)

manifest = {
    'version': 1,
    'source': '/fonts/' + complete.name,
    'sourceSha256': hashlib.sha256(complete.read_bytes()).hexdigest(),
    'entry': '/fonts/' + entry_path.name,
    'entrySha256': hashlib.sha256(entry_bytes).hexdigest(),
    'codepoints': codepoints,
    'glyphs': len(entry.getGlyphOrder()),
}
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
if args.check:
    assert entry_path.read_bytes() == entry_bytes, 'Entry font is stale'
    assert manifest_path.read_bytes() == manifest_bytes, 'Entry font manifest is stale'
else:
    entry_path.write_bytes(entry_bytes)
    manifest_path.write_bytes(manifest_bytes)
print(json.dumps({'completeBytes': complete.stat().st_size, 'entryBytes': len(entry_bytes),
                  'entryGlyphs': manifest['glyphs'], 'entryCodepoints': len(codepoints),
                  'allOutlinesHintsAndMetrics': 'identical', 'check': args.check}))
