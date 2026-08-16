from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH, HEIGHT = 1280, 320
FRAMES = 24
OUT = Path('/home/ubuntu/github-professional/uzme/assets/profile-banner.gif')

FONT_DIR = Path('/usr/share/fonts/truetype/dejavu')
FONT_BOLD = str(FONT_DIR / 'DejaVuSans-Bold.ttf')
FONT_REGULAR = str(FONT_DIR / 'DejaVuSans.ttf')


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def gradient_background() -> Image.Image:
    image = Image.new('RGB', (WIDTH, HEIGHT))
    pixels = image.load()
    left = (6, 47, 53)
    right = (16, 43, 69)
    for x in range(WIDTH):
        t = x / (WIDTH - 1)
        for y in range(HEIGHT):
            glow = max(0.0, 1 - (((x - 1040) / 260) ** 2 + ((y - 60) / 180) ** 2)) * 9
            pixels[x, y] = tuple(min(255, int(left[i] * (1 - t) + right[i] * t + glow)) for i in range(3))
    return image


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: tuple[int, int, int], size: int, bold: bool = False, spacing: int = 0) -> None:
    draw.text(xy, text, font=font(FONT_BOLD if bold else FONT_REGULAR, size), fill=fill, spacing=spacing)


def build_frame(index: int) -> Image.Image:
    image = gradient_background()
    draw = ImageDraw.Draw(image, 'RGBA')

    for x in range(0, WIDTH, 32):
        draw.line((x, 0, x, HEIGHT), fill=(180, 245, 229, 18), width=1)
    for y in range(0, HEIGHT, 32):
        draw.line((0, y, WIDTH, y), fill=(180, 245, 229, 18), width=1)

    draw.ellipse((945, -90, 1250, 215), fill=(73, 217, 186, 18))
    draw.ellipse((1015, -4, 1165, 146), outline=(117, 231, 205, 46), width=2)
    draw.arc((1020, 0, 1160, 140), start=(index * 15) % 360, end=((index * 15) % 360) + 120, fill=(117, 231, 205, 105), width=3)

    # Animated data traces.
    points1 = []
    points2 = []
    for x in range(25, 680, 8):
        y1 = 252 + int(18 * __import__('math').sin((x + index * 13) / 60))
        y2 = 286 + int(15 * __import__('math').sin((x + index * 10) / 52))
        points1.append((x, y1))
        points2.append((x, y2))
    draw.line(points1, fill=(131, 232, 208, 110), width=2)
    draw.line(points2, fill=(129, 207, 255, 88), width=2)
    for x in range(40 + (index * 9) % 18, 680, 28):
        draw.ellipse((x, 248, x + 3, 251), fill=(104, 224, 194, 180))

    # Main copy.
    draw.rounded_rectangle((62, 63, 70, 71), radius=2, fill=(104, 224, 194, 255))
    draw_text(draw, (86, 61), 'INDEPENDENT DEVELOPER / LAB-01', (145, 241, 216), 13, True)
    draw_text(draw, (62, 102), 'Bahromjon Mengliyev', (242, 255, 251), 47, True)
    glow_x = 62 + ((index * 22) % 510)
    draw.line((62, 206, min(572, glow_x + 175), 206), fill=(104, 224, 194, 220), width=3)
    draw_text(draw, (62, 225), 'AI PRODUCTS · WEB APPLICATIONS · AUTOMATION', (183, 247, 232), 17, True)
    draw_text(draw, (62, 264), 'Building quietly, shipping deliberately.', (208, 232, 237), 16)

    # Tech pills.
    pills = [('TYPESCRIPT', 122), ('REACT', 82), ('AI / MCP', 94)]
    px = 62
    for label, width in pills:
        draw.rounded_rectangle((px, 282, px + width, 310), radius=14, fill=(138, 232, 210, 38), outline=(138, 232, 210, 115), width=1)
        draw_text(draw, (px + 16, 290), label, (184, 255, 237), 10, True)
        px += width + 12

    # BioLab status panel.
    draw.rounded_rectangle((930, 46, 1216, 262), radius=20, fill=(3, 31, 43, 210), outline=(138, 232, 210, 90), width=1)
    draw_text(draw, (954, 68), 'BIO.LAB / STATUS', (138, 232, 210), 11, True)
    pulse = 145 + int(70 * (1 + __import__('math').sin(index / 3)) / 2)
    draw.ellipse((1168, 68, 1178, 78), fill=(104, 224, 194, pulse))
    draw_text(draw, (954, 101), '100', (242, 255, 251), 31, True)
    draw_text(draw, (954, 139), 'DEVICES', (143, 183, 186), 11, True)
    draw_text(draw, (1072, 101), '16', (242, 255, 251), 31, True)
    draw_text(draw, (1072, 139), 'SOP STEPS', (143, 183, 186), 11, True)
    draw.line((954, 166, 1192, 166), fill=(138, 232, 210, 52), width=1)
    draw_text(draw, (954, 188), 'SYSTEMS ONLINE', (183, 247, 232), 12, True)
    draw_text(draw, (954, 213), 'AI PRODUCTS', (143, 183, 186), 11)
    draw_text(draw, (1092, 213), 'READY', (104, 224, 194), 11, True)
    draw_text(draw, (954, 236), 'WEB / AUTOMATION', (143, 183, 186), 11)
    draw_text(draw, (1092, 236), 'ACTIVE', (104, 224, 194), 11, True)

    return image.convert('P', palette=Image.Palette.ADAPTIVE)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames = [build_frame(i) for i in range(FRAMES)]
    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=90, loop=0, optimize=True, disposal=2)
    print(f'created {OUT} ({OUT.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
