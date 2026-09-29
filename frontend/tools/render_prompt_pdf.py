from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "Prompt_Antigravity_Thiet_ke_lai_Ban_quan_tri.md"
OUTPUT = ROOT / "docs" / "Prompt_Antigravity_Thiet_ke_lai_Ban_quan_tri.pdf"

FONT_DIR = Path(r"C:\Windows\Fonts")
pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Italic", str(FONT_DIR / "ariali.ttf")))


def escape_and_format(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r'<font name="Arial-Bold" color="#174C3A">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r'<font name="Arial-Bold">\1</font>', text)
    return text


styles = getSampleStyleSheet()
title = ParagraphStyle(
    "TitleCustom",
    parent=styles["Title"],
    fontName="Arial-Bold",
    fontSize=23,
    leading=29,
    textColor=colors.HexColor("#173C31"),
    alignment=TA_CENTER,
    spaceAfter=8 * mm,
)
subtitle = ParagraphStyle(
    "SubtitleCustom",
    parent=styles["Heading2"],
    fontName="Arial-Bold",
    fontSize=15,
    leading=20,
    textColor=colors.HexColor("#B27B25"),
    alignment=TA_CENTER,
    spaceAfter=10 * mm,
)
h2 = ParagraphStyle(
    "H2Custom",
    parent=styles["Heading2"],
    fontName="Arial-Bold",
    fontSize=15,
    leading=20,
    textColor=colors.HexColor("#174C3A"),
    spaceBefore=6 * mm,
    spaceAfter=2.5 * mm,
    keepWithNext=True,
)
h3 = ParagraphStyle(
    "H3Custom",
    parent=styles["Heading3"],
    fontName="Arial-Bold",
    fontSize=12,
    leading=16,
    textColor=colors.HexColor("#7C571D"),
    spaceBefore=4 * mm,
    spaceAfter=1.5 * mm,
    keepWithNext=True,
)
body = ParagraphStyle(
    "BodyCustom",
    parent=styles["BodyText"],
    fontName="Arial",
    fontSize=9.4,
    leading=14,
    textColor=colors.HexColor("#27322E"),
    spaceAfter=2.4 * mm,
)
bullet = ParagraphStyle(
    "BulletCustom",
    parent=body,
    leftIndent=6 * mm,
    firstLineIndent=-3.8 * mm,
    bulletIndent=1.2 * mm,
    spaceAfter=1.6 * mm,
)
numbered = ParagraphStyle(
    "NumberedCustom",
    parent=body,
    leftIndent=7 * mm,
    firstLineIndent=-5 * mm,
    spaceAfter=1.6 * mm,
)


def footer(canvas, doc):
    canvas.saveState()
    w, _ = A4
    canvas.setStrokeColor(colors.HexColor("#D7DED9"))
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFont("Arial", 8)
    canvas.setFillColor(colors.HexColor("#6B756F"))
    canvas.drawString(18 * mm, 9 * mm, "Đường Sách TP.HCM — Prompt triển khai cho Antigravity")
    canvas.drawRightString(w - 18 * mm, 9 * mm, f"Trang {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=17 * mm,
    bottomMargin=19 * mm,
    title="Prompt Antigravity — Thiết kế lại Cổng Ban Quản Lý Đường Sách TP.HCM",
    author="Codex",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])

story = []
lines = SOURCE.read_text(encoding="utf-8").splitlines()
first_title = True
for raw in lines:
    line = raw.strip()
    if not line:
        story.append(Spacer(1, 1.3 * mm))
        continue
    if line.startswith("# "):
        story.append(Paragraph(escape_and_format(line[2:]), title))
        first_title = False
    elif line.startswith("## "):
        text = escape_and_format(line[3:])
        if not first_title and text.startswith("Thiết kế lại"):
            story.append(Paragraph(text, subtitle))
        else:
            story.append(Paragraph(text, h2))
    elif line.startswith("### "):
        story.append(Paragraph(escape_and_format(line[4:]), h3))
    elif re.match(r"^\d+\.\s", line):
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        story.append(Paragraph(escape_and_format(m.group(2)), numbered, bulletText=f"{m.group(1)}."))
    elif line.startswith("- "):
        story.append(Paragraph(escape_and_format(line[2:]), bullet, bulletText="•"))
    else:
        story.append(Paragraph(escape_and_format(line), body))

doc.build(story)
print(OUTPUT)
