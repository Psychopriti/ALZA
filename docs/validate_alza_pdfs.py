from pathlib import Path

from pypdf import PdfReader


DOCS = Path(__file__).resolve().parent
PDFS = [
    DOCS / "ALZA_Documentacion_Tecnica.pdf",
    DOCS / "ALZA_Manual_Administrador.pdf",
]

BAD_PATTERNS = ("Ã", "Â", "�", "Entr?", "sesi?", "Misi?", "Educaci?")
REQUIRED = ("Hecho por Ing. Juan Marenco", "ALZA")


def validate(path):
    reader = PdfReader(str(path))
    if len(reader.pages) < 2:
        raise SystemExit(f"{path.name}: el PDF parece incompleto.")
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    for value in REQUIRED:
        if value not in text:
            raise SystemExit(f"{path.name}: falta texto requerido: {value}")
    for value in BAD_PATTERNS:
        if value in text:
            raise SystemExit(f"{path.name}: posible encoding roto: {value}")
    print(f"{path.name}: OK ({len(reader.pages)} paginas)")


if __name__ == "__main__":
    for pdf in PDFS:
        if not pdf.exists():
            raise SystemExit(f"Falta {pdf}")
        validate(pdf)
