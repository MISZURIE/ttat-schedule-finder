import pdfplumber
import sys

def inspect_pdf(filepath, out_file):
    out_file.write(f"--- {filepath} ---\n")
    try:
        with pdfplumber.open(filepath) as pdf:
            for i, page in enumerate(pdf.pages[:2]): # Inspect first 2 pages
                out_file.write(f"Page {i+1}\n")
                text = page.extract_text()
                if text:
                    out_file.write(text + "\n")
                
                # Check tables
                tables = page.extract_tables()
                if tables:
                    out_file.write(f"Tables found on page {i+1}: {len(tables)}\n")
                    for t_idx, table in enumerate(tables):
                        out_file.write(f"Table {t_idx+1}:\n")
                        for row in table[:3]: # First 3 rows
                            out_file.write(str(row) + "\n")
                out_file.write("-" * 40 + "\n")
    except Exception as e:
        out_file.write(f"Error: {e}\n")

with open('pdf_inspection.txt', 'w', encoding='utf-8') as f:
    inspect_pdf("โปรแกรมการแข่งขัน ระยอง 2024.pdf", f)
    inspect_pdf("โปรแกรม SPRC 2023_V1.0.0.pdf", f)
print("Done")
