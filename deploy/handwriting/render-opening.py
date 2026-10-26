#!/usr/bin/env python3
"""Render one verified scene to a compact transparent preface using Inko's official sprite and label tools."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sdk', required=True)
    parser.add_argument('--scene', required=True)
    parser.add_argument('--preface', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    sys.path.insert(0, args.sdk)
    import numpy as np
    from _common import Image, apply_label, label_box, save_image
    import scene

    text = json.loads(Path(args.preface).read_text('utf-8'))['text']
    package = scene.open_package(args.scene)
    state = scene.State(package)
    compact = lambda value: re.sub(r'\s+', '', value)
    if len(state.pages) != 1 or compact(package.doc['text']) != compact(text):
        raise ValueError('Scene does not contain exactly this preface on one page')
    glyphs = state.visible(0)
    if compact(''.join(g.c for g in glyphs)) != compact(text):
        raise ValueError('Missing, substituted or reordered handwriting glyphs')
    if package.doc.get('label', {}).get('mode') == 'none' or package.label_image() is None:
        raise ValueError('The generated scene must retain its Inko label')

    width, height = 1440, 720
    label = package.label_image()
    label_bounds = label_box((width, height), label, frac=0.10)
    bounds = np.asarray([g.ink for g in glyphs])
    left, top = bounds[:, :2].min(axis=0)
    right, bottom = bounds[:, 2:].max(axis=0)
    body_bottom = label_bounds[1] - 48
    scale = min((width - 128) / (right - left), (body_bottom - 60) / (bottom - top))
    transform = np.array([[scale, 0, (width - (right - left) * scale) / 2 - left * scale],
                          [0, scale, 60 - top * scale], [0, 0, 1]], dtype=np.float64)
    ink = np.ones((height, width), dtype=np.float32)
    for glyph in glyphs:
        # One uniform transform retains the model's own stroke texture, spacing and baseline variation.
        matrix = (transform @ np.vstack([glyph.m, [0, 0, 1]]))[:2]
        scene.place_sprite(ink, package.sprite(glyph), matrix)
    rgba = np.empty((height, width, 4), dtype=np.uint8)
    rgba[:, :, :3] = [226, 232, 240]
    rgba[:, :, 3] = np.round((1 - ink) * 255).clip(0, 255).astype(np.uint8)
    image = apply_label(Image.fromarray(rgba, 'RGBA'), label, frac=0.10, color=None)
    produce_id = package.doc['pages'][0]['aigc_id']
    metadata = {'aigc': scene.aigc_fields(package, produce_id)}
    save_image(image, args.out, metadata)
    scene.mark_edited(Path(args.out))
    saved = Image.open(args.out)
    if not saved.info.get('AIGC') or not saved.info.get('XML:com.adobe.xmp') or saved.info.get('InkoEdited') != 'true':
        raise ValueError('Output lost Inko metadata')
    data = Path(args.out).read_bytes()
    print(json.dumps({'width': width, 'height': height, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                      'sceneText': package.doc['text'], 'glyphs': [g.c for g in glyphs],
                      'labelBounds': label_bounds, 'layoutVersion': 1}, ensure_ascii=False))


if __name__ == '__main__':
    main()
