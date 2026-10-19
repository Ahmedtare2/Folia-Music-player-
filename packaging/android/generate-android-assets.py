#!/usr/bin/env python3
"""
Generates Android launcher icons (legacy, round, adaptive foreground) and splash screen
drawables from Folia's official build/icon.png artwork and #09090b brand theme.
"""

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE_ICON = ROOT / "build" / "icon.png"
RES_DIR = ROOT / "android" / "app" / "src" / "main" / "res"

THEME_BG_RGBA = (9, 9, 11, 255)  # #09090b

MIPMAP_SIZES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

SPLASH_PORT_SIZES = {
    "drawable": (480, 800, 144),
    "drawable-port-mdpi": (320, 480, 96),
    "drawable-port-hdpi": (480, 800, 144),
    "drawable-port-xhdpi": (720, 1280, 192),
    "drawable-port-xxhdpi": (960, 1600, 256),
    "drawable-port-xxxhdpi": (1280, 1920, 320),
}

SPLASH_LAND_SIZES = {
    "drawable-land-mdpi": (480, 320, 96),
    "drawable-land-hdpi": (800, 480, 144),
    "drawable-land-xhdpi": (1280, 720, 192),
    "drawable-land-xxhdpi": (1600, 960, 256),
    "drawable-land-xxxhdpi": (1920, 1280, 320),
}


def make_circle_masked(img: Image.Image, size: int) -> Image.Image:
    # build/icon.png has a 448x448 rounded rect inside a 512x512 canvas (32px inset).
    # Crop to the central 424x424 area so the circular disc is 100% filled by Folia's gradient.
    w, h = img.size
    crop_margin = int(round(w * (44.0 / 512.0)))
    cropped = img.crop((crop_margin, crop_margin, w - crop_margin, h - crop_margin))
    resized = cropped.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")

    scale = 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    draw = ImageDraw.Draw(mask)
    inset = int(round(size * scale * 0.03))
    draw.ellipse((inset, inset, size * scale - inset - 1, size * scale - inset - 1), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    alpha = resized.split()[3]
    resized.putalpha(ImageChops.multiply(alpha, mask))
    out.paste(resized, (0, 0))
    return out


def make_adaptive_foreground(img: Image.Image, fg_size: int) -> Image.Image:
    # Adaptive icon canvas is 108dp with a 66dp safe zone (61.1%).
    canvas = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
    glyph_box = int(round(fg_size * 0.62))
    resized = img.resize((glyph_box, glyph_box), Image.Resampling.LANCZOS).convert("RGBA")
    offset = (fg_size - glyph_box) // 2
    canvas.paste(resized, (offset, offset), resized)
    return canvas


def make_splash(img: Image.Image, width: int, height: int, icon_px: int) -> Image.Image:
    splash = Image.new("RGBA", (width, height), THEME_BG_RGBA)
    icon_resized = img.resize((icon_px, icon_px), Image.Resampling.LANCZOS).convert("RGBA")
    x = (width - icon_px) // 2
    y = (height - icon_px) // 2
    splash.paste(icon_resized, (x, y), icon_resized)
    return splash.convert("RGB")


def main() -> None:
    if not SOURCE_ICON.exists():
        raise FileNotFoundError(f"Missing Folia source icon: {SOURCE_ICON}")

    src = Image.open(SOURCE_ICON).convert("RGBA")

    for folder, (legacy_size, fg_size) in MIPMAP_SIZES.items():
        out_dir = RES_DIR / folder
        out_dir.mkdir(parents=True, exist_ok=True)

        legacy = src.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
        legacy.save(out_dir / "ic_launcher.png", format="PNG", optimize=True)

        round_icon = make_circle_masked(src, legacy_size)
        round_icon.save(out_dir / "ic_launcher_round.png", format="PNG", optimize=True)

        fg_icon = make_adaptive_foreground(src, fg_size)
        fg_icon.save(out_dir / "ic_launcher_foreground.png", format="PNG", optimize=True)

    nodpi_dir = RES_DIR / "drawable-nodpi"
    nodpi_dir.mkdir(parents=True, exist_ok=True)
    splash_icon = make_adaptive_foreground(src, 288)
    splash_icon.save(nodpi_dir / "splash_icon.png", format="PNG", optimize=True)

    for folder, (w, h, icon_px) in {**SPLASH_PORT_SIZES, **SPLASH_LAND_SIZES}.items():
        out_dir = RES_DIR / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        splash = make_splash(src, w, h, icon_px)
        splash.save(out_dir / "splash.png", format="PNG", optimize=True)

    print(f"[android-assets] Generated Folia launcher icons and splash screens in {RES_DIR}")


if __name__ == "__main__":
    main()
