import sys
import os
import json
import re
import unicodedata
try:
    import pypdf
except ImportError:
    pypdf = None

DEFAULT_MASTER_PATH = r"C:\Users\Rajea\Downloads\NAMELIST\NAMELIST\TE COMP.pdf"

SEAT_PATTERN = re.compile(r'^[A-Z]\d{7,12}$')
PRN_PATTERN = re.compile(r'^\d{8,11}[A-Z]$', re.IGNORECASE)

def normalize_text(text):
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', text)
    text = re.sub(r'\(.*?\)', '', text)  # remove (EWS), (TFWS), etc.
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    tokens = text.upper().split()
    return ' '.join(tokens)

def get_name_tokens(text):
    norm = normalize_text(text)
    return set(norm.split())

def parse_master_pdf(pdf_path):
    if not pypdf:
        raise RuntimeError("pypdf is not installed")
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Master PDF not found at {pdf_path}")
    
    reader = pypdf.PdfReader(pdf_path)
    records = []
    
    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        i = 0
        while i < len(lines):
            line = lines[i]
            if SEAT_PATTERN.match(line):
                seat_no = line
                student_name = lines[i+1] if i+1 < len(lines) else ''
                mother_lines = []
                j = i + 2
                while j < len(lines) and not PRN_PATTERN.match(lines[j]) and not SEAT_PATTERN.match(lines[j]):
                    if not any(hdr in lines[j] for hdr in ['Page ', 'Savitribai', 'Student List', 'OCT/NOV', 'Seat No', 'Branch Name', 'College Name']):
                        mother_lines.append(lines[j])
                    j += 1
                if j < len(lines) and PRN_PATTERN.match(lines[j]):
                    prn = lines[j].strip().upper()
                    mother_name = ' '.join(mother_lines).strip()
                    records.append({
                        'seat_no': seat_no,
                        'student_name': student_name.strip(),
                        'mother_name': mother_name,
                        'university_prn': prn,
                        'norm_name': normalize_text(student_name),
                        'tokens': get_name_tokens(student_name)
                    })
                    i = j + 1
                    continue
            i += 1
    return records

def parse_teacher_pdf(pdf_path):
    if not pypdf:
        raise RuntimeError("pypdf is not installed")
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"Teacher PDF not found at {pdf_path}")
    
    reader = pypdf.PdfReader(pdf_path)
    students = []
    
    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        lines = [l.strip() for l in page.extract_text().split('\n') if l.strip()]
        i = 0
        while i < len(lines):
            line = lines[i]
            if PRN_PATTERN.match(line):
                prn = line.strip().upper()
                name = lines[i-1] if i > 0 else ''
                if any(hdr in name.upper() for hdr in ['STUDENT NAME', 'PRN', 'SR.', 'ROLL']):
                    name = ''
                students.append({
                    'name': name.strip(),
                    'prn': prn,
                    'norm_name': normalize_text(name),
                    'tokens': get_name_tokens(name)
                })
            i += 1
    return students

def segregate_class(master_records, class_students, teacher_pdf_students=None):
    """
    Segregate strictly for class_students (the roster of that class).
    If teacher_pdf_students is available, uses it to map PRNs.
    """
    master_by_prn = {r['university_prn'].upper(): r for r in master_records}
    
    # If teacher PDF has students with PRNs, index them by tokens
    teacher_pdf_map = {}
    if teacher_pdf_students:
        for tp in teacher_pdf_students:
            teacher_pdf_map[tp['prn'].upper()] = tp
    
    matched = []
    unmatched = []
    used_seats = set()

    for cs in class_students:
        cs_prn = (cs.get('prn') or cs.get('university_prn') or '').strip().upper()
        cs_name = (cs.get('name') or cs.get('student_name') or '').strip()
        cs_tokens = get_name_tokens(cs_name)
        
        found = None
        
        # 1. Exact PRN match if cs has PRN
        if cs_prn and cs_prn in master_by_prn and master_by_prn[cs_prn]['seat_no'] not in used_seats:
            found = master_by_prn[cs_prn]
            
        # 2. Try match via teacher PDF to get PRN
        if not found and teacher_pdf_students:
            best_score = 0
            best_tp = None
            for tp in teacher_pdf_students:
                inter = cs_tokens.intersection(tp['tokens'])
                if len(inter) >= 2:
                    score = len(inter) / max(len(cs_tokens), len(tp['tokens']))
                    if score > best_score:
                        best_score = score
                        best_tp = tp
            if best_tp and best_score >= 0.5:
                tp_prn = best_tp['prn'].upper()
                if tp_prn in master_by_prn and master_by_prn[tp_prn]['seat_no'] not in used_seats:
                    found = master_by_prn[tp_prn]

        # 3. Direct token overlap match on university master records
        if not found and cs_tokens:
            best_score = 0
            best_m = None
            for m in master_records:
                if m['seat_no'] in used_seats:
                    continue
                inter = cs_tokens.intersection(m['tokens'])
                if len(inter) >= 2:
                    score = len(inter) / max(len(cs_tokens), len(m['tokens']))
                    if score > best_score:
                        best_score = score
                        best_m = m
            if best_m and best_score >= 0.5:
                found = best_m

        if found:
            used_seats.add(found['seat_no'])
            matched.append({
                'seat_no': found['seat_no'],
                'student_name': found['student_name'],
                'mother_name': found['mother_name'],
                'university_prn': found['university_prn'],
                'class_roll': cs.get('roll_no', ''),
                'class_enrollment': cs.get('enrollment_no', ''),
                'division': cs.get('division', '')
            })
        else:
            unmatched.append({
                'name': cs_name,
                'prn': cs_prn,
                'roll_no': cs.get('roll_no', ''),
                'reason': 'Not found in University Master List'
            })

    # Sort matched by student name
    matched.sort(key=lambda x: x['student_name'])
    for i, m in enumerate(matched):
        m['sr_no'] = i + 1

    return matched, unmatched

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--json-input':
        raw = sys.stdin.read()
        payload = json.loads(raw)
        master_path = payload.get('master_path') or DEFAULT_MASTER_PATH
        class_pdf_path = payload.get('class_pdf_path')
        class_students_list = payload.get('class_students')
        target_class = payload.get('target_class')
    else:
        master_path = DEFAULT_MASTER_PATH
        class_pdf_path = sys.argv[1] if len(sys.argv) > 1 else None
        class_students_list = None
        target_class = None

    try:
        master_records = parse_master_pdf(master_path)
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Failed to parse master PDF: {str(e)}'}))
        sys.exit(1)

    teacher_pdf_students = None
    if class_pdf_path and os.path.exists(class_pdf_path):
        try:
            teacher_pdf_students = parse_teacher_pdf(class_pdf_path)
        except Exception as e:
            print(json.dumps({'success': False, 'error': f'Failed to parse teacher PDF: {str(e)}'}))
            sys.exit(1)

    # If class_students_list (DB roster for this class) is provided, use it as target
    if class_students_list and len(class_students_list) > 0:
        target_students = class_students_list
        matched, unmatched = segregate_class(master_records, target_students, teacher_pdf_students)
    elif teacher_pdf_students:
        target_students = teacher_pdf_students
        matched, unmatched = segregate_class(master_records, target_students, None)
    else:
        print(json.dumps({'success': False, 'error': 'No class student list or class PDF provided.'}))
        sys.exit(1)

    result = {
        'success': True,
        'target_class': target_class or 'Assigned Class',
        'master_total': len(master_records),
        'class_total': len(target_students),
        'matched_count': len(matched),
        'unmatched_count': len(unmatched),
        'students': matched,
        'unmatched': unmatched
    }
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
