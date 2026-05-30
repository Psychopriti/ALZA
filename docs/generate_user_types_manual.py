from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = ROOT / "public" / "assets"

PAGE_WIDTH, _ = letter
MARGIN = 0.68 * inch
CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

INK = colors.HexColor("#22201D")
MUTED = colors.HexColor("#665F55")
LINE = colors.HexColor("#E9E1D5")
SOFT_GREEN = colors.HexColor("#F2F7D8")
SOFT_ORANGE = colors.HexColor("#FFE0C3")
SOFT_YELLOW = colors.HexColor("#FFF3D7")


def register_fonts():
    font_dir = Path("C:/Windows/Fonts")
    regular = font_dir / "arial.ttf"
    bold = font_dir / "arialbd.ttf"
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("ALZA-Regular", str(regular)))
        pdfmetrics.registerFont(TTFont("ALZA-Bold", str(bold)))
        return "ALZA-Regular", "ALZA-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName=FONT_BOLD,
            fontSize=29,
            leading=34,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
    )
    base.add(
        ParagraphStyle(
            name="CoverSubtitle",
            fontName=FONT,
            fontSize=12.4,
            leading=18,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=18,
        )
    )
    base.add(
        ParagraphStyle(
            name="Meta",
            fontName=FONT,
            fontSize=9.5,
            leading=13,
            textColor=MUTED,
            alignment=TA_CENTER,
        )
    )
    base.add(
        ParagraphStyle(
            name="H1x",
            fontName=FONT_BOLD,
            fontSize=17,
            leading=22,
            textColor=INK,
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="H2x",
            fontName=FONT_BOLD,
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor("#476A20"),
            spaceBefore=9,
            spaceAfter=5,
        )
    )
    base.add(
        ParagraphStyle(
            name="Bodyx",
            fontName=FONT,
            fontSize=9.6,
            leading=14.2,
            textColor=INK,
            spaceAfter=6,
        )
    )
    base.add(
        ParagraphStyle(
            name="Smallx",
            fontName=FONT,
            fontSize=8.2,
            leading=11,
            textColor=MUTED,
        )
    )
    base.add(
        ParagraphStyle(
            name="TableHead",
            fontName=FONT_BOLD,
            fontSize=8.5,
            leading=10.5,
            textColor=INK,
            alignment=TA_LEFT,
        )
    )
    base.add(
        ParagraphStyle(
            name="TableBody",
            fontName=FONT,
            fontSize=8,
            leading=10.5,
            textColor=INK,
            alignment=TA_LEFT,
        )
    )
    base.add(
        ParagraphStyle(
            name="Callout",
            fontName=FONT,
            fontSize=9.4,
            leading=13.5,
            textColor=INK,
            backColor=SOFT_GREEN,
            borderPadding=8,
            borderColor=colors.HexColor("#D6E499"),
            borderWidth=0.8,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    return base


STYLES = styles()


def p(text, style="Bodyx"):
    return Paragraph(text, STYLES[style])


def bullet(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=12) for item in items],
        bulletType="bullet",
        leftIndent=18,
        bulletFontName=FONT,
        bulletFontSize=8,
    )


def table(rows, widths, background=SOFT_GREEN, header=True):
    data = []
    for row_index, row in enumerate(rows):
        style = "TableHead" if header and row_index == 0 else "TableBody"
        data.append([p(str(cell), style) for cell in row])
    tbl = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), background if header else colors.white),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tbl


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 0.38 * inch, "ALZA | Manual de tipos de usuario")
    canvas.drawRightString(PAGE_WIDTH - MARGIN, 0.38 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build_pdf(path):
    story = [Spacer(1, 0.65 * inch)]
    logo = ASSETS / "alza-logo-full.png"
    if logo.exists():
        story.append(Image(str(logo), width=1.35 * inch, height=0.72 * inch, hAlign="CENTER"))
        story.append(Spacer(1, 0.35 * inch))

    story += [
        p("Manual de Tipos de Usuario ALZA", "CoverTitle"),
        p(
            "Guía práctica para entender los tres perfiles principales de usuario, "
            "qué puede hacer cada uno y cómo fluye su experiencia dentro de la plataforma.",
            "CoverSubtitle",
        ),
        p("Hecho por Ing. Juan Marenco", "Meta"),
        p("Versión 1.0 | Mayo 2026", "Meta"),
        Spacer(1, 0.5 * inch),
        table(
            [
                ["Tipo de usuario", "Propósito dentro de ALZA"],
                ["Persona no oyente", "Acceso inclusivo sin compra de plan, validado por ID de 8 a 12 dígitos."],
                ["Persona oyente", "Aprendiz individual que compra un plan y consume cursos disponibles para su portal."],
                ["Empresa", "Institución que compra un plan y administra hasta 10 cuentas bajo su organización."],
            ],
            [1.7 * inch, CONTENT_WIDTH - 1.7 * inch],
            background=SOFT_YELLOW,
        ),
        PageBreak(),
        p("1. Vista general", "H1x"),
        p(
            "ALZA organiza la experiencia de usuario en tres rutas principales. Cada ruta existe para responder a una "
            "necesidad distinta: acceso inclusivo para personas no oyentes, aprendizaje individual para personas oyentes "
            "y capacitación institucional para empresas.",
        ),
        p(
            "Aunque los tres perfiles comparten la misma base de cursos, la plataforma controla qué contenido puede ver "
            "cada usuario según su portal, su rol y el estado de acceso correspondiente.",
            "Callout",
        ),
        p("2. Comparación rápida", "H1x"),
        table(
            [
                ["Aspecto", "Persona no oyente", "Persona oyente", "Empresa"],
                ["Registro", "Nombre, correo, contraseña e ID de 8 a 12 dígitos.", "Nombre, correo y contraseña.", "Datos de la organización, correo y contraseña."],
                ["Pago", "No compra plan.", "Plan individual de C$ 2,500 por 5 meses.", "Plan empresa de C$ 8,700 por 5 meses."],
                ["Acceso a cursos", "Cursos publicados para personas no oyentes o todos.", "Cursos publicados para oyentes o todos.", "Cursos publicados para empresas o todos."],
                ["Dashboard", "Cursos disponibles y progreso personal.", "Cursos disponibles, progreso y plan.", "Cursos, plan y sección de cuentas."],
                ["Cuentas adicionales", "No aplica.", "No aplica.", "Puede crear hasta 10 cuentas institucionales."],
            ],
            [1.18 * inch, 1.45 * inch, 1.45 * inch, CONTENT_WIDTH - 4.08 * inch],
            background=SOFT_GREEN,
        ),
        p("3. Persona no oyente", "H1x"),
        p(
            "Este perfil está pensado para personas con discapacidad auditiva. Su acceso no depende de la compra de un plan. "
            "Durante el registro, la plataforma solicita un campo llamado <b>ID</b>, que debe ser un número de 8 a 12 dígitos. "
            "En un escenario real, ese ID podría validarse contra una base oficial; en esta versión se solicita y valida el formato.",
        ),
        p("Qué puede hacer", "H2x"),
        bullet(
            [
                "Crear cuenta desde el portal correspondiente.",
                "Entrar a cursos reales publicados para su tipo de usuario.",
                "Ver lecciones con video local, texto formateado y archivos descargables.",
                "Responder exámenes entre lecciones.",
                "Avanzar en orden, con lecciones bloqueadas hasta completar las anteriores.",
                "Ver su progreso dentro de la plataforma.",
            ]
        ),
        p("4. Persona oyente", "H1x"),
        p(
            "Este perfil corresponde a usuarios individuales que desean aprender desde ALZA y sí requieren un plan activo. "
            "El plan disponible para este usuario es de <b>C$ 2,500</b> por <b>5 meses</b>. Después de iniciar sesión y completar "
            "el flujo de plan, el usuario puede acceder a los cursos habilitados para personas oyentes.",
        ),
        p("Qué puede hacer", "H2x"),
        bullet(
            [
                "Registrarse con nombre, correo y contraseña.",
                "Seleccionar y activar el plan individual.",
                "Acceder al dashboard de aprendizaje.",
                "Consumir cursos publicados para personas oyentes.",
                "Completar lecciones, revisar contenido descargable y responder exámenes.",
                "Consultar su avance general y estado de progreso.",
            ]
        ),
        PageBreak(),
        p("5. Empresa", "H1x"),
        p(
            "El perfil empresa está diseñado para instituciones que desean capacitar a varias personas bajo una misma sombrilla. "
            "El plan empresarial cuesta <b>C$ 8,700</b> por <b>5 meses</b> y permite crear hasta <b>10 cuentas</b> asociadas "
            "a la institución.",
        ),
        p("Qué puede hacer la cuenta principal", "H2x"),
        bullet(
            [
                "Registrarse como empresa y activar el plan empresarial.",
                "Acceder a cursos publicados para empresas.",
                "Entrar a la sección Cuentas desde el dashboard.",
                "Crear accesos institucionales con nombre, correo y contraseña.",
                "Mantener el control de las cuentas asociadas a la organización.",
            ]
        ),
        p("Cuentas bajo institución", "H2x"),
        p(
            "Las cuentas creadas por una empresa reciben una etiqueta tipo <b>Nombre-Empresa</b>. Por ejemplo, si la empresa "
            "MarencoTrading crea una cuenta para José, el saludo o identificación puede mostrarse como <b>jose-marencotrading</b>. "
            "Estas cuentas no gestionan plan propio, porque dependen de la cuenta empresarial principal.",
        ),
        table(
            [
                ["Dato solicitado", "Uso"],
                ["Nombre del usuario", "Identifica a la persona dentro de la institución."],
                ["Correo electrónico", "Mantiene consistencia con el resto de logins de ALZA."],
                ["Contraseña", "Permite iniciar sesión desde el login de empresas."],
                ["Etiqueta institucional", "Relaciona visualmente a la persona con su organización."],
            ],
            [1.7 * inch, CONTENT_WIDTH - 1.7 * inch],
            background=SOFT_ORANGE,
        ),
        p("6. Flujo de acceso por tipo de usuario", "H1x"),
        table(
            [
                ["Paso", "Persona no oyente", "Persona oyente", "Empresa"],
                ["1", "Elige su portal.", "Elige su portal.", "Elige portal de empresas."],
                ["2", "Crea cuenta con ID.", "Crea cuenta normal.", "Crea cuenta institucional principal."],
                ["3", "Entra sin checkout.", "Activa plan individual.", "Activa plan empresarial."],
                ["4", "Consume cursos habilitados.", "Consume cursos habilitados.", "Gestiona cursos y cuentas."],
                ["5", "Avanza progreso personal.", "Avanza progreso personal.", "Sus usuarios avanzan bajo la institución."],
            ],
            [0.55 * inch, 1.65 * inch, 1.65 * inch, CONTENT_WIDTH - 3.85 * inch],
            background=SOFT_GREEN,
        ),
        p("7. Reglas importantes", "H1x"),
        bullet(
            [
                "Un curso puede publicarse para todos o para una combinación específica de portales.",
                "Las personas no oyentes no deben pasar por compra de plan.",
                "Las cuentas institucionales solo deben iniciar sesión desde el login de empresas.",
                "Una cuenta institucional no debe ver la opción de gestionar plan.",
                "El avance de curso depende de completar lecciones y exámenes en orden.",
                "Si se agrega una nueva lección a un curso, el progreso debe reflejar que hay contenido pendiente.",
            ]
        ),
        p("8. Resumen operativo", "H1x"),
        p(
            "En términos simples: la persona no oyente tiene acceso inclusivo sin pago; la persona oyente compra un plan "
            "individual; y la empresa compra un plan institucional para crear y administrar accesos de su equipo. Esta separación "
            "permite que ALZA mantenga una experiencia clara, justa y ordenada para cada audiencia.",
        ),
    ]

    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=0.56 * inch,
        bottomMargin=0.62 * inch,
        title="Manual de Tipos de Usuario ALZA",
        author="Ing. Juan Marenco",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    DOCS.mkdir(exist_ok=True)
    build_pdf(DOCS / "ALZA_Manual_Tipos_De_Usuario.pdf")
    print("PDF generado: docs/ALZA_Manual_Tipos_De_Usuario.pdf")
