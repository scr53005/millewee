"""
Millewee QR Code Sticker Generator

Generates print-ready QR code stickers for restaurant tables.
Each sticker contains:
  - Millewee logo (top)
  - "Table: X" label (vector text)
  - QR code with Innopay logo overlay
  - "Scan to order!" speech bubble (vector text)
  - URL in small text (vector text, bottom)

Uses segno for QR generation, Pillow for raster composition,
reportlab for PDF output with vector text.

Usage:
  python generateqrs.py              # all tables → PDF
  python generateqrs.py --t          # test mode (last 5 tables)
  python generateqrs.py --check-fonts  # validate font registration only

Prerequisites:
  pip install segno Pillow reportlab

Input files (auto-detected from script directory):
  - {prefix}uri.txt        → base URL
  - {prefix}tables.csv     → table numbers (one per line)
  - logo_millewee_transp.png
  - innologo-71x47.png
"""

import segno
from PIL import Image
import os
import sys
import re
import io

from reportlab.lib.units import cm, mm
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Sticker layout constants (in cm, converted to points by reportlab) ───

# Target sticker: 6.5cm x 5.0cm → 5x3 grid on A4 landscape
STICKER_W_CM = 5.0
STICKER_H_CM = 6.5

# PDF page: A4 landscape
PAGE_W_CM = 29.7
PAGE_H_CM = 21.0
MARGIN_CM = 0.5

# Grid layout
COLS = 5
ROWS = 3

# Colors (Millewee brand) — reportlab uses 0-1 floats
BG_COLOR = Color(250/255, 246/255, 240/255)       # warm cream #faf6f0
TEXT_COLOR = Color(42/255, 31/255, 23/255)         # dark leather #2a1f17
AMBER = Color(212/255, 162/255, 78/255)            # primary amber #d4a24e
DARK_BROWN = Color(26/255, 19/255, 16/255)         # #1a1310

# Sticker-internal layout (relative to sticker origin, in cm)
LOGO_Y_FROM_TOP = 0.20
LOGO_MAX_H = 0.90
TABLE_TEXT_Y_FROM_TOP = 1.42
RULE_Y_OFFSET = 0.15       # below table text baseline
QR_Y_FROM_TOP = 2.40
QR_SIZE_CM = 3.60
URL_Y_FROM_BOTTOM = 0.22
BUBBLE_Y_ABOVE_QR = 0.55

# Font configuration — edit these for different spokes
FONT_FILE = "C:/Windows/Fonts/Sitka.ttc"
FONT_NAME = "Sitka"
FONT_SUBFONT_INDEX = 0


def register_fonts(check_only=False):
    """Register fonts with reportlab. Returns True on success."""
    fonts_to_register = [
        (FONT_NAME, FONT_FILE, FONT_SUBFONT_INDEX),
    ]

    all_ok = True
    for name, path, index in fonts_to_register:
        if not os.path.exists(path):
            print(f"  FAIL  Font file not found: {path}")
            all_ok = False
            continue
        try:
            pdfmetrics.registerFont(TTFont(name, path, subfontIndex=index))
            print(f"  OK    '{name}' registered from {path} (subfont index {index})")
        except Exception as e:
            print(f"  FAIL  '{name}' from {path}: {e}")
            all_ok = False

    if check_only:
        if all_ok:
            print("\nAll fonts OK. Ready to generate.")
        else:
            print("\nSome fonts failed. Fix before generating.")
    return all_ok


def generate_qr_image(url, qr_size_px, inno_logo_path):
    """Generate a QR code PNG (with Innopay logo overlay) as bytes."""
    qr = segno.make(url, error="H")

    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=10, border=0, dark="#2a1f17", light="#ffffff")
    buf.seek(0)
    qr_img = Image.open(buf).convert("RGBA")
    qr_img = qr_img.resize((qr_size_px, qr_size_px), Image.LANCZOS)

    if os.path.exists(inno_logo_path):
        logo = Image.open(inno_logo_path).convert("RGBA")
        logo_max = int(qr_size_px * 0.22)
        logo_ratio = min(logo_max / logo.width, logo_max / logo.height)
        logo_w = int(logo.width * logo_ratio)
        logo_h = int(logo.height * logo_ratio)
        logo = logo.resize((logo_w, logo_h), Image.LANCZOS)

        pad = 8
        white_bg = Image.new("RGBA", (logo_w + pad * 2, logo_h + pad * 2), (255, 255, 255, 255))
        lx = (qr_size_px - white_bg.width) // 2
        ly = (qr_size_px - white_bg.height) // 2
        qr_img.paste(white_bg, (lx, ly))
        qr_img.paste(logo, (lx + pad, ly + pad), logo)

    # Return as PNG bytes
    out = io.BytesIO()
    qr_img.convert("RGB").save(out, "PNG", dpi=(600, 600))
    out.seek(0)
    return out


def draw_speech_bubble(c, text, cx, cy, font_name, font_size):
    """Draw a speech bubble with tail pointing down. cx,cy = center-bottom of bubble body."""
    text_w = pdfmetrics.stringWidth(text, font_name, font_size)
    pad_x = 2 * mm
    pad_y = 1.2 * mm
    bw = text_w + pad_x * 2
    bh = font_size + pad_y * 2
    radius = 2.5 * mm
    tail_h = 2.5 * mm

    # Bubble body — rounded rect centered on cx, sitting above cy
    bx = cx - bw / 2
    by = cy  # bottom of bubble body

    c.saveState()

    # Rotate slightly for playfulness (4 degrees around bubble center)
    bcx = bx + bw / 2
    bcy = by + bh / 2
    c.translate(bcx, bcy)
    c.rotate(4)
    c.translate(-bcx, -bcy)

    # Fill
    c.setFillColor(AMBER)
    c.setStrokeColor(DARK_BROWN)
    c.setLineWidth(0.5)
    c.roundRect(bx, by, bw, bh, radius, fill=1, stroke=1)

    # Tail (triangle pointing down from center-bottom)
    tail_cx = cx
    c.setFillColor(AMBER)
    c.setStrokeColor(DARK_BROWN)
    p = c.beginPath()
    p.moveTo(tail_cx - 1.5 * mm, by + 0.3)
    p.lineTo(tail_cx + 0.8 * mm, by - tail_h)
    p.lineTo(tail_cx + 2.5 * mm, by + 0.3)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    # Tail outline (just the two outer edges)
    c.setLineWidth(0.5)
    c.line(tail_cx - 1.5 * mm, by, tail_cx + 0.8 * mm, by - tail_h)
    c.line(tail_cx + 0.8 * mm, by - tail_h, tail_cx + 2.5 * mm, by)

    # Text
    c.setFillColor(DARK_BROWN)
    c.setFont(font_name, font_size)
    c.drawCentredString(cx, by + pad_y, text)

    c.restoreState()


def draw_sticker(c, x, y, table_num, base_uri, millewee_logo_path, inno_logo_path):
    """
    Draw one sticker on the canvas.
    x, y = bottom-left corner of sticker in page coordinates (points).
    """
    w = STICKER_W_CM * cm
    h = STICKER_H_CM * cm

    # ─── Background fill ───
    c.setFillColor(BG_COLOR)
    c.roundRect(x + 1, y + 1, w - 2, h - 2, 5 * mm, fill=1, stroke=0)

    # ─── Amber border ───
    c.setStrokeColor(AMBER)
    c.setLineWidth(0.8)
    c.roundRect(x + 1, y + 1, w - 2, h - 2, 5 * mm, fill=0, stroke=1)

    # ─── Millewee logo (centered, top) ───
    if os.path.exists(millewee_logo_path):
        logo_img = Image.open(millewee_logo_path)
        logo_aspect = logo_img.width / logo_img.height
        logo_h_pt = LOGO_MAX_H * cm
        logo_w_pt = logo_h_pt * logo_aspect
        max_w = w - 1.0 * cm
        if logo_w_pt > max_w:
            logo_w_pt = max_w
            logo_h_pt = logo_w_pt / logo_aspect

        logo_x = x + (w - logo_w_pt) / 2
        logo_y = y + h - LOGO_Y_FROM_TOP * cm - logo_h_pt
        c.drawImage(millewee_logo_path, logo_x, logo_y, logo_w_pt, logo_h_pt,
                     preserveAspectRatio=True, mask='auto')

    # ─── "Table: X" text (vector, centered) ───
    table_text = f"Table:  {table_num}"
    font_size_table = 13
    c.setFont(FONT_NAME, font_size_table)
    c.setFillColor(TEXT_COLOR)
    text_y = y + h - TABLE_TEXT_Y_FROM_TOP * cm
    c.drawCentredString(x + w / 2, text_y, table_text)

    # ─── Thin amber rule below "Table:" ───
    rule_y = text_y - RULE_Y_OFFSET * cm
    rule_margin = 1.7 * cm
    c.setStrokeColor(AMBER)
    c.setLineWidth(0.5)
    c.line(x + rule_margin, rule_y, x + w - rule_margin, rule_y)

    # ─── QR code (raster image, centered) ───
    qr_size_pt = QR_SIZE_CM * cm
    qr_x = x + (w - qr_size_pt) / 2
    qr_y = y + h - QR_Y_FROM_TOP * cm - qr_size_pt

    full_url = f"{base_uri}{table_num}"
    qr_bytes = generate_qr_image(full_url, 850, inno_logo_path)  # 600 DPI for 3.6cm

    from reportlab.lib.utils import ImageReader
    qr_reader = ImageReader(qr_bytes)
    c.drawImage(qr_reader, qr_x, qr_y, qr_size_pt, qr_size_pt)

    # ─── Speech bubble "Scan to order!" (vector, above QR left side) ───
    bubble_cx = qr_x + qr_size_pt * 0.35
    bubble_bottom = qr_y + qr_size_pt + BUBBLE_Y_ABOVE_QR * cm
    draw_speech_bubble(c, "Scan to order!", bubble_cx, bubble_bottom - 3 * mm,
                       FONT_NAME, 6)

    # ─── URL text (vector, small, centered below QR) ───
    url_display = f"https://millewee.innopay.lu/?table={table_num}"
    font_size_url = 5.5
    c.setFont(FONT_NAME, font_size_url)
    c.setFillColor(TEXT_COLOR)
    url_y = y + URL_Y_FROM_BOTTOM * cm
    c.drawCentredString(x + w / 2, url_y, url_display)


def generate_all(uri_file, tables_file, script_dir, test_mode=False):
    """Main generation pipeline."""

    # Register fonts
    print("Registering fonts...")
    if not register_fonts():
        print("\nFont registration failed. Run with --check-fonts for details.")
        sys.exit(1)

    # Read inputs
    with open(uri_file, "r", encoding="utf-8-sig") as f:
        base_uri = f.read().strip()

    with open(tables_file, "r", encoding="utf-8-sig") as f:
        table_numbers = [line.strip() for line in f if line.strip()]

    if test_mode:
        table_numbers = table_numbers[-6:]
        print(f"Test mode: {len(table_numbers)} tables only.")

    # Paths
    millewee_logo = os.path.join(script_dir, "logo_millewee_transp.png")
    inno_logo = os.path.join(script_dir, "innologo-71x47.png")
    output_dir = os.path.join(script_dir, "output_qrs")
    os.makedirs(output_dir, exist_ok=True)

    print(f"\nGenerating {len(table_numbers)} stickers...\n")

    # ─── PDF generation ───
    per_page = COLS * ROWS
    suffix = "_test" if test_mode else ""
    pdf_path = os.path.join(output_dir, f"Millewee_QR_Stickers{suffix}.pdf")

    page_w = PAGE_W_CM * cm
    page_h = PAGE_H_CM * cm
    margin = MARGIN_CM * cm
    sticker_w = STICKER_W_CM * cm
    sticker_h = STICKER_H_CM * cm

    # Calculate spacing to distribute stickers evenly
    usable_w = page_w - 2 * margin
    usable_h = page_h - 2 * margin
    gap_x = (usable_w - COLS * sticker_w) / max(COLS - 1, 1)
    gap_y = (usable_h - ROWS * sticker_h) / max(ROWS - 1, 1)

    c_pdf = canvas.Canvas(pdf_path, pagesize=(page_w, page_h))
    c_pdf.setTitle("Millewee QR Stickers")

    for page_start in range(0, len(table_numbers), per_page):
        page_tables = table_numbers[page_start:page_start + per_page]

        for idx, table_num in enumerate(page_tables):
            col = idx % COLS
            row = idx // COLS

            # reportlab origin is bottom-left; row 0 should be at top
            sx = margin + col * (sticker_w + gap_x)
            sy = page_h - margin - sticker_h - row * (sticker_h + gap_y)

            draw_sticker(c_pdf, sx, sy, table_num, base_uri,
                         millewee_logo, inno_logo)
            print(f"  OK Table {table_num}")

        if page_start + per_page < len(table_numbers):
            c_pdf.showPage()

    # Save with retry (in case file is open)
    while True:
        try:
            c_pdf.save()
            print(f"\nOK PDF saved: {pdf_path}")
            break
        except PermissionError:
            print(f"\nCannot save '{pdf_path}' — close it in your PDF viewer first.")
            input("Press Enter to retry...")

    # ─── Also save individual PNGs for preview ───
    print("\nGenerating preview PNGs...")
    from PIL import ImageDraw, ImageFont

    def load_font(name, size, index=0):
        for font_name in [name, "arial.ttf", "Arial.ttf"]:
            try:
                return ImageFont.truetype(font_name, size, index=index)
            except (IOError, OSError):
                continue
        return ImageFont.load_default()

    DPI = 300
    STK_W_PX = int(STICKER_W_CM / 2.54 * DPI)
    STK_H_PX = int(STICKER_H_CM / 2.54 * DPI)

    font_table = load_font(FONT_FILE, 38, FONT_SUBFONT_INDEX)
    font_url = load_font(FONT_FILE, 19, FONT_SUBFONT_INDEX)
    font_bubble = load_font(FONT_FILE, 19, FONT_SUBFONT_INDEX)

    BG_RGB = (250, 246, 240)
    TEXT_RGB = (42, 31, 23)
    AMBER_RGB = (212, 162, 78)
    DARK_BROWN_RGB = (26, 19, 16)

    for table_num in table_numbers:
        full_url = f"{base_uri}{table_num}"
        img = Image.new("RGB", (STK_W_PX, STK_H_PX), BG_RGB)
        draw = ImageDraw.Draw(img)

        # Border
        draw.rounded_rectangle([4, 4, STK_W_PX - 5, STK_H_PX - 5],
                               radius=20, outline=AMBER_RGB, width=3)

        # Logo
        if os.path.exists(millewee_logo):
            logo = Image.open(millewee_logo).convert("RGBA")
            logo_max_h_px = int(LOGO_MAX_H / 2.54 * DPI)
            ratio = min(logo_max_h_px / logo.height, (STK_W_PX - 40) / logo.width)
            lw, lh = int(logo.width * ratio), int(logo.height * ratio)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            logo_x = (STK_W_PX - lw) // 2
            logo_y = int(LOGO_Y_FROM_TOP / 2.54 * DPI)
            temp = Image.new("RGBA", img.size, (0, 0, 0, 0))
            temp.paste(logo, (logo_x, logo_y), logo)
            img = Image.alpha_composite(img.convert("RGBA"), temp).convert("RGB")
            draw = ImageDraw.Draw(img)

        # Table text
        table_text = f"Table:  {table_num}"
        bbox = draw.textbbox((0, 0), table_text, font=font_table)
        tw = bbox[2] - bbox[0]
        tty = int(TABLE_TEXT_Y_FROM_TOP / 2.54 * DPI)
        draw.text(((STK_W_PX - tw) // 2, tty), table_text, font=font_table, fill=TEXT_RGB)

        # Rule
        line_y = tty + (bbox[3] - bbox[1]) + 8
        lm = int(1.7 / 2.54 * DPI)
        draw.line([(lm, line_y), (STK_W_PX - lm, line_y)], fill=AMBER_RGB, width=2)

        # QR
        qr_size_px = int(QR_SIZE_CM / 2.54 * DPI)
        qr_x = (STK_W_PX - qr_size_px) // 2
        qr_y = int(QR_Y_FROM_TOP / 2.54 * DPI)
        qr_bytes = generate_qr_image(full_url, qr_size_px, inno_logo)
        qr_img = Image.open(qr_bytes).convert("RGB")
        img.paste(qr_img, (qr_x, qr_y))

        # Speech bubble (simplified for PNG preview — just the text, no rotation)
        bubble_text = "Scan to order!"
        bb = draw.textbbox((0, 0), bubble_text, font=font_bubble)
        btw = bb[2] - bb[0]
        bth = bb[3] - bb[1]
        pad = 10
        bcx = qr_x + int(qr_size_px * 0.35)
        bby = qr_y - 18
        bx1 = bcx - btw // 2 - pad
        by1 = bby - bth - pad * 2
        bx2 = bcx + btw // 2 + pad
        by2 = bby
        draw.rounded_rectangle([bx1, by1, bx2, by2], radius=10,
                               fill=AMBER_RGB, outline=DARK_BROWN_RGB, width=2)
        # Tail
        tcx = bcx
        draw.polygon([(tcx - 6, by2 - 1), (tcx + 3, by2 + 10), (tcx + 10, by2 - 1)],
                     fill=AMBER_RGB)
        draw.line([(tcx - 6, by2), (tcx + 3, by2 + 10)], fill=DARK_BROWN_RGB, width=2)
        draw.line([(tcx + 3, by2 + 10), (tcx + 10, by2)], fill=DARK_BROWN_RGB, width=2)
        draw.text((bx1 + pad, by1 + pad - 2), bubble_text, font=font_bubble, fill=DARK_BROWN_RGB)

        # URL
        url_display = f"https://millewee.innopay.lu/?table={table_num}"
        bbox = draw.textbbox((0, 0), url_display, font=font_url)
        uw = bbox[2] - bbox[0]
        url_y = STK_H_PX - int(URL_Y_FROM_BOTTOM / 2.54 * DPI) - (bbox[3] - bbox[1])
        draw.text(((STK_W_PX - uw) // 2, url_y), url_display, font=font_url, fill=TEXT_RGB)

        out_path = os.path.join(output_dir, f"table_{table_num.zfill(2)}.png")
        img.save(out_path, "PNG", dpi=(DPI, DPI))

    print(f"\nDone! {len(table_numbers)} stickers.")
    print(f"  PDF (for printer):  {pdf_path}")
    print(f"  PNGs (for preview): {output_dir}/")


# ─── Auto-discover and run ───

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # --check-fonts: validate font registration and exit
    if "--check-fonts" in sys.argv:
        print("Checking font registration...\n")
        register_fonts(check_only=True)
        sys.exit(0)

    uri_pattern = re.compile(r"^([a-z0-9]+)uri\.txt$", re.IGNORECASE)

    prefix = None
    uri_file = None
    for filename in os.listdir(script_dir):
        match = uri_pattern.match(filename)
        if match:
            prefix = match.group(1)
            uri_file = os.path.join(script_dir, filename)
            break

    if uri_file is None:
        print("Error: no <prefix>uri.txt found in script directory.")
        sys.exit(1)

    print(f"Detected prefix: '{prefix}'")
    tables_file = os.path.join(script_dir, f"{prefix}tables.csv")

    test_mode = "--t" in sys.argv
    if test_mode:
        print("Test mode enabled (--t)")

    generate_all(uri_file, tables_file, script_dir, test_mode=test_mode)
