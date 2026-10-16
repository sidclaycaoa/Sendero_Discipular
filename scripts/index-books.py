"""Batch index of the seven approved originals; no manual passage approval.

PDF text comes from its text layer. EPUB text comes only from body elements in
spine order (never head/CSS). Chunks are contiguous, exhaustive slices of each
page/section's text. Their hashes and offsets let tests verify literal quotes.
"""
from pathlib import Path
import hashlib, json, posixpath, re, zipfile
import xml.etree.ElementTree as ET
import fitz

ROOT = Path(__file__).resolve().parents[1]
VERSION = "literal-v1"
sha = lambda data: hashlib.sha256(data).hexdigest()
tag = lambda el: el.tag.rsplit('}', 1)[-1]

def epub_units(path):
    with zipfile.ZipFile(path) as z:
        container = ET.fromstring(z.read('META-INF/container.xml'))
        opf = next(e.attrib['full-path'] for e in container.iter() if tag(e) == 'rootfile')
        package = ET.fromstring(z.read(opf))
        manifest = {e.attrib['id']: e.attrib['href'] for e in package.iter() if tag(e) == 'item'}
        for n, item in enumerate((e for e in package.iter() if tag(e) == 'itemref'), 1):
            href = posixpath.normpath(posixpath.join(posixpath.dirname(opf), manifest[item.attrib['idref']]))
            doc = ET.fromstring(z.read(href))
            body = next(e for e in doc.iter() if tag(e) == 'body')
            # Formatting tags retain their exact character content; block/newline
            # boundaries are structural. CSS/scripts never become book quotations.
            def text(el):
                if tag(el) in ('script', 'style'): return ''
                if tag(el) == 'br': return '\n'
                value = el.text or ''
                for child in el:
                    value += text(child) + (child.tail or '')
                return value + ('\n' if tag(el) in ('p','div','h1','h2','h3','li') else '')
            headings = [''.join(e.itertext()).strip() for e in body.iter() if tag(e) in ('h1','h2','h3')]
            section = next((h for h in headings if h), posixpath.basename(href))
            yield { 'number': n, 'page': None, 'section': section, 'location': f'{section} · seção EPUB {href}', 'sourcePath': href, 'text': text(body) }

def chunks(text):
    start = 0
    while start < len(text):
        end = min(len(text), start + 2200)
        if end < len(text):
            boundary = max(text.rfind('\n', start + 1200, end), text.rfind(' ', start + 1200, end))
            if boundary > start: end = boundary + 1
        yield start, end, text[start:end]
        start = end

def generate():
    sources = json.loads((ROOT / 'lib/data/ad-approved-works.json').read_text())
    index = { 'version': VERSION, 'works': [], 'units': [], 'passages': [] }
    for source in sources:
        path = ROOT / 'public/ad-sources' / source['sourceFile']
        work = dict(source)
        if not path.is_file():
            work.update(status='IMPORT_REQUIRED', sourceHash='', revision='', unitCount=0, passageCount=0, characterCount=0, textlessUnits=[])
            index['works'].append(work); continue
        work['sourceHash'] = sha(path.read_bytes())
        work['revision'] = sha((work['sourceHash'] + VERSION).encode())[:20]
        work['sourceUrl'] = '/ad-sources/' + source['sourceFile']
        if source['sourceType'] == 'pdf':
            with fitz.open(path) as doc:
                units = [dict(number=n+1, page=n+1, section=None, location=f'página {n+1} do arquivo PDF', sourcePath=f'page={n+1}', text=page.get_text('text', sort=True)) for n, page in enumerate(doc)]
        else: units = list(epub_units(path))
        work.update(status='INDEXED', unitCount=len(units), passageCount=0, characterCount=sum(len(u['text']) for u in units), textlessUnits=[u['number'] for u in units if not u['text'].strip()])
        for unit in units:
            unitId = f"{source['id']}:{work['revision']}:u{unit['number']}"
            unit.update(id=unitId, workId=source['id'], revision=work['revision'], textHash=sha(unit['text'].encode()))
            index['units'].append(unit)
            for n, (start, end, text) in enumerate(chunks(unit['text']), 1):
                passage = dict(id=f'{unitId}:t{n}', unitId=unitId, workId=source['id'], revision=work['revision'], sequence=n, startOffset=start, endOffset=end, location=unit['location'], page=unit['page'], section=unit['section'], text=text, textHash=sha(text.encode()))
                index['passages'].append(passage); work['passageCount'] += 1
        index['works'].append(work)
    (ROOT / 'lib/data/ad-book-index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')) + '\n')
    for w in index['works']: print(f"{w['title']}: {w['status']} · {w['unitCount']} páginas/seções · {w['passageCount']} trechos · {w['characterCount']} caracteres")
    return index

if __name__ == '__main__': generate()
