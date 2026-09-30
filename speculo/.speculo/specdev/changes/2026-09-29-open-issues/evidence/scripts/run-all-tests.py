import subprocess,json,pathlib,time
root=pathlib.Path('/srv/nand');out=pathlib.Path('/tmp/nand-issue-audit/tests');out.mkdir(exist_ok=True)
scripts=json.loads((root/'package.json').read_text())['scripts'];results=[]
for name in scripts:
 if not name.startswith('test:'):continue
 start=time.monotonic()
 with (out/(name.replace(':','-')+'.log')).open('w') as f:
  r=subprocess.run(['pnpm','run',name],cwd=root,stdout=f,stderr=subprocess.STDOUT)
 row={'script':name,'exit':r.returncode,'seconds':round(time.monotonic()-start,2)};results.append(row)
 print(json.dumps(row),flush=True)
 (out/'results.json').write_text(json.dumps(results,indent=2))
print('SUMMARY',sum(r['exit']==0 for r in results),'/',len(results),flush=True)
raise SystemExit(any(r['exit'] for r in results))
