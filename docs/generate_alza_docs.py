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
    KeepTogether,
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

PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 0.68 * inch
CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

ALZA_ORANGE = colors.HexColor("#F9A65A")
ALZA_GREEN = colors.HexColor("#D6E499")
ALZA_YELLOW = colors.HexColor("#F9E46F")
INK = colors.HexColor("#22201D")
MUTED = colors.HexColor("#665F55")
LINE = colors.HexColor("#E9E1D5")
SOFT = colors.HexColor("#FFF8EA")
SOFT_GREEN = colors.HexColor("#F2F7D8")


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


def stylesheet():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName=FONT_BOLD,
            fontSize=30,
            leading=34,
            textColor=INK,
            spaceAfter=12,
            alignment=TA_CENTER,
        )
    )
    base.add(
        ParagraphStyle(
            name="CoverSubtitle",
            fontName=FONT,
            fontSize=12.5,
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
            fontSize=18,
            leading=23,
            textColor=INK,
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="H2x",
            fontName=FONT_BOLD,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#476A20"),
            spaceBefore=10,
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
            fontSize=8.4,
            leading=11.5,
            textColor=MUTED,
            spaceAfter=4,
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
            borderColor=ALZA_GREEN,
            borderWidth=0.8,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    return base


STYLES = stylesheet()


def p(text, style="Bodyx"):
    return Paragraph(text, STYLES[style])


def bullet(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=18,
        bulletFontName=FONT,
        bulletFontSize=8,
    )


def steps(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=12) for item in items],
        bulletType="1",
        leftIndent=20,
        bulletFontName=FONT_BOLD,
        bulletFontSize=8.5,
    )


def table(rows, widths, header=True):
    data = []
    for row_index, row in enumerate(rows):
        style = "TableHead" if header and row_index == 0 else "TableBody"
        data.append([p(str(cell), style) for cell in row])
    tbl = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT_GREEN if header else colors.white),
                ("TEXTCOLOR", (0, 0), (-1, -1), INK),
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


def cover(title, subtitle, version):
    story = [Spacer(1, 0.65 * inch)]
    logo = ASSETS / "alza-logo-full.png"
    if logo.exists():
        story.append(Image(str(logo), width=1.35 * inch, height=0.72 * inch, hAlign="CENTER"))
        story.append(Spacer(1, 0.35 * inch))
    story.extend(
        [
            p(title, "CoverTitle"),
            p(subtitle, "CoverSubtitle"),
            Spacer(1, 0.18 * inch),
            p("Hecho por Ing. Juan Marenco", "Meta"),
            p(version, "Meta"),
            Spacer(1, 0.55 * inch),
        ]
    )
    story.append(
        table(
            [
                ["Documento", title],
                ["Proyecto", "ALZA | Plataforma educativa inclusiva"],
                ["Formato", "PDF"],
                ["Uso recomendado", "Referencia interna para implementación, operación y entrega a clientes"],
            ],
            [1.35 * inch, CONTENT_WIDTH - 1.35 * inch],
            header=False,
        )
    )
    story.append(PageBreak())
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, 0.38 * inch, "ALZA | Hecho por Ing. Juan Marenco")
    canvas.drawRightString(PAGE_WIDTH - MARGIN, 0.38 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build_pdf(path, story):
    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=0.56 * inch,
        bottomMargin=0.62 * inch,
        title=path.stem,
        author="Ing. Juan Marenco",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def technical_doc():
    story = cover(
        "Documentación Técnica de ALZA",
        "Arquitectura, tecnologías, datos, seguridad, despliegue y puntos de extensión para developers.",
        "Versión 1.0 | Mayo 2026",
    )
    story += [
        p("1. Resumen técnico", "H1x"),
        p(
            "ALZA es una plataforma educativa inclusiva construida como frontend web estático con JavaScript modular, "
            "Supabase como backend administrado y Vercel como destino de despliegue. La aplicación cubre home pública, "
            "autenticación por portal, dashboard de usuario, constructor administrativo de cursos, reproducción de lecciones, "
            "exámenes, progreso, planes y cuentas institucionales.",
        ),
        p(
            "El diseño actual favorece simplicidad operativa: no hay bundler complejo, el build copia archivos estáticos a "
            "<b>dist/</b> y la lógica de datos vive en módulos JavaScript que consumen Supabase directamente desde el navegador.",
            "Callout",
        ),
        p("2. Stack y tecnologías", "H1x"),
        table(
            [
                ["Capa", "Tecnología", "Uso en ALZA"],
                ["Frontend", "HTML, CSS, JavaScript ES Modules", "Páginas estáticas, UI responsive, dashboards, course player y admin."],
                ["Backend", "Supabase Auth, Database, Storage, RLS", "Usuarios, roles, cursos, lecciones, progreso, archivos, planes y cuentas empresa."],
                ["Deploy", "Vercel", "Publicación estática usando buildCommand y outputDirectory dist."],
                ["Build local", "Node.js", "scripts/build-static.js copia HTML, public y src a dist."],
                ["Validación", "scripts/validate-static.js", "Revisa recursos faltantes y texto con encoding roto antes de deploy."],
            ],
            [1.15 * inch, 1.55 * inch, CONTENT_WIDTH - 2.7 * inch],
        ),
        p("3. Mapa de archivos principales", "H1x"),
        table(
            [
                ["Archivo", "Responsabilidad"],
                ["index.html", "Home pública, navegación, secciones comerciales y entrada a autenticación."],
                ["auth.html / login.html / register.html", "Flujo de selección de portal, login y registro."],
                ["platform.html", "Dashboard de usuario final y empresa."],
                ["course.html", "Vista de consumo de curso, lecciones, exámenes, progreso y descargas."],
                ["admin.html", "Panel super admin, dashboard y gestión de cursos/contenido."],
                ["src/supabase-client.js", "Inicialización de Supabase y utilidades compartidas."],
                ["src/session.js", "Sesión, perfiles, rol, redirecciones y helpers de auth."],
                ["src/admin.js", "CRUD de cursos, lecciones, exámenes, assets y dashboard admin."],
                ["src/platform.js", "Dashboard cliente, cursos visibles por rol, progreso y cuentas institucionales."],
                ["src/course.js", "Render del curso, bloqueo por avance, reproducción local, exámenes y progreso."],
                ["src/styles.css", "Sistema visual completo de ALZA."],
                ["supabase/*.sql", "Schema base, migraciones, seed de cursos y configuración de storage."],
            ],
            [2.05 * inch, CONTENT_WIDTH - 2.05 * inch],
        ),
        p("4. Modelo de datos", "H1x"),
        table(
            [
                ["Tabla", "Propósito"],
                ["profiles", "Perfil extendido de auth.users: rol, nombre, organización, ID de persona no oyente y etiqueta institucional."],
                ["plans", "Planes activos por audiencia: oyente individual y empresa."],
                ["subscriptions", "Registro de compra mock/estado activo por usuario."],
                ["company_seats", "Cuentas creadas bajo una empresa: nombre, email, contraseña y etiqueta Nombre-Empresa."],
                ["courses", "Cursos con título, slug, resumen, categoría, audiencia, cover, publicación y creador."],
                ["lessons", "Lecciones y exámenes ordenados por posición, con video local, texto, preguntas y adjuntos."],
                ["enrollments", "Inscripción del usuario al curso y progreso agregado."],
                ["lesson_progress", "Estado completado/no completado por lección dentro de una inscripción."],
            ],
            [1.65 * inch, CONTENT_WIDTH - 1.65 * inch],
        ),
        p("5. Roles y acceso", "H1x"),
        bullet(
            [
                "<b>super_admin:</b> acceso a admin.html, métricas, CRUD de cursos y contenido.",
                "<b>empresa:</b> compra plan empresarial y puede crear hasta 10 cuentas bajo la institución.",
                "<b>persona_oyente:</b> requiere plan individual para consumir cursos.",
                "<b>persona_discapacidad_auditiva:</b> registra un ID de 8 a 12 dígitos y no requiere compra de plan.",
            ]
        ),
        p("6. Flujo de contenido", "H1x"),
        steps(
            [
                "El admin crea o edita un curso desde admin.html, definiendo título, resumen, categoría, audiencia y cover.",
                "El admin agrega lecciones o exámenes, reordena bloques, sube videos locales y adjuntos descargables.",
                "El contenido se guarda en Supabase: metadata en Database y archivos en Storage.",
                "El usuario ve solo cursos publicados para su portal o rol.",
                "course.html carga lecciones, bloquea las siguientes hasta completar las previas y recalcula el progreso.",
            ]
        ),
        p("7. Storage y archivos", "H1x"),
        table(
            [
                ["Bucket / recurso", "Uso esperado", "Notas"],
                ["course-videos", "Videos locales de lección", "Recomendado: MP4 H.264/AAC por compatibilidad web."],
                ["course-assets", "Covers y adjuntos descargables", "PDF, Excel, imágenes y otros documentos permitidos por política del bucket."],
                ["public/assets", "Logos, paleta, GIF de bienvenida y recursos estáticos", "Se copian a dist en el build."],
            ],
            [1.55 * inch, 2.0 * inch, CONTENT_WIDTH - 3.55 * inch],
        ),
        p("8. Deploy y verificación", "H1x"),
        steps(
            [
                "Configurar src/config.js con SUPABASE_URL y SUPABASE_ANON_KEY.",
                "Ejecutar el SQL base y migraciones necesarias en Supabase.",
                "Correr npm.cmd run build para generar dist/.",
                "Correr npm.cmd run validate:static para detectar recursos faltantes o texto corrupto.",
                "Subir commits a GitHub y conectar Vercel al repositorio.",
                "En Vercel usar buildCommand: npm run build y outputDirectory: dist.",
            ]
        ),
        p("9. Consideraciones de mantenimiento", "H1x"),
        bullet(
            [
                "Mantener schema.sql y migraciones alineados; no depender de datos hardcodeados para cursos reales.",
                "Cuando se agreguen nuevos tipos de archivo, revisar políticas y MIME types de Supabase Storage.",
                "No exponer service role keys en frontend; solo usar anon key con RLS.",
                "Probar cursos con los tres portales antes de compartir un link público.",
                "Antes de deploy cliente, ejecutar build y validate:static.",
            ]
        ),
    ]
    return story


def admin_doc():
    story = cover(
        "Manual de Administrador ALZA",
        "Overview funcional de la aplicación y flujo de trabajo para administrar cursos, usuarios y contenido.",
        "Versión 1.0 | Mayo 2026",
    )
    story += [
        p("1. Qué es ALZA", "H1x"),
        p(
            "ALZA es una plataforma educativa inclusiva para entregar cursos con video, texto, exámenes y recursos descargables. "
            "La app separa la experiencia por tipo de usuario: personas con discapacidad auditiva, personas oyentes, empresas "
            "y administrador.",
        ),
        p(
            "El administrador no debe editar código para publicar contenido: el flujo normal es crear cursos desde el panel, "
            "agregar lecciones o exámenes, cargar archivos y publicar para las audiencias correspondientes.",
            "Callout",
        ),
        p("2. Portales de usuario", "H1x"),
        table(
            [
                ["Portal", "Qué ve / qué hace"],
                ["Personas con discapacidad auditiva", "Crea cuenta con ID de 8 a 12 dígitos, accede sin comprar plan y consume cursos habilitados."],
                ["Personas oyentes", "Compra el plan individual, entra al dashboard y avanza en cursos publicados para su portal."],
                ["Empresas", "Compra plan empresarial, gestiona cuentas bajo la institución y accede a cursos empresariales."],
                ["Cuentas institucionales", "Acceden desde login de empresas usando email y contraseña creados por la cuenta principal."],
                ["Super admin", "Entra a admin.html para revisar indicadores y gestionar contenido."],
            ],
            [2.0 * inch, CONTENT_WIDTH - 2.0 * inch],
        ),
        p("3. Panel administrador", "H1x"),
        bullet(
            [
                "<b>Dashboard:</b> muestra indicadores operativos de cursos, estudiantes, contenido y actividad.",
                "<b>Cursos:</b> abre la página/sección de gestión de contenido para crear, editar, publicar o borrar cursos.",
                "<b>Salir:</b> cierra sesión del administrador.",
            ]
        ),
        p("4. Crear un curso", "H1x"),
        steps(
            [
                "Entrar al panel administrador y abrir la sección Cursos.",
                "Seleccionar Crear curso.",
                "Completar título, resumen, categoría e imagen de portada.",
                "Elegir la audiencia: todos o una combinación de portales.",
                "Definir si queda publicado o en borrador.",
                "Guardar el curso y pasar a construir sus lecciones.",
            ]
        ),
        p("5. Crear lecciones", "H1x"),
        table(
            [
                ["Elemento", "Uso recomendado"],
                ["Título", "Nombre corto y claro de la lección. Ejemplo: Bienvenida, Saludos básicos, Práctica visual."],
                ["Video local", "Subir archivo MP4 H.264/AAC siempre que sea posible. Ya no se usa URL de YouTube."],
                ["Texto de lección", "Agregar explicación, instrucciones o contenido complementario. El formato enriquecido debe respetarse."],
                ["Adjuntos", "Subir PDF, Excel, imágenes o archivos de apoyo para descarga del estudiante."],
                ["Orden", "Mover lecciones según la secuencia deseada o insertar contenido entre lecciones ya existentes."],
            ],
            [1.55 * inch, CONTENT_WIDTH - 1.55 * inch],
        ),
        p("6. Crear exámenes", "H1x"),
        bullet(
            [
                "Los exámenes pueden ir entre lecciones para validar avance.",
                "Se pueden crear varias preguntas dentro de un examen.",
                "Cada pregunta puede tener opciones personalizadas o formato verdadero/falso.",
                "La respuesta correcta debe marcarse desde el constructor.",
                "El usuario recibe retroalimentación visual cuando responde correcto o incorrecto.",
            ]
        ),
        p("7. Publicación y audiencias", "H1x"),
        p(
            "Un curso puede estar publicado para todos o filtrado por portal. Antes de publicarlo, revisar que portada, resumen, "
            "lecciones, exámenes y archivos estén completos. Si se agrega una nueva lección a un curso ya completado por usuarios, "
            "el progreso debe recalcularse para reflejar que ahora el curso tiene contenido pendiente.",
        ),
        p("8. Flujo del estudiante", "H1x"),
        steps(
            [
                "El usuario inicia sesión en su portal correspondiente.",
                "El dashboard muestra cursos reales disponibles para su rol.",
                "Al entrar a un curso, solo puede avanzar en orden: las lecciones siguientes permanecen bloqueadas.",
                "El usuario consume video, texto y descargas.",
                "Al completar una lección o aprobar/contestar un examen, se actualiza su progreso.",
                "El dashboard refleja cursos en progreso y completados.",
            ]
        ),
        p("9. Empresas y cuentas bajo institución", "H1x"),
        table(
            [
                ["Acción", "Detalle operativo"],
                ["Crear cuenta", "La empresa registra nombre, email y contraseña para cada usuario."],
                ["Etiqueta", "El sistema muestra el usuario como Nombre-Empresa, por ejemplo jose-marencotrading."],
                ["Límite", "El plan empresarial permite hasta 10 cuentas bajo la institución."],
                ["Login", "Estas cuentas deben entrar desde el login de empresas."],
                ["Plan", "Las cuentas institucionales no gestionan plan propio; dependen de la cuenta principal."],
            ],
            [1.4 * inch, CONTENT_WIDTH - 1.4 * inch],
        ),
        p("10. Buenas prácticas antes de entregar un curso", "H1x"),
        bullet(
            [
                "Usar títulos breves y consistentes.",
                "Subir videos livianos, claros y compatibles con navegador.",
                "Revisar que los adjuntos descarguen correctamente.",
                "Probar el curso desde una cuenta de cada portal habilitado.",
                "Verificar que las lecciones estén en el orden correcto.",
                "Mantener cursos en borrador hasta que todo esté revisado.",
            ]
        ),
        p("11. Checklist rápido del administrador", "H1x"),
        table(
            [
                ["Revisión", "Estado esperado"],
                ["Curso creado", "Título, resumen, categoría, audiencia y portada completos."],
                ["Contenido cargado", "Lecciones, videos, textos, exámenes y descargas listos."],
                ["Orden validado", "Secuencia de aprendizaje correcta y sin bloques duplicados."],
                ["Publicación", "Curso publicado solo para las audiencias correctas."],
                ["Prueba usuario", "Se puede entrar, avanzar, responder y completar progreso."],
            ],
            [1.65 * inch, CONTENT_WIDTH - 1.65 * inch],
        ),
    ]
    return story


if __name__ == "__main__":
    DOCS.mkdir(exist_ok=True)
    build_pdf(DOCS / "ALZA_Documentacion_Tecnica.pdf", technical_doc())
    build_pdf(DOCS / "ALZA_Manual_Administrador.pdf", admin_doc())
    print("PDFs generados en docs/")
