from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm


def build_proposal_pdf(customer_name: str, proposal: dict) -> bytes:
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

    def section(title: str, body: list | str):
        nonlocal y
        if y < 35 * mm:
            new_page()
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x_margin, y, title)
        y -= 16
        c.setFont("Helvetica", 11)
        if isinstance(body, list):
            for item in body:
                draw_line(f"- {item}", leading=14)
        elif isinstance(body, str):
            draw_line(body, leading=14)
        y -= 6

    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(x_margin, y, "Project Proposal")
    y -= 18

    c.setFont("Helvetica", 12)
    c.drawString(x_margin, y, f"Customer: {customer_name}")
    y -= 16

    # Summary
    section("Summary", proposal.get("summary", ""))

    # Scope
    section("Scope", proposal.get("scope", []))

    # Approach
    section("Approach", proposal.get("approach", []))

    # Timeline
    timeline = proposal.get("timeline", [])
    if timeline:
        if y < 35 * mm:
            new_page()
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x_margin, y, "Timeline")
        y -= 16
        c.setFont("Helvetica", 11)
        for phase in timeline:
            title = phase.get("phase", "Phase")
            duration = phase.get("duration", "")
            activities = phase.get("activities", [])
            draw_line(f"{title} ({duration})", font="Helvetica-Bold", size=11, leading=14)
            for act in activities:
                draw_line(f"   - {act}", leading=13)
            y -= 6
        y -= 6

    # Pricing assumptions
    section("Pricing Assumptions", proposal.get("pricing_assumptions", []))

    # Risks
    risks = proposal.get("risks", [])
    if risks:
        if y < 35 * mm:
            new_page()
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x_margin, y, "Risks & Mitigations")
        y -= 16
        c.setFont("Helvetica", 11)
        for r in risks:
            draw_line(f"Risk: {r.get('risk','')}", leading=14)
            draw_line(f"Mitigation: {r.get('mitigation','')}", leading=13)
            y -= 4
        y -= 6

    # Dependencies
    section("Dependencies", proposal.get("dependencies", []))

    # Next steps
    section("Next Steps", proposal.get("next_steps", []))

    # Footer
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    c.setFont("Helvetica", 8)
    c.drawString(x_margin, 12 * mm, f"Generated on {ts}")

    c.save()
    return buf.getvalue()

