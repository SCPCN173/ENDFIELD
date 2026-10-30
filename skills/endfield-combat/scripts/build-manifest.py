"""Make a distributable identity manifest without embedding game assets."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
files=[]
for path in sorted(root.rglob('*')):
    if not path.is_file() or path.name=='MANIFEST.json' or '__pycache__' in path.parts:continue
    files.append({'path':path.relative_to(root).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
report={'skill':'endfield-combat','schemaVersion':1,'gameDataBundled':False,'referenceExecutablesBundled':False,'sourceProject':'endfield-tactics-lab, authored engine snapshot','files':files}
(root/'MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':len(files),'totalBytes':sum(x['bytes'] for x in files),'gameDataBundled':False}))
