"""Builds a before/after sheet for given scene:frameIndex pairs. Usage: python -I tools/pairs.py out.jpg scene:index ..."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parent.parent / "out" / "frames"
out, items = sys.argv[1], sys.argv[2:]
W, H = 640, 360
sheet = Image.new("RGB", (W * 2, (H + 20) * len(items)), "white")
draw = ImageDraw.Draw(sheet)
for row, item in enumerate(items):
    scene, index = item.split(":")
    for col, i in enumerate((int(index), int(index) + 1)):
        im = Image.open(root / scene / f"f{i:06d}.jpg").resize((W, H))
        sheet.paste(im, (col * W, row * (H + 20) + 20))
    draw.text((6, row * (H + 20) + 4), f"{scene} {index} -> {int(index)+1}", fill="black")
sheet.save(out, quality=82)
