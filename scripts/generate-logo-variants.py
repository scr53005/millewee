#!/usr/bin/env python3
"""
Generate light-mode and dark-mode variants of a transparent-background logo PNG.

Replaces the runtime CSS hack `dark:brightness-0 dark:invert` with two pre-baked
PNGs, so the dish-card / header swap is `dark:hidden` / `hidden dark:block`.

Naming convention:
    logo_<base>_light.png  →  shown when the page is in LIGHT mode (so its
                              pixels are dark, to read against a light bg).
    logo_<base>_dark.png   →  shown when the page is in DARK mode (so its
                              pixels are cream, to read against a dark bg).

Default fg colors come from the millewee brand palette:
    light variant fg = #1a1310 (dark walnut leather; readable on cream)
    dark  variant fg = #f5f0e8 (cream; readable on the #1a1310 dark bg)

Usage:
    python scripts/generate-logo-variants.py
    python scripts/generate-logo-variants.py --input public/images/some_other.png
    python scripts/generate-logo-variants.py --light-color #2a2118 --dark-color #ffffff

Idempotent — safe to re-run after updating the source PNG.

Requires:
    pip install Pillow
"""

import argparse
import os
import sys
from PIL import Image

DEFAULT_INPUT = "public/images/logo_millewee_transp.png"
DEFAULT_LIGHT_COLOR = "#1a1310"
DEFAULT_DARK_COLOR = "#f5f0e8"


def hex_to_rgb(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    if len(s) != 6:
        raise ValueError(f"Bad color: {s!r} (expected #rrggbb)")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def recolor(src: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Return a new RGBA image with every pixel's RGB replaced by `rgb`,
    keeping the source alpha channel intact. The shape stays exactly the
    same; only the color of the opaque pixels changes."""
    rgba = src.convert("RGBA")
    alpha = rgba.split()[3]
    solid = Image.new("RGB", rgba.size, rgb)
    solid.putalpha(alpha)
    return solid


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", default=DEFAULT_INPUT, help=f"source logo PNG (default: {DEFAULT_INPUT})")
    p.add_argument("--light-color", default=DEFAULT_LIGHT_COLOR, help=f"fg for light-mode variant (default: {DEFAULT_LIGHT_COLOR})")
    p.add_argument("--dark-color", default=DEFAULT_DARK_COLOR, help=f"fg for dark-mode variant (default: {DEFAULT_DARK_COLOR})")
    args = p.parse_args()

    if not os.path.isfile(args.input):
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    base, ext = os.path.splitext(args.input)
    light_out = f"{base}_light{ext}"
    dark_out = f"{base}_dark{ext}"

    light_rgb = hex_to_rgb(args.light_color)
    dark_rgb = hex_to_rgb(args.dark_color)

    src = Image.open(args.input)
    print(f"Source:  {args.input}  ({src.size[0]}x{src.size[1]})")

    recolor(src, light_rgb).save(light_out, "PNG")
    print(f"Wrote:   {light_out}  fg={args.light_color}  (used in light mode)")

    recolor(src, dark_rgb).save(dark_out, "PNG")
    print(f"Wrote:   {dark_out}  fg={args.dark_color}  (used in dark mode)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
