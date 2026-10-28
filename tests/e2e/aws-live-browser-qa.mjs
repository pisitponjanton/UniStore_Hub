#!/usr/bin/env node
// Read-only post-deploy Chromium QA on authorized synthetic AWS Academy lab.
// Keeps screenshots under tests/.tmp (ignored). Excludes pickup QR and tokens.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(path.resolve('frontend/node_modules/playwright'));
const output=path.resolve('tests/.tmp/aws-live-browser');
fs.mkdirSync(output,{recursive:true});
const web='http://unistore-hub-dev-frontendbucket-sffxu2ps92bu.s3-website-us-east-1.amazonaws.com';
const api='https://bvmokvszxi.execute-api.us-east-1.amazonaws.com/dev/api/v1';
const org='e27c3a6b-0de9-4c89-9b16-139064568abe';
const store='05c39c17-c815-4e6d-99e8-363b0ebb91dc';
const product='ef911d94-7136-4346-af54-96caaa1098a3';
const campaign='d92d3d8b-f11d-4da2-8d8c-af4b88f221b6';
const order='5dc8a6f9-6f0c-4112-9d9b-033cac771a6d';
const fixtures={buyer:'/tmp/unistore-buyer-live-qa-20261028/account.json',owner:'/tmp/unistore-live-qa-20261028/account.json'};
const roleFilter=process.env.QA_ROLE||'public';
if(!['public','buyer','owner'].includes(roleFilter))throw Error('QA_ROLE must be public/buyer/owner');
const results={timestamp:new Date().toISOString(),sourceCommit:'c02ff57',environment:'AWS Academy Learner Lab (us-east-1)',readOnly:true,pages:[],authorizations:[],warnings:[]};
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if(!fs.existsSync(chrome)) throw Error('Chrome is unavailable');
for(const f of Object.values(fixtures))if(!fs.existsSync(f))throw Error('Existing QA fixture unavailable; refusing to register new accounts');
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(role){
 const context=await browser.newContext({viewport:{width:1440,height:900},locale:'th-TH',timezoneId:'Asia/Bangkok'});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message.slice(0,150)));
 if(role!=='public'){
  const info=JSON.parse(fs.readFileSync(fixtures[role],'utf8'));
  await page.goto(web+'/login/',{waitUntil:'domcontentloaded',timeout:22000});
  await page.locator('input[type=email]').fill(info.email);
  await page.locator('input[type=password]').fill(info.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(u=>!u.pathname.includes('/login'),{timeout:22000});
  await wait(900);
 }
 return {context,page,errors};
}
async function pageCheck(role,ctx,url,needle,opts={}){
 const mobile=!!opts.mobile;const denied=!!opts.denied;
 await ctx.page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:900});
 const resp=await ctx.page.goto(web+url,{waitUntil:'domcontentloaded',timeout:22000});
 await wait(opts.wait||1650);
 // Wait for async store/order data to settle before capturing report figures.
 try {await ctx.page.waitForFunction(()=>!/(กำลังโหลดร้านค้า|กำลังโหลดคำสั่งซื้อของคุณ)/.test(document.body?.innerText||''),null,{timeout:8000})}catch{}
 if(needle&&opts.awaitText!==false){
  try{await ctx.page.waitForFunction(expected=>document.body?.innerText?.includes(expected),needle,{timeout:6500})}catch{}
 }
 const view=await ctx.page.evaluate(()=>({
  body:document.body?.innerText||'',width:document.documentElement.scrollWidth,viewport:window.innerWidth,
  headings:Array.from(document.querySelectorAll('h1,h2')).slice(0,5).map(e=>e.textContent.trim().slice(0,70))
 }));
 const errors=ctx.errors.splice(0);
 const noAccess=/ไม่มีสิทธิ์เข้าถึง|Access denied|Forbidden/i.test(view.body);
 const hasText=needle?view.body.includes(needle):true;
 const loading=/กำลังโหลดข้อมูล|กำลังโหลดหน้า|กำลังโหลดร้านค้า|กำลังโหลดคำสั่งซื้อของคุณ/.test(view.body);
 const notFound=/404: This page could not be found|ไม่พบหน้าที่ต้องการ/.test(view.body);
 const pass=resp?.status()===200&&hasText&&!loading&&!notFound&&!errors.length&&(denied?noAccess:!noAccess);
 const slug=url.replace(/[^a-zA-Z0-9]+/g,'-').slice(0,65);
 const file=role+(mobile?'-mobile':'')+'-'+slug+'.png';
 if(/pickup|token|secret/i.test(file))throw Error('Refuse secret screenshot');
 await ctx.page.screenshot({path:path.join(output,file),fullPage:true});
 const row={role,url,viewport:mobile?'390x844':'1440x900',http:resp?.status(),status:pass?'PASS':'FAIL',requiredText:needle,
  textPresent:hasText,permissionDenied:noAccess,horizontalOverflow:view.width>view.viewport+4,
  headings:view.headings,errors,evidence:file};
 results.pages.push(row);
 if(row.horizontalOverflow)results.warnings.push('Horizontal overflow on '+role+' '+url);
 console.log('PAGE',row.status,role,url,'http='+row.http,'overflow='+row.horizontalOverflow);
}
async function authCheck(role,ctx,route,expected){
 const data=await ctx.page.evaluate(async params=>{
  const jwt=sessionStorage.getItem('unistoreHub.accessToken');
  const res=await fetch(params.api+params.route,{headers:{Accept:'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})}});
  let code=null;try{let j=await res.json();code=j.error?.code||null}catch{}
  return {status:res.status,code};
 },{api,route});
 const row={role,route,expectedHttp:expected,actualHttp:data.status,errorCode:data.code,status:expected.includes(data.status)?'PASS':'FAIL'};
 results.authorizations.push(row);console.log('AUTH',row.status,role,route,data.status);
}
try{
 if(roleFilter==='public'){
 let ctx=await setup('public');
 await pageCheck('public',ctx,'/','UniStore Hub');
 await pageCheck('public',ctx,'/shops/','ร้าน');
 await pageCheck('public',ctx,'/stores/view/?organizationId='+org+'&storeId='+store,'UniStore QA Test Shop');
 await pageCheck('public',ctx,'/shops/','เข้าสู่ระบบเพื่อทำรายการต่อ',{mobile:true});
 await ctx.context.close();
 }
 if(roleFilter==='buyer'){
 let ctx=await setup('buyer');
 await pageCheck('buyer',ctx,'/','UniStore Hub');
 await pageCheck('buyer',ctx,'/my/orders/','คำสั่งซื้อ');
 await pageCheck('buyer',ctx,'/my/order/?orderId='+order,'รับสินค้าแล้ว');
 await pageCheck('buyer',ctx,'/notifications/','การแจ้งเตือน',{wait:2100});
 await pageCheck('buyer',ctx,'/products/view/?organizationId='+org+'&productId='+product,'QA TEST ONLY');
 await pageCheck('buyer',ctx,'/my/orders/','คำสั่งซื้อ',{mobile:true});
 await pageCheck('buyer',ctx,'/notifications/','การแจ้งเตือน',{mobile:true});
 await pageCheck('buyer',ctx,'/platform/organizations/','ไม่มีสิทธิ์เข้าถึง',{denied:true});
 await authCheck('buyer',ctx,'/platform/organizations',[403]);
 await authCheck('buyer',ctx,'/organizations/'+org+'/orders',[403,404]);
 await ctx.context.close();
 }
 if(roleFilter==='owner'){
 let ctx=await setup('owner');
 await pageCheck('owner',ctx,'/org/dashboard/?organizationId='+org,'ภาพรวม');
 await pageCheck('owner',ctx,'/org/stores/?organizationId='+org,'ร้านค้า');
 await pageCheck('owner',ctx,'/org/products/?organizationId='+org,'เลือกร้านค้าสำหรับจัดการสินค้า');
 await pageCheck('owner',ctx,'/org/orders/?organizationId='+org,'คำสั่งซื้อ');
 await pageCheck('owner',ctx,'/org/payments/?organizationId='+org,'การชำระเงิน');
 await pageCheck('owner',ctx,'/org/production/?organizationId='+org,'การผลิต');
 await pageCheck('owner',ctx,'/org/audit/?organizationId='+org,'กิจกรรม');
 await pageCheck('owner',ctx,'/org/stores/campaign/?organizationId='+org+'&storeId='+store+'&campaignId='+campaign,'พร้อมรับสินค้า');
 await pageCheck('owner',ctx,'/org/dashboard/?organizationId='+org,'ภาพรวม',{mobile:true});
 await authCheck('owner',ctx,'/platform/organizations',[403]);
 await ctx.context.close();
 }
}catch(e){results.warnings.push('SCRIPT_ERROR: '+e.message.slice(0,280));console.error('SCRIPT_ERROR',e.message.slice(0,280));process.exitCode=2}
finally{
 await browser.close();
 results.summary={
  totalPages:results.pages.length,
  passedPages:results.pages.filter(x=>x.status==='PASS').length,
  failedPages:results.pages.filter(x=>x.status==='FAIL').length,
  authPassed:results.authorizations.filter(x=>x.status==='PASS').length,
  authTotal:results.authorizations.length,
  screenshots:results.pages.length,
  warnings:results.warnings.length
 };
 fs.writeFileSync(path.join(output,'results-'+roleFilter+'.json'),JSON.stringify(results,null,2),{mode:0o600});
 console.log('SUMMARY',JSON.stringify(results.summary));
}
