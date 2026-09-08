"""Turn a black-background render into a floating 'projection' (RGBA WebP).

Black -> transparent, with two guards against the faint "box" that plain
luminance keying produces:
  1. noise-aware: isolated near-black specks are dropped unless their
     neighbourhood also carries light (spatial coherence),
  2. gentle un-premultiply: dim pixels are brightened at most 3x, not blown to
     full white, so residual haze can't read as a light rectangle.

usage: python to_projection.py <src.png> <out.webp> [more src out pairs]
"""
import sys, numpy as np
from PIL import Image, ImageFilter

LO, HI = 30, 76          # noise floor / full-opacity point (0-255 max(R,G,B))

def convert(src, out):
    im = Image.open(src).convert("RGB")
    im.thumbnail((1280, 1280), Image.LANCZOS)
    rgb = np.asarray(im).astype(np.float32)
    m = rgb.max(axis=2)
    # base alpha: 0 below LO, ramps LO..HI, then follows brightness
    a = np.where(m <= LO, 0.0, np.where(m < HI, (m - LO) * HI / (HI - LO), m))
    # spatial coherence: blur the alpha; lonely specks have a dark neighbourhood
    blur = np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(5))).astype(np.float32)
    coh = np.clip((blur - 6.0) / 34.0, 0.0, 1.0)
    strong = np.clip((a - 60.0) / 40.0, 0.0, 1.0)          # bright pixels keep themselves
    a = a * (strong + (1.0 - strong) * coh)
    # colour: un-premultiply, capped
    scale = np.where(m > 0, np.minimum(255.0 / np.maximum(m, 1.0), 3.0), 0.0)
    col = np.clip(rgb * scale[..., None], 0, 255)
    rgba = np.dstack([col, np.clip(a, 0, 255)]).astype(np.uint8)
    rgba[a <= 0.5] = 0
    Image.fromarray(rgba, "RGBA").save(out, "WEBP", quality=72, method=6)
    return rgba.shape[1], rgba.shape[0]

if __name__ == "__main__":
    args = sys.argv[1:]
    for s, o in zip(args[::2], args[1::2]):
        print(o, convert(s, o))
