import pdfplumber
import json
import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r"C:\Users\angel\.gemini\antigravity\brain\c8aa19e9-76af-413a-ad29-31df44c015f2\.tempmediaStorage\aad4084cb819e305.pdf"

all_matches = []
all_teams = set()

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        
        for table in tables:
            if not table or len(table) < 3:
                continue
            
            # Check if this is a match detail table (has Date, No, Time, Event columns)
            header_row = None
            for row_idx, row in enumerate(table):
                if row and len(row) >= 7:
                    row_str = ' '.join([str(c) for c in row if c])
                    if 'Date' in row_str and 'Time' in row_str and 'Event' in row_str:
                        header_row = row_idx
                        break
            
            if header_row is not None:
                # Process match rows after header
                current_date = None
                for row_idx in range(header_row + 1, len(table)):
                    row = table[row_idx]
                    if not row or len(row) < 8:
                        continue
                    
                    # Get date (might be None if same date continues)
                    date_val = row[0]
                    if date_val:
                        # Clean up multi-line dates
                        date_val = date_val.split('\n')[0].strip()
                        if '/' in date_val:
                            current_date = date_val
                    
                    if not current_date:
                        continue
                    
                    # Get match details
                    try:
                        match_no = row[1] if row[1] else ''
                        time_val = row[2] if row[2] else ''
                        event = row[3] if row[3] else ''
                        group = row[4] if row[4] else ''
                        stage = row[5] if row[5] else ''
                        table_no = row[6] if row[6] else ''
                        team1 = row[7] if row[7] else ''
                        team2 = row[-1] if row[-1] else ''
                        
                        # Skip if no real data
                        if not match_no or not time_val or team1 == '-':
                            continue
                        
                        # Clean team names
                        team1 = team1.strip()
                        team2 = team2.strip()
                        
                        if team1 and team1 != '-':
                            all_teams.add(team1)
                        if team2 and team2 != '-':
                            all_teams.add(team2)
                        
                        match_data = {
                            'date': current_date,
                            'match_no': match_no.strip(),
                            'time': time_val.strip(),
                            'event': event.strip(),
                            'group': group.strip(),
                            'stage': stage.strip(),
                            'table': table_no.strip() if table_no else '',
                            'team1': team1,
                            'team2': team2,
                            'page': i + 1
                        }
                        all_matches.append(match_data)
                    except (IndexError, TypeError):
                        continue

print(f"\nTotal matches extracted: {len(all_matches)}")
print(f"Total unique teams: {len(all_teams)}")

# Sort teams
sorted_teams = sorted(list(all_teams))
print("\n--- ALL TEAMS ---")
for t in sorted_teams:
    print(f"  - {t}")

# Save data as JSON
output = {
    'matches': all_matches,
    'teams': sorted_teams,
    'total_matches': len(all_matches),
    'total_teams': len(all_teams)
}

with open('schedule_data.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nData saved to schedule_data.json")

# Print sample matches
print("\n--- SAMPLE MATCHES ---")
for m in all_matches[:10]:
    print(f"  {m['date']} {m['time']} | {m['event']} {m['group']} {m['stage']} | {m['team1']} vs {m['team2']}")
