import {randomUUID} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {expect,test,type Page} from "@playwright/test";
import {establishSeedRoleSession,getSeedRoleToken,LOCAL_SEED_ENTITY_IDS as ids} from "../support/seed-auth";
import {localAuditTargets} from "./fixture-guard";
import {writeActionLedger,type ActionOutcome} from "./result-ledger";

const at="2026-10-17T12:00:00.000Z",root="/api/v1/organizations/"+ids.organizationId,endpoint=root+"/products/"+ids.productId;
const store={storeId:ids.storeId,organizationId:ids.organizationId,name:"UXQA Store",description:"Synthetic only",status:"ACTIVE",createdAt:at,updatedAt:at};
const product={productId:ids.productId,organizationId:ids.organizationId,storeId:ids.storeId,name:"UXQA Shirt",description:"Synthetic only",status:"ACTIVE",imageKey:null as string|null,imageUrl:null,variants:[],createdAt:at,updatedAt:at};
const key="uxqa-synthetic-saved-image-key";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
type Proof={id:string;state:string;image:string;note:string;role:"organizationAdmin";viewport:"390x844"};

test("readback after successful product image PATCH: retry GET only, no duplicate signed PUT/PATCH",async({browser,request})=>{
 test.setTimeout(165000);
 const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
 await mkdir(dir,{recursive:true});
 const proofs:Proof[]=[];
 let signed=0,put=0,patch=0,readback=0,unexpected=0,hasCommitted=false;
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 await ctx.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(method==="GET"&&path===root+"/stores")return ok({items:[store],nextCursor:null});
  if(method==="GET"&&path===root+"/products")return ok({items:[product],nextCursor:null});
  if(method==="POST"&&path===endpoint+"/image-upload-url"){
   signed++;expect(req.postDataJSON()).toEqual({contentType:"image/png"});
   return ok({objectKey:key,method:"PUT",url:frontend+"/__uxqa_readback_test__/image",expiresInSeconds:900});
  }
  if(method==="PUT"&&path==="/__uxqa_readback_test__/image"){
   put++;expect(req.headers()["content-type"]).toBe("image/png");
   await route.fulfill({status:200,body:""});return;
  }
  if(method==="PATCH"&&path===endpoint){
   patch++;expect(req.postDataJSON()).toEqual({imageKey:key});hasCommitted=true;
   return ok({...product,imageKey:key});
  }
  if(method==="GET"&&path===endpoint){
   if(!hasCommitted)return ok(product);
   readback++;
   if(readback<=2)return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"UXQA simulated readback outage"}})});
   if(readback===3)return ok(product); // stale successful GET must NOT be presented as verified
   return ok({...product,imageKey:key});
  }
  if(!["GET","HEAD","OPTIONS"].includes(method)){unexpected++;return route.abort("blockedbyclient");}
  return route.continue();
 });
 async function screenshot(page:Page,state:string,note:string){
  const image="FE-UX-18-15-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
  proofs.push({id:"FE-UX-18-15",state,image,note,role:"organizationAdmin",viewport:"390x844"});
 }
 try{
  const page=await ctx.newPage();
  await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+ids.storeId+"&tab=products",{waitUntil:"domcontentloaded"});
  const card=page.getByRole("heading",{name:product.name,exact:true}).first().locator("xpath=ancestor::article");
  await expect(card).toBeVisible();
  await card.getByRole("link",{name:"แก้ไขสินค้า"}).click();
  const file=page.locator("#product-image-"+ids.productId),action=page.getByRole("button",{name:"บันทึกรูป"});
  await expect(file).toBeEnabled();
  await file.setInputFiles({name:"uxqa-saved-image.png",mimeType:"image/png",buffer:png});
  await action.click();
  await expect.poll(()=>readback).toBe(1);
  const retry=page.getByRole("button",{name:"ตรวจสอบข้อมูลล่าสุดอีกครั้ง"});
  const result=page.locator("[data-product-upload-feedback]");
  await expect(page.getByText("บันทึกรูปสินค้าแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่สำเร็จ")).toBeVisible();
  await expect(result).toBeFocused();
  await expect(retry).toBeEnabled();
  await expect(file).toBeDisabled();
  await expect(action).toHaveCount(0);
  expect([signed,put,patch,readback]).toEqual([1,1,1,1]);
  await screenshot(page,"committed-readback-503","After successful PATCH, GET 503 shows explicit saved-but-not-verified message; no duplicate upload");
  await retry.click();
  await expect.poll(()=>readback).toBe(2);
  await expect(retry).toBeEnabled();
  await expect(result).toBeFocused();
  expect([signed,put,patch]).toEqual([1,1,1]);
  await screenshot(page,"verify-retry-503","Repeat 503 retries only Product GET and preserves recovery action");
  await retry.click();
  await expect.poll(()=>readback).toBe(3);
  await expect(retry).toBeEnabled();
  await expect(result).toBeFocused();
  await expect(page.getByText("บันทึกรูปสินค้าแล้ว แต่ข้อมูลล่าสุดยังไม่แสดงรูปที่บันทึก")).toBeVisible();
  expect([signed,put,patch]).toEqual([1,1,1]);
  await screenshot(page,"verify-stale-get","A stale 200 GET with old imageKey does not falsely confirm persisted image");
  await retry.click();
  await expect.poll(()=>readback).toBe(4);
  await expect(page.getByText("อัปโหลดและบันทึกรูปสินค้าเรียบร้อยแล้ว")).toBeVisible();
  await expect(result).toBeFocused();
  await expect(page.getByRole("heading",{name:"รูปสินค้า"})).toBeVisible();
  await expect(file).toBeEnabled();
  await expect(retry).toHaveCount(0);
  await expect(action).toHaveCount(0);
  expect([signed,put,patch,readback,unexpected]).toEqual([1,1,1,4,0]);
  await screenshot(page,"get-only-recovery-success","Once GET confirms the same image key, normal editor resumes without extra upload");
  await page.close();
 }finally{await ctx.close();}
 const b=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {actions:Array<{id:string;roles:string[];statesToTest:string[]}>;shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>};
 const entries:ActionOutcome[]=[...b.actions,...b.shellActions].map(x=>({actionId:x.id,role:x.roles[0]!,state:"all-declared-states",viewport:"not-executed",status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full state matrix still unverified: "+x.statesToTest.join(", ")}));
 for(const p of proofs)entries.push({actionId:p.id,role:p.role,state:p.state,viewport:p.viewport,status:"PASS",testRunId:runId,evidence:[p.image],notes:p.note+"; all writes intercepted"});
 await writeActionLedger(runId,entries);
 await writeFile(join(dir,"product-image-readback-recovery.json"),JSON.stringify({browserEngine:browser.browserType().name(),proofs,signed,put,patch,readback,unexpected,actualBusinessWrites:0,limitation:"Synthetic POST/PUT/PATCH/GET. Proves no duplicate browser mutation, not persistence or object storage consistency."},null,2)+"\n");
});


test("missing LocalStack image shows replaceable fallback instead of a broken thumbnail", async ({browser,request})=>{
 const {frontend}=localAuditTargets();
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await establishSeedRoleSession(ctx,request,"organizationAdmin");
 const page=await ctx.newPage();
 const key="products/"+ids.organizationId+"/"+ids.productId+"/11111111-1111-4111-8111-111111111111";
 const broken=frontend+"/__uxqa_missing_file__/missing.png";
 await ctx.route("**/*",async route=>{
  const req=route.request(),p=new URL(req.url()).pathname;
  const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
  if(req.method()==="GET"&&p===root+"/stores")return ok({items:[store],nextCursor:null});
  if(req.method()==="GET"&&p===root+"/stores/"+ids.storeId)return ok(store);
  if(req.method()==="GET"&&p===root+"/products")return ok({items:[product],nextCursor:null});
  if(req.method()==="GET"&&p===endpoint)return ok({...product,imageKey:key,imageUrl:broken});
  if(req.method()==="GET"&&p==="/__uxqa_missing_file__/missing.png")return route.fulfill({status:404,body:"not found"});
  if(!["GET","HEAD","OPTIONS"].includes(req.method()))return route.abort("blockedbyclient");
  return route.continue();
 });
 try{
  await page.goto(frontend+"/org/stores/product/?organizationId="+ids.organizationId+
   "&storeId="+ids.storeId+"&productId="+ids.productId,{waitUntil:"domcontentloaded"});
  await expect(page.getByText("โหลดรูปเดิมไม่สำเร็จ เลือกรูปใหม่ได้")).toBeVisible();
  await expect(page.locator("#product-image-"+ids.productId)).toBeEnabled();
  await expect(page.getByText("อัปโหลดไม่สำเร็จ")).toHaveCount(0);
 }finally{await ctx.close();}
});


test("product creation uploads its selected cover after CREATE and displays persisted readback", async ({ browser, request }) => {
  const { frontend } = localAuditTargets();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await establishSeedRoleSession(ctx, request, "organizationAdmin");
  const productId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const imageKey = "products/" + ids.organizationId + "/" + productId + "/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const picture = frontend + "/__qa_new_product_cover__/picture.png";
  const steps: string[] = [];
  const created = { ...product, productId, name: "Created with image" };
  const saved = { ...created, imageKey, imageUrl: picture };
  await ctx.route("**/*", async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
    const ok = (data: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify({ success: true, data }),
    });
    if (method === "GET" && path === root + "/stores/" + ids.storeId) return ok(store);
    if (method === "GET" && path === root + "/products") return ok({ items: [], nextCursor: null });
    if (method === "POST" && path === root + "/products") {
      steps.push("CREATE");
      expect(req.postDataJSON()).toMatchObject({ storeId: ids.storeId, name: created.name });
      return ok(created, 201);
    }
    if (method === "POST" && path === root + "/products/" + productId + "/image-upload-url") {
      steps.push("SIGN");
      return ok({ url: frontend + "/__qa_new_product_cover__/upload", objectKey: imageKey, method: "PUT", expiresInSeconds: 900 });
    }
    if (method === "PUT" && path === "/__qa_new_product_cover__/upload") {
      steps.push("PUT");
      expect(req.headers()["content-type"]).toBe("image/png");
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" } });
    }
    if (method === "PATCH" && path === root + "/products/" + productId) {
      steps.push("PATCH");
      expect(req.postDataJSON()).toEqual({ imageKey });
      return ok(saved);
    }
    if (method === "GET" && path === root + "/products/" + productId) {
      steps.push("READ");
      return ok(saved);
    }
    if (method === "GET" && path === "/__qa_new_product_cover__/picture.png")
      return route.fulfill({ status: 200, contentType: "image/png", body: png });
    return route.continue();
  });
  try {
    const page = await ctx.newPage();
    await page.goto(frontend + "/org/stores/view/?organizationId=" + ids.organizationId
      + "&storeId=" + ids.storeId + "&tab=products");
    await page.getByRole("button", { name: "+ เพิ่มสินค้า" }).click();
    const modal = page.getByRole("dialog", { name: "สร้างสินค้าใหม่" });
    await expect(modal.locator("#product-create-image")).toBeAttached();
    await modal.locator("#product-create-name").fill(created.name);
    await modal.locator("#product-create-image").setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
    await expect(modal.getByText("product.png")).toBeVisible();
    await modal.getByRole("button", { name: "สร้างสินค้า" }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByRole("img", { name: "รูปสินค้า " + created.name })).toBeVisible();
    await expect(page.getByText("สร้างสินค้า " + created.name + " แล้ว")).toBeVisible();
    expect(steps).toEqual(["CREATE", "SIGN", "PUT", "PATCH", "READ"]);
    expect(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth))).toBeLessThanOrEqual(2);
  } finally { await ctx.close(); }
});


test("real local S3 product-image upload during product creation", async ({ browser, request }) => {
  test.skip(process.env.E2E_LIVE_S3 !== "1", "Opt-in for real LocalStack object writes");
  test.setTimeout(90000);
  const { frontend, api } = localAuditTargets();
  const name = "Live QA Product " + randomUUID().slice(0, 8);
  const context = await browser.newContext({ viewport: { width: 1024, height: 850 } });
  await establishSeedRoleSession(context, request, "organizationAdmin");
  const page = await context.newPage();
  let productId: string | null = null;
  const actions: string[] = [];
  page.on("request", req => {
    if (req.method() === "POST" && req.url().includes("/image-upload-url")) actions.push("SIGN");
    if (req.method() === "PUT") actions.push("PUT");
    if (req.method() === "PATCH" && req.url().includes("/products/")) actions.push("PATCH");
  });
  try {
    await page.goto(frontend + "/org/stores/view/?organizationId=" + ids.organizationId
      + "&storeId=" + ids.storeId + "&tab=products");
    await page.getByRole("button", { name: "+ เพิ่มสินค้า" }).click();
    const modal = page.getByRole("dialog", { name: "สร้างสินค้าใหม่" });
    await modal.locator("#product-create-name").fill(name);
    await modal.locator("#product-create-image").setInputFiles({
      name: "created-product.png", mimeType: "image/png", buffer: png,
    });
    await modal.getByRole("button", { name: "สร้างสินค้า" }).click();
    await expect(modal).toHaveCount(0);
    const row = page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(row).toBeVisible();
    const href = await row.getByRole("link", { name: "แก้ไขสินค้า" }).getAttribute("href");
    if (!href) throw new Error("Created product link missing");
    productId = new URL(href, frontend).searchParams.get("productId");
    if (!productId) throw new Error("Created product ID missing");
    const image = row.getByRole("img", { name: "รูปสินค้า " + name });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(actions.slice(0, 3)).toEqual(["SIGN", "PUT", "PATCH"]);
    await row.getByRole("link", { name: "แก้ไขสินค้า" }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const detailImage = page.getByRole("img", { name: "รูปสินค้าปัจจุบันของ " + name });
    await expect(detailImage).toBeVisible();
    await expect.poll(() => detailImage.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  } finally {
    const token = await getSeedRoleToken(request, "organizationAdmin");
    if (!productId) {
      const list = await request.get(api + "/organizations/" + ids.organizationId + "/products?storeId=" + ids.storeId, {
        headers: { Authorization: "Bearer " + token },
      });
      if (list.ok()) {
        const data = await list.json();
        productId = data.data?.items?.find((entry: { productId: string; name: string }) => entry.name === name)?.productId ?? null;
      }
    }
    if (productId) {
      const closed = await request.delete(api + "/organizations/" + ids.organizationId + "/products/" + productId, {
        headers: { Authorization: "Bearer " + token },
      });
      expect(closed.ok(), "Disposable product was not deactivated").toBeTruthy();
    }
    await context.close();
  }
});
