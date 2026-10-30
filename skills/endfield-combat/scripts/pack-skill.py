"""Package the self-contained skill folder with Python stdlib."""
import json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
target=root.parent/(root.name+'.zip')
manifest=json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for row in manifest['files']:
        source=root/row['path']
        if source.resolve().is_relative_to(root.resolve()) and source.is_file():archive.write(source,f'{root.name}/{row["path"]}')
        else:raise ValueError(f'invalid package member: {row["path"]}')
    archive.write(root/'MANIFEST.json',f'{root.name}/MANIFEST.json')
with zipfile.ZipFile(target) as archive:
    bad=archive.testzip()
    if bad:raise ValueError(f'archive member failed CRC: {bad}')
    names=archive.namelist()
    if not any(n.endswith('/SKILL.md') for n in names):raise ValueError('SKILL.md missing')
print(json.dumps({'path':str(target),'members':len(names),'bytes':target.stat().st_size,'crc':'ok'},ensure_ascii=False))
