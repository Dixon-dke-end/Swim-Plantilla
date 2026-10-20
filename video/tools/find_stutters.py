"""Finds visible hitches in recorded scenes.

A hitch is a long gap between captured frames (the page could not paint) that
ends in a big visual jump. Idle gaps (nothing changed) are ignored.

Usage: python -I tools/find_stutters.py [scene ...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

FRAMES = Path(__file__).resolve().parent.parent / "out" / "frames"
GAP_MS = 70        # > ~2 frames at 30 fps
JUMP = 2.5         # mean absolute difference (0-255) that reads as a jump


def thumb(path: Path) -> Image.Image:
    return Image.open(path).convert("L").resize((240, 135))


def analyze(scene: str) -> list[dict]:
    folder = FRAMES / scene
    frames = sorted(json.loads((folder / "frames.json").read_text()), key=lambda frame: frame["t"])
    start = frames[0]["t"]
    hits = []
    for previous, current in zip(frames, frames[1:]):
        gap_ms = (current["t"] - previous["t"]) * 1000
        if gap_ms < GAP_MS or previous["name"] == current["name"]:
            continue
        diff = ImageStat.Stat(ImageChops.difference(thumb(folder / previous["name"]), thumb(folder / current["name"]))).mean[0]
        if diff >= JUMP:
            hits.append({
                "scene": scene,
                "at": round(previous["t"] - start, 2),
                "gap_ms": round(gap_ms),
                "jump": round(diff, 1),
                "before": previous["name"],
                "after": current["name"],
            })
    return hits


def main() -> None:
    scenes = sys.argv[1:] or sorted(p.name for p in FRAMES.iterdir() if (p / "frames.json").exists())
    for scene in scenes:
        hits = analyze(scene)
        print(f"{scene}: {len(hits)} hitches")
        for hit in hits:
            print(f"  t={hit['at']:>6}s  gap={hit['gap_ms']:>4} ms  jump={hit['jump']:>5}  {hit['before']} -> {hit['after']}")


if __name__ == "__main__":
    main()
