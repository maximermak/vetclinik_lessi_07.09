#!/usr/bin/env python3
"""
Збирає друкарські макети візитки «Лессі».

    python3 brand/vizytka/build.py

Що робить: генерує QR, рендерить обидві сторони в Chrome, переводить
у CMYK за профілем CoatedFOGRA39 і зберігає PDF / TIF / JPG.

Вимоги друкарні, під які все зроблено:
  · дообрізний розмір 94×54 мм = 1110×638 px при 300 dpi;
  · виліт на підріз 2 мм (24 px) з кожного боку;
  · інформаційна частина не ближче 5 мм (59 px) до краю;
  · CMYK, профіль CoatedFOGRA39 / ISO Coated v2;
  · без міток різу, без прозорості, шрифти в кривих
    (текст растрований, тож живих шрифтів у файлах немає взагалі);
  · TIF без стиснення й без альфа-каналу, JPG стандартний.

Потрібні: Pillow, segno, Google Chrome. Для перевірки QR — opencv (не обов'язково).
"""
import os
import subprocess
import sys

import segno
from PIL import Image, ImageCms

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
OUT = os.path.join(HERE, "out")

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CMYK_ICC = "/Library/Application Support/Adobe/Color/Profiles/Recommended/CoatedFOGRA39.icc"
SRGB_ICC = "/System/Library/ColorSync/Profiles/sRGB Profile.icc"

URL = "https://lessivet.com.ua/qr"
W, H = 1110, 638           # 94×54 мм при 300 dpi
BLEED, SAFE = 24, 59       # 2 мм і 5 мм у пікселях

SIDES = {"front": "lice", "back": "zvorot"}


def build_qr():
    """41 модуль × 8 px = рівно 328 px: модуль займає ціле число пікселів,
    тож краї виходять різкими. Корекція H — код читається навіть
    частково затертим."""
    qr = segno.make(URL, error="h")
    qr.save(os.path.join(SRC, "qr.png"), scale=8, border=4,
            dark="#000000", light="#ffffff")
    side = qr.symbol_size(scale=8, border=4)[0]
    print(f"QR: версія {qr.version}, {side}px = {side / 300 * 25.4:.1f} мм")


def render(side):
    png = os.path.join(SRC, f"{side}_rgb.png")
    subprocess.run([
        CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--virtual-time-budget=8000",
        f"--window-size={W},{H}", f"--screenshot={png}",
        "file://" + os.path.join(SRC, f"{side}.html"),
    ], check=True, capture_output=True)
    im = Image.open(png)
    assert im.size == (W, H), f"{side}: очікували {W}×{H}, отримали {im.size}"
    return im.convert("RGB")


def qr_region(rgb):
    """QR — єдине місце з чисто чорним: текст має колір #16211d."""
    px = rgb.load()
    xs, ys = [], []
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            if px[x, y] == (0, 0, 0):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    pad = 26
    return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)


def to_cmyk(rgb, transform):
    cmyk = ImageCms.applyTransform(rgb, transform)
    box = qr_region(rgb)
    if box:
        # QR друкуємо однією чорною фарбою. Після переводу в CMYK чистий
        # чорний стає складеним з чотирьох фарб, а найменший їх незбіг
        # на друці розмиває краї модулів — код гірше сканується.
        x0, y0, x1, y1 = box
        gray = rgb.convert("L").crop((x0, y0, x1 + 1, y1 + 1)).load()
        patch = cmyk.crop((x0, y0, x1 + 1, y1 + 1))
        pp = patch.load()
        for yy in range(patch.size[1]):
            for xx in range(patch.size[0]):
                pp[xx, yy] = (0, 0, 0, 255) if gray[xx, yy] < 128 else (0, 0, 0, 0)
        cmyk.paste(patch, (x0, y0))
        print(f"  QR переведено в одну фарбу: {x0},{y0}–{x1},{y1}")
    return cmyk


def main():
    if not os.path.exists(CMYK_ICC):
        sys.exit(f"Немає профілю {CMYK_ICC}")
    os.makedirs(OUT, exist_ok=True)

    build_qr()
    transform = ImageCms.buildTransform(
        ImageCms.getOpenProfile(SRGB_ICC), ImageCms.getOpenProfile(CMYK_ICC),
        "RGB", "CMYK",
        renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
        flags=ImageCms.Flags.BLACKPOINTCOMPENSATION,
    )
    icc = open(CMYK_ICC, "rb").read()

    for side, name in SIDES.items():
        print(f"{side}:")
        cmyk = to_cmyk(render(side), transform)
        base = os.path.join(OUT, f"lessi-vizytka-{name}")
        cmyk.save(base + ".tif", compression=None, dpi=(300, 300), icc_profile=icc)
        cmyk.save(base + ".jpg", quality=100, subsampling=0, dpi=(300, 300), icc_profile=icc)
        cmyk.save(base + ".pdf", resolution=300.0, title="Vizytka Lessi")
        print(f"  готово: {base}.[pdf|tif|jpg]")


if __name__ == "__main__":
    main()
