'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const manifest=require('../lib/frontend-release-manifest.cjs');
const repo=path.resolve(__dirname,'../..');
const mock=[
"#!/usr/bin/env python3",
"import json,os,pathlib,shutil,stat,sys",
"a=sys.argv[1:]",
"if os.environ.get('JWT_SECRET'):raise RuntimeError('secret inherited by an AWS command')",
"with open(os.environ['MOCK_LOG'],'a') as f:f.write(json.dumps(a)+'\\n')",
"if a[:2]==['sts','get-caller-identity']:",
" print('123456789012' if a[a.index('--query')+1]=='Account' else 'arn:aws:sts::123456789012:assumed-role/LabRole/mock')",
"elif a[:2] in (['s3api','head-bucket'],['s3api','put-public-access-block'],['cloudformation','validate-template']):pass",
"elif a[:2]==['cloudformation','package']:",
" pathlib.Path(a[a.index('--output-template-file')+1]).write_text('mock-template')",
"elif a[:2]==['cloudformation','deploy']:",
" f=a[a.index('--parameter-overrides')+1]",
" if not f.startswith('file://'):raise RuntimeError('plaintext in argv')",
" p=pathlib.Path(f[7:]);d={x['ParameterKey']:x['ParameterValue'] for x in json.loads(p.read_text())}",
" if d!={'StageName':'dev','JWTSecret':os.environ['MOCK_SECRET'],'JWTExpiresIn':'1d'}:raise RuntimeError('parameters mismatch')",
" if stat.S_IMODE(p.stat().st_mode)!=0o600:raise RuntimeError('not mode 600')",
" if os.environ.get('JWT_SECRET'):raise RuntimeError('secret forwarded in AWS environment')",
" if os.environ['MOCK_SECRET'] in ' '.join(a):raise RuntimeError('plaintext argv')",
" if os.environ.get('MOCK_FAIL_DEPLOY')=='1':sys.exit(41)",
"elif a[:2]==['cloudformation','describe-stacks']:",
" for k,v in [('FrontendBucketName','frontend-qa'),('FrontendWebsiteURL','http://example.invalid'),('FilesBucketName','private-qa'),('AppTableName','table-qa'),('NotificationQueueURL','https://example.invalid/q'),('BackendFunctionName','fn-qa'),('WorkerFunctionName','worker-qa'),('ApiBaseURL','https://api.example.invalid/dev')]:print(k+'\\t'+v)",
"elif a[:2]==['s3','sync']:",
" src,dest=a[2:4]",
" if src.startswith('s3://'):",
"  if os.environ.get('MOCK_FAIL_BACKUP')=='1':sys.exit(42)",
"  shutil.copytree(os.environ['MOCK_PREVIOUS'],dest,dirs_exist_ok=True)",
" else:pathlib.Path(os.environ['MOCK_UPLOADED']).write_text('mock-upload-only')",
"else:raise RuntimeError('Unexpected fake AWS operation')",
].join('\n')+'\n';
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'unistore-phase6-'));
 for(const n of ['scripts/deploy-infra.sh','scripts/deploy-frontend.sh','scripts/deploy-all.sh','scripts/lib/common.sh','scripts/lib/stack-outputs.sh','scripts/lib/frontend-release-manifest.cjs']){
  const dest=path.join(root,n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(repo,n),dest);
 }
 const artifact=path.join(root,'backend/.build/lambda');
 fs.mkdirSync(path.join(artifact,'node_modules'),{recursive:true});fs.mkdirSync(path.join(artifact,'src'),{recursive:true});
 for(const n of ['package.json','package-lock.json'])fs.writeFileSync(path.join(artifact,n),'{}\n');
 for(const n of ['lambda.js','worker.js'])fs.writeFileSync(path.join(artifact,'src',n),'//mock\n');
 fs.mkdirSync(path.join(root,'infrastructure'));
 fs.writeFileSync(path.join(root,'infrastructure/template.yaml'),'mock');
 const front=path.join(root,'frontend');fs.mkdirSync(path.join(front,'out/_next'),{recursive:true});
 for(const n of ['package.json','package-lock.json'])fs.writeFileSync(path.join(front,n),'{}\n');
 fs.writeFileSync(path.join(front,'out/index.html'),'<h1>new</h1>\n');
 fs.writeFileSync(path.join(front,'out/_next/main.js'),'console.log(1)');
 const previous=path.join(root,'old-website');fs.mkdirSync(previous);fs.writeFileSync(path.join(previous,'index.html'),'<h1>old</h1>\n');
 const bin=path.join(root,'fake-bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'aws'),mock,{mode:0o700});
 fs.writeFileSync(path.join(bin,'npm'),'#!/bin/sh\nexit 0\n',{mode:0o700});
 const secret='SYNTHETIC_ONLY_spaces "quotes" characters';
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,AWS_REGION:'us-east-1',
  STACK_NAME:'unistore-hub-dev',STAGE_NAME:'dev',JWT_EXPIRES_IN:'1d',JWT_SECRET:secret,MOCK_SECRET:secret,
  MOCK_LOG:path.join(root,'mock-argv.jsonl'),MOCK_PREVIOUS:previous,MOCK_UPLOADED:path.join(root,'uploaded'),
  ApiBaseURL:'https://api.example.invalid/dev',FrontendBucketName:'frontend-qa'};
 return {root,env,secret};
}
function run(f,script,extra={}){return cp.spawnSync('bash',[path.join(f.root,'scripts',script)],{cwd:f.root,env:{...f.env,...extra},encoding:'utf8',timeout:30000});}
test('CloudFormation deploy uses 0600 JSON overrides with no secret in AWS argv',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const r=run(f,'deploy-infra.sh');assert.equal(r.status,0,r.stderr);
 assert.ok(!((r.stdout||'')+(r.stderr||'')).includes(f.secret));
 const log=fs.readFileSync(f.env.MOCK_LOG,'utf8');assert.ok(log.includes('file://'));assert.ok(!log.includes(f.secret));
 assert.deepEqual(fs.readdirSync(path.join(f.root,'scripts')).filter(n=>n.startsWith('.deploy-infra.')),[]);
});
test('CloudFormation handles a shell-local JWT_SECRET without an export',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const env={...f.env};delete env.JWT_SECRET;
 const script=path.join(f.root,'scripts/deploy-infra.sh');
 const r=cp.spawnSync('bash',[
  '-c','JWT_SECRET="$MOCK_SECRET"; source "$1"','phase8-shell',script,
 ],{cwd:f.root,env,encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stderr);
 assert.ok(!((r.stdout||'')+(r.stderr||'')).includes(f.secret));
 const log=fs.readFileSync(f.env.MOCK_LOG,'utf8');
 assert.ok(log.includes('file://'));
 assert.ok(!log.includes(f.secret));
 assert.deepEqual(fs.readdirSync(path.join(f.root,'scripts')).filter(n=>n.startsWith('.deploy-infra.')),[]);
});
test('canonical deploy-all passes JWT only to the infrastructure subprocess',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 for(const file of ['backend/package.json','backend/package-lock.json']){
  fs.writeFileSync(path.join(f.root,file),'{}\n');
 }
 const bin=path.join(f.root,'fake-bin'),log=path.join(f.root,'subprocess-env.jsonl');
 const probe=[
  '#!/usr/bin/env python3',
  'import json, os, pathlib, sys',
  'name=pathlib.Path(sys.argv[1]).name',
  "has_secret=bool(os.environ.get('JWT_SECRET'))",
  "if has_secret != (name=='deploy-infra.sh'): raise RuntimeError('unexpected JWT inheritance for '+name)",
  "with open(os.environ['MOCK_STEP_LOG'],'a') as f: f.write(json.dumps([name,has_secret])+'\\n')",
 ].join('\n')+'\n';
 fs.writeFileSync(path.join(bin,'bash'),probe,{mode:0o700});
 fs.writeFileSync(path.join(bin,'node'),
  '#!/usr/bin/env python3\nimport os\nassert not os.environ.get("JWT_SECRET")\n',
  {mode:0o700});
 const env={...f.env,MOCK_STEP_LOG:log};
 const runResult=cp.spawnSync('/bin/bash',[path.join(f.root,'scripts/deploy-all.sh')],{
  cwd:f.root,env,encoding:'utf8',timeout:30000,
 });
 assert.equal(runResult.status,0,runResult.stderr);
 assert.deepEqual(fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse),[
  ['build-backend.sh',false],
  ['deploy-infra.sh',true],
  ['deploy-frontend.sh',false],
 ]);
 assert.ok(!((runResult.stdout||'')+(runResult.stderr||'')).includes(f.secret));
});
test('CloudFormation failure also removes private parameter file',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const r=run(f,'deploy-infra.sh',{MOCK_FAIL_DEPLOY:'1'});assert.notEqual(r.status,0);
 assert.ok(!((r.stdout||'')+(r.stderr||'')).includes(f.secret));
 assert.deepEqual(fs.readdirSync(path.join(f.root,'scripts')).filter(n=>n.startsWith('.deploy-infra.')),[]);
});
test('Frontend captures old release with hash manifest before mock upload',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const r=run(f,'deploy-frontend.sh');assert.equal(r.status,0,r.stderr);
 assert.ok(fs.existsSync(f.env.MOCK_UPLOADED));
 const base=path.join(f.root,'scripts/.releases');const dirs=fs.readdirSync(base);assert.equal(dirs.length,1);
 const release=path.join(base,dirs[0]),old=path.join(release,'previous');
 assert.equal(fs.readFileSync(path.join(old,'index.html'),'utf8'),'<h1>old</h1>\n');
 assert.equal(manifest.verifyManifest(old,path.join(release,'previous-manifest.json')).fileCount,1);
 assert.equal(manifest.verifyManifest(path.join(f.root,'frontend/out'),path.join(release,'candidate-manifest.json')).fileCount,2);
 assert.equal(fs.statSync(path.join(release,'previous-manifest.json')).mode&0o777,0o600);
 fs.writeFileSync(path.join(old,'index.html'),'tampered');
 assert.throws(()=>manifest.verifyManifest(old,path.join(release,'previous-manifest.json')));
});
test('Upload fails closed when prior website snapshot cannot be read',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const r=run(f,'deploy-frontend.sh',{MOCK_FAIL_BACKUP:'1'});
 assert.notEqual(r.status,0);assert.equal(fs.existsSync(f.env.MOCK_UPLOADED),false);
});
test('local-only restore rehearsal recreates an identical last-known-good website',t=>{
 const f=fixture();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const r=run(f,'deploy-frontend.sh');assert.equal(r.status,0,r.stderr);
 const base=path.join(f.root,'scripts/.releases');
 const release=path.join(base,fs.readdirSync(base)[0]);
 const snapshot=path.join(release,'previous');
 const destination=path.join(f.root,'isolated-restore-target');
 fs.cpSync(snapshot,destination,{recursive:true});
 assert.equal(manifest.verifyManifest(destination,path.join(release,'previous-manifest.json')).fileCount,1);
 assert.equal(fs.readFileSync(path.join(destination,'index.html'),'utf8'),'<h1>old</h1>\n');
});

test('Release manifest rejects symlinks and self-inclusion',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unistore-manifest-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'assets');fs.mkdirSync(root);fs.writeFileSync(path.join(root,'index.html'),'ok');
 assert.throws(()=>manifest.writeManifest(root,path.join(root,'manifest.json')));
 fs.symlinkSync(path.join(root,'index.html'),path.join(root,'link'));
 assert.throws(()=>manifest.writeManifest(root,path.join(dir,'manifest.json')));
});
