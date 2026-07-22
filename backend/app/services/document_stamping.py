import io
import os
from datetime import datetime

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.services.stamp import get_stamp_bytes, stamp_exists

FONT_REGISTERED = False
STAMPABLE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}

# digital_stamp.png (800x800) 기준 상대 좌표
STAMP_REF_SIZE = 800
STAMP_TEXT_COLOR = "#0F2645"
STAMP_LAYOUT = {
    "number_x": 0.375,  # "No." 뒤 빈칸 시작
    "number_y": 0.408,  # No. 가로선 위
    "number_max_width": 0.48,
    "number_font": 0.105,
    "number_font_offset": -4,
    "date_x": 0.50,  # 점선 가운데
    "date_y": 0.572,  # "......." 줄 바로 위
    "date_font": 0.095,
}


def is_stampable(file_path: str) -> bool:
    return os.path.splitext(file_path)[1].lower() in STAMPABLE_EXTENSIONS


def _register_font() -> str:
    global FONT_REGISTERED
    font_paths = [
        "C:/Windows/Fonts/malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("Korean", path))
                FONT_REGISTERED = True
                return "Korean"
            except Exception:
                continue
    FONT_REGISTERED = True
    return "Helvetica"


def _get_pil_font(size: int = 14):
    font_paths = [
        "C:/Windows/Fonts/malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _fit_pil_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    start_size: int,
    min_size: int = 8,
):
    size = start_size
    while size >= min_size:
        font = _get_pil_font(size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 1
    return _get_pil_font(min_size)


def _fit_pdf_font_size(
    font_name: str,
    text: str,
    max_width: float,
    start_size: float,
    min_size: float = 6,
) -> float:
    size = start_size
    while size >= min_size:
        if pdfmetrics.stringWidth(text, font_name, size) <= max_width:
            return size
        size -= 0.5
    return min_size


def _output_path(input_path: str, reception_number: str) -> str:
    directory = os.path.dirname(input_path)
    ext = os.path.splitext(input_path)[1].lower()
    safe_no = reception_number.replace("-", "_")
    return os.path.join(directory, f"stamped_{safe_no}{ext}")


def _date_str(received_at: datetime) -> str:
    return received_at.strftime("%Y.%m.%d")


def _stamp_text_positions(stamp_x: float, stamp_y: float, stamp_size: float):
    """도장 영역 기준 텍스트 좌표 (PDF: stamp_y는 하단)"""
    number_x = stamp_x + stamp_size * STAMP_LAYOUT["number_x"]
    number_y = stamp_y + stamp_size * (1 - STAMP_LAYOUT["number_y"])
    date_x = stamp_x + stamp_size * STAMP_LAYOUT["date_x"]
    date_y = stamp_y + stamp_size * (1 - STAMP_LAYOUT["date_y"])
    number_max_width = stamp_size * STAMP_LAYOUT["number_max_width"]
    number_font = stamp_size * STAMP_LAYOUT["number_font"] + STAMP_LAYOUT["number_font_offset"]
    date_font = stamp_size * STAMP_LAYOUT["date_font"]
    return number_x, number_y, date_x, date_y, number_max_width, number_font, date_font


def _draw_stamp_text_pdf(
    c: canvas.Canvas,
    stamp_x: float,
    stamp_y: float,
    stamp_size: float,
    reception_number: str,
    received_at: datetime,
):
    font_name = _register_font()
    number_x, number_y, date_x, date_y, max_w, num_fs, date_fs = _stamp_text_positions(
        stamp_x, stamp_y, stamp_size
    )
    date_text = _date_str(received_at)

    c.setFillColor(colors.HexColor(STAMP_TEXT_COLOR))
    num_size = _fit_pdf_font_size(font_name, reception_number, max_w, num_fs)
    c.setFont(font_name, num_size)
    c.drawString(number_x, number_y, reception_number)

    c.setFont(font_name, date_fs)
    c.drawCentredString(date_x, date_y, date_text)


def _draw_stamp_text_image(
    draw: ImageDraw.ImageDraw,
    stamp_x: int,
    stamp_y: int,
    stamp_size: int,
    reception_number: str,
    received_at: datetime,
):
    number_x = int(stamp_x + stamp_size * STAMP_LAYOUT["number_x"])
    number_y = int(stamp_y + stamp_size * STAMP_LAYOUT["number_y"])
    date_x = int(stamp_x + stamp_size * STAMP_LAYOUT["date_x"])
    date_y = int(stamp_y + stamp_size * STAMP_LAYOUT["date_y"])
    max_w = int(stamp_size * STAMP_LAYOUT["number_max_width"])
    num_fs = max(int(stamp_size * STAMP_LAYOUT["number_font"]) + STAMP_LAYOUT["number_font_offset"], 8)
    date_fs = max(int(stamp_size * STAMP_LAYOUT["date_font"]), 8)
    date_text = _date_str(received_at)
    color = (15, 38, 69, 255)

    num_font = _fit_pil_font(draw, reception_number, max_w, num_fs)
    num_bbox = draw.textbbox((0, 0), reception_number, font=num_font)
    num_h = num_bbox[3] - num_bbox[1]
    draw.text((number_x, number_y - num_h), reception_number, fill=color, font=num_font)

    date_font = _get_pil_font(date_fs)
    date_bbox = draw.textbbox((0, 0), date_text, font=date_font)
    date_w = date_bbox[2] - date_bbox[0]
    date_h = date_bbox[3] - date_bbox[1]
    draw.text((date_x - date_w // 2, date_y - date_h), date_text, fill=color, font=date_font)


def _create_pdf_overlay(
    page_width: float,
    page_height: float,
    reception_number: str,
    received_at: datetime,
):
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=(page_width, page_height))

    margin = 15 * mm
    stamp_size = 42 * mm
    x = page_width - margin - stamp_size
    y = margin

    if stamp_exists():
        try:
            stamp_bytes = get_stamp_bytes()
            if stamp_bytes:
                c.drawImage(
                    ImageReader(io.BytesIO(stamp_bytes)),
                    x,
                    y,
                    width=stamp_size,
                    height=stamp_size,
                    preserveAspectRatio=True,
                    mask="auto",
                )
                _draw_stamp_text_pdf(c, x, y, stamp_size, reception_number, received_at)
            else:
                _draw_default_pdf_stamp(
                    c, x + stamp_size / 2, y + stamp_size / 2, reception_number, received_at
                )
        except Exception:
            _draw_default_pdf_stamp(c, x + stamp_size / 2, y + stamp_size / 2, reception_number, received_at)
    else:
        _draw_default_pdf_stamp(c, x + stamp_size / 2, y + stamp_size / 2, reception_number, received_at)

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]


def _draw_default_pdf_stamp(
    c: canvas.Canvas,
    cx: float,
    cy: float,
    reception_number: str,
    received_at: datetime,
):
    radius = 18 * mm
    c.saveState()
    c.setStrokeColor(colors.red)
    c.setLineWidth(1.5)
    c.circle(cx, cy, radius, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.red)
    c.drawCentredString(cx, cy + 4 * mm, "접 수")
    c.drawCentredString(cx, cy - 2 * mm, "완 료")
    c.restoreState()

    font_name = _register_font()
    c.setFillColor(colors.HexColor(STAMP_TEXT_COLOR))
    c.setFont(font_name, 8)
    c.drawCentredString(cx, cy - radius - 6 * mm, reception_number)
    c.drawCentredString(cx, cy - radius - 14 * mm, _date_str(received_at))


def _stamp_pdf(input_path: str, reception_number: str, received_at: datetime) -> str:
    with open(input_path, "rb") as source:
        pdf_bytes = source.read()
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if not reader.pages:
        raise ValueError("PDF 페이지가 없습니다.")

    first = reader.pages[0]
    width = float(first.mediabox.width)
    height = float(first.mediabox.height)
    overlay = _create_pdf_overlay(width, height, reception_number, received_at)
    first.merge_page(overlay)

    writer = PdfWriter()
    writer.add_page(first)
    for page in reader.pages[1:]:
        writer.add_page(page)

    output_path = _output_path(input_path, reception_number)
    with open(output_path, "wb") as f:
        writer.write(f)
    return output_path


def _draw_default_image_stamp(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    radius: int,
    reception_number: str,
    received_at: datetime,
):
    draw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        outline=(200, 0, 0, 255),
        width=3,
    )
    font = _get_pil_font(16)
    draw.text((cx - 22, cy - 18), "접수", fill=(200, 0, 0, 255), font=font)
    draw.text((cx - 22, cy + 2), "완료", fill=(200, 0, 0, 255), font=font)

    small = _get_pil_font(12)
    color = (15, 38, 69, 255)
    for i, text in enumerate([reception_number, _date_str(received_at)]):
        bbox = draw.textbbox((0, 0), text, font=small)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, cy + radius + 8 + i * 16), text, fill=color, font=small)


def _stamp_image(input_path: str, reception_number: str, received_at: datetime) -> str:
    with Image.open(input_path) as opened:
        base = opened.convert("RGBA")
    width, height = base.size

    margin = max(int(min(width, height) * 0.03), 24)
    stamp_size = max(int(min(width, height) * 0.14), 80)
    x = width - margin - stamp_size
    y = height - margin - stamp_size

    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if stamp_exists():
        stamp_bytes = get_stamp_bytes()
        if stamp_bytes:
            stamp_img = Image.open(io.BytesIO(stamp_bytes)).convert("RGBA")
            stamp_img = stamp_img.resize((stamp_size, stamp_size), Image.Resampling.LANCZOS)
            overlay.paste(stamp_img, (x, y), stamp_img)
            _draw_stamp_text_image(draw, x, y, stamp_size, reception_number, received_at)
        else:
            _draw_default_image_stamp(
                draw, x + stamp_size // 2, y + stamp_size // 2, stamp_size // 2 - 4,
                reception_number, received_at,
            )
    else:
        _draw_default_image_stamp(
            draw, x + stamp_size // 2, y + stamp_size // 2, stamp_size // 2 - 4,
            reception_number, received_at,
        )

    result = Image.alpha_composite(base, overlay)
    output_path = _output_path(input_path, reception_number)

    ext = os.path.splitext(output_path)[1].lower()
    if ext in {".jpg", ".jpeg"}:
        result.convert("RGB").save(output_path, quality=95)
    else:
        result.save(output_path)

    return output_path


def stamp_document_first_page(
    input_path: str,
    reception_number: str,
    received_at: datetime,
) -> str | None:
    if not os.path.isfile(input_path) or not is_stampable(input_path):
        return None

    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".pdf":
        return _stamp_pdf(input_path, reception_number, received_at)
    return _stamp_image(input_path, reception_number, received_at)
