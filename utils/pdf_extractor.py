import re
from PyPDF2 import PdfReader


def extract_pdf_text(pdf_path: str) -> str:
    """Extract text from PDF file."""
    try:
        reader = PdfReader(pdf_path)
        text_parts = []

        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)

        # Join and clean up text
        full_text = "\n".join(text_parts)
        full_text = re.sub(r"\n{3,}", "\n\n", full_text)

        return full_text.strip()

    except Exception as e:
        raise Exception(f"Error extracting PDF text: {str(e)}")
