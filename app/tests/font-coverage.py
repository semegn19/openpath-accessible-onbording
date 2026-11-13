"""Fails if the Ethiopic face cannot render a character a user might type.

The bug this guards against: the subset was built from the UI strings, so "ዘ" (U+12D8)
was missing and a voice transcript rendered as a tofu box.
"""
import sys, glob, unicodedata
from fontTools.ttLib import TTFont

fails = 0
faces = glob.glob('public/fonts/noto-sans-ethiopic*.woff2')
if not faces:
    print('✗ no Ethiopic face found'); sys.exit(1)

for f in faces:
    cmap = TTFont(f).getBestCmap()
    # Only codepoints Unicode actually assigns: the Ethiopic block has holes (U+1249 etc.)
    # that no font can render and no user can type.
    block = [c for c in range(0x1200, 0x13A0) if unicodedata.category(chr(c)) != 'Cn']
    missing = [hex(c) for c in block if c not in cmap]
    print(f'{"✓" if not missing else "✗"} {f}: {len(cmap)} glyphs, {len(block) - len(missing)}/{len(block)} assigned Ethiopic codepoints'
          + (f' → {missing[:12]}' if missing else ''))
    if missing:
        fails += 1
    # a name the user might actually type, character by character
    sample = 'ዘጠኝ አንድ ሳራ ተስፋዬ ጸጋዬ ፀሐይ ቈንጆ ሸዋ ደብረ ብርሃን ጉራጌ'
    bad = sorted({ch for ch in sample if ch not in ' ' and ord(ch) not in cmap})
    print(f'   sample text {"✓ renders" if not bad else "✗ tofu for " + " ".join(bad)}')
    if bad:
        fails += 1

sys.exit(1 if fails else 0)
