import pdfplumber
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Users\angel\.gemini\antigravity\brain\c8aa19e9-76af-413a-ad29-31df44c015f2\.tempmediaStorage\aad4084cb819e305.pdf"

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    
    # Look at first 10 pages in detail
    for i, page in enumerate(pdf.pages[:10]):
        print(f"\n{'='*80}")
        print(f"PAGE {i+1}")
        print(f"{'='*80}")
        
        # Extract text
        text = page.extract_text()
        if text:
            print("TEXT:")
            print(text[:3000])
        
        # Extract tables
        tables = page.extract_tables()
        if tables:
            print(f"\nTABLES FOUND: {len(tables)}")
            for j, table in enumerate(tables):
                print(f"\n  Table {j+1} ({len(table)} rows):")
                for k, row in enumerate(table[:15]):
                    print(f"    Row {k}: {row}")
                if len(table) > 15:
                    print(f"    ... ({len(table) - 15} more rows)")
