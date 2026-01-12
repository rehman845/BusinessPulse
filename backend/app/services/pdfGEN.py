# app/services/pdf_gen.py
from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm


def build_questionnaire_pdf(customer_name: str, title: str, notes: str, sections: list[dict]) -> bytes:
   
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    x_margin = 18 * mm
    y = height - 20 * mm

    def new_page():
        nonlocal y
        c.showPage()
        y = height - 20 * mm

    def draw_line(text: str, font="Helvetica", size=11, leading=14):
        nonlocal y
        c.setFont(font, size)

        # naive wrap: split long lines to fit page width
        max_width = width - 2 * x_margin
        words = text.split()
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, font, size) <= max_width:
                line = test
            else:
                if y < 25 * mm:
                    new_page()
                c.drawString(x_margin, y, line)
                y -= leading
                line = w
        if line:
            if y < 25 * mm:
                new_page()
            c.drawString(x_margin, y, line)
            y -= leading

    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(x_margin, y, "Requirements Clarification Questionnaire")
    y -= 18

    c.setFont("Helvetica", 12)
    c.drawString(x_margin, y, f"Customer: {customer_name}")
    y -= 16

    if title:
        c.setFont("Helvetica-Bold", 12)
        draw_line(f"Title: {title}", font="Helvetica-Bold", size=12, leading=16)
        y -= 2

    # Notes
    if notes:
        c.setFont("Helvetica-Bold", 12)
        draw_line("Notes:", font="Helvetica-Bold", size=12, leading=16)
        c.setFont("Helvetica", 11)
        draw_line(notes, font="Helvetica", size=11, leading=14)
        y -= 6

    # Sections
    for s_idx, sec in enumerate(sections, start=1):
        sec_title = sec.get("title") or f"Section {s_idx}"

        c.setFont("Helvetica-Bold", 13)
        draw_line(f"{s_idx}. {sec_title}", font="Helvetica-Bold", size=13, leading=16)
        y -= 4

        questions = sec.get("questions", [])
        for q_idx, q in enumerate(questions, start=1):
            q_text = q.get("q", "")
            q_why = q.get("why", "")
            q_pri = (q.get("priority") or "").upper()

            # Question text
            c.setFont("Helvetica-Bold", 11)
            draw_line(f"   {q_idx}. {q_text}", font="Helvetica-Bold", size=11, leading=14)
            y -= 2

            # Priority (if available) - shown right after question in ALL CAPS on its own line
            if q_pri:
                if y < 25 * mm:
                    new_page()
                c.setFont("Helvetica-Bold", 11)
                # Priority appears on its own line, aligned with question text start
                priority_x = x_margin + c.stringWidth(f"   {q_idx}. ", "Helvetica-Bold", 11)
                c.drawString(priority_x, y, q_pri)
                y -= 14

            # Why explanation (if available)
            if q_why:
                c.setFont("Helvetica", 10)
                draw_line(f"Why: {q_why}", font="Helvetica", size=10, leading=13)
                y -= 2

            y -= 4

        y -= 8

    # Footer - format: "1/5/2026, 10:19:33 PM"
    now = datetime.now()
    # Use # for Windows, - for Unix (but # works on both Windows and most Unix)
    try:
        ts = now.strftime("%#m/%#d/%Y, %I:%M:%S %p")  # Windows format
    except ValueError:
        ts = now.strftime("%-m/%-d/%Y, %I:%M:%S %p")  # Unix format
    c.setFont("Helvetica", 8)
    c.drawString(x_margin, 12 * mm, f"Generated on {ts}")

    c.save()
    return buf.getvalue()
