import io
import logging
from typing import Optional
from PyPDF2 import PdfReader

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_bytes: bytes) -> Optional[str]:
    """
    Extract text content from a PDF file.
    
    Args:
        pdf_bytes: Raw bytes of the PDF file
        
    Returns:
        Extracted text or None if extraction fails
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        
        for page_num, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())
        
        full_text = "\n\n".join(text_parts)
        
        if not full_text.strip():
            logger.warning("⚠️ PDF appears to be empty or image-based")
            return None
        
        # Limit text to avoid token limits (keep first ~3000 chars)
        if len(full_text) > 3000:
            full_text = full_text[:3000] + "\n[... CV truncado por longitud ...]"
        
        logger.info(f"✅ PDF text extracted: {len(full_text)} chars from {len(reader.pages)} pages")
        return full_text
        
    except Exception as e:
        logger.error(f"❌ Error extracting text from PDF: {e}")
        return None


def extract_text_from_multiple_pdfs(pdf_files: list) -> str:
    """
    Extract and combine text from multiple PDF files.
    
    Args:
        pdf_files: List of tuples (filename, pdf_bytes)
        
    Returns:
        Combined text from all PDFs
    """
    all_texts = []
    
    for filename, pdf_bytes in pdf_files:
        text = extract_text_from_pdf(pdf_bytes)
        if text:
            all_texts.append(f"--- {filename} ---\n{text}")
            logger.info(f"✅ Processed: {filename}")
        else:
            logger.warning(f"⚠️ Could not extract text from: {filename}")
    
    return "\n\n".join(all_texts)
