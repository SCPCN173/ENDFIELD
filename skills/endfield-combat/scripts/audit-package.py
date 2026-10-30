"""List private-data candidates by location, never echo their values."""
import re,json,zipfile,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
patterns={
 'credential_assignment':re.compile(r'(?i)(api[_-]?key|authorization|bearer|secret|access[_-]?token)\s*[:=]\s*["\x27][A-Za-z0-9_./+=:-]{12,}'),
 'email_address':re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),
 'personal_windows_path':re.compile(r'(?i)C:[/\\]Users[/\\][^/\\\s"\x27]+'),
 'private_key':re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
 'game_asset_carrier':re.compile(r'(?i)(^|[/\\])(BuffData|SkillData|TableCfg|GameData|Art|Images)[/\\]'),
}
hits={name:[] for name in patterns}
for file in root.rglob('*'):
 if not file.is_file() or file.suffix not in {'.md','.js','.json','.py'}:continue
 for line_no,line in enumerate(file.read_text(encoding='utf-8').splitlines(),1):
  for name,rx in patterns.items():
   if rx.search(line):hits[name].append({'path':file.relative_to(root).as_posix(),'line':line_no})
zip_path=root.parent/(root.name+'.zip')
with zipfile.ZipFile(zip_path) as archive:
 archive_ok=archive.testzip() is None
 members=archive.namelist()
 packaged_assets=[name for name in members if name.lower().endswith(('.exe','.dll','.png','.jpg','.jpeg','.webp','.mp4','.csv'))]
report={'schemaVersion':1,'zipSha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'zipValid':archive_ok,'members':len(members),'nonCodeAssets':packaged_assets,'candidates':hits}
print(json.dumps(report,ensure_ascii=False,indent=2))
