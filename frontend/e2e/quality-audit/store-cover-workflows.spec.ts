import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { establishSeedRoleSession, getSeedRoleToken, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=", "base64");
const pngFile = { name:"shop.png", mimeType:"image/png", buffer:PNG };
const base = "/api/v1/organizations/" + ids.organizationId;
const now = "2026-10-26T04:00:00.000Z";
const pictureKey = "stores/" + ids.organizationId + "/" + ids.storeId + "/11111111-1111-4111-8111-111111111111";

test("Store Settings is the only edit/status entry and saves selected cover through PUT then PATCH", async ({ browser,request })=>{
  const {frontend} = localAuditTargets();
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await establishSeedRoleSession(context,request,"organizationAdmin");
  let stored = {
    storeId:ids.storeId, organizationId:ids.organizationId, name:"Test Store", description:"",
    imageKey:null as string|null, imageUrl:null as string|null, status:"ACTIVE",
    createdAt:now,updatedAt:now,
  };
  const writes:string[]=[];
  const signedPut=frontend+"/__qa_store_cover__/put";
  const imageUrl=frontend+"/__qa_store_cover__/cover.png";
  await context.route("**/*",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,method=req.method();
    const response=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
    if(path===base+"/stores/"+ids.storeId && method==="GET") return response(stored);
    if(path===base+"/stores/"+ids.storeId && method==="PATCH"){
      const body=req.postDataJSON() as Partial<typeof stored>;
      writes.push("PATCH:"+Object.keys(body).join(","));
      stored={...stored,...body, imageUrl:body.imageKey ? imageUrl:stored.imageUrl};
      return response(stored);
    }
    if(path===base+"/stores/"+ids.storeId+"/image-upload-url" && method==="POST"){
      writes.push("SIGN");return response({objectKey:pictureKey,url:signedPut,method:"PUT",expiresInSeconds:900});
    }
    if(path==="/__qa_store_cover__/put" && method==="PUT"){writes.push("PUT");return route.fulfill({status:200,headers:{"Access-Control-Allow-Origin":"*"},body:""});}
    if(path==="/__qa_store_cover__/cover.png"){return route.fulfill({status:200,contentType:"image/png",body:PNG});}
    return route.continue();
  });
  const page=await context.newPage();
  try {
    const org=encodeURIComponent(ids.organizationId);
    await page.goto(frontend+"/org/stores/?organizationId="+org);
    await expect(page.getByRole("heading",{name:"ร้านค้า",exact:true})).toBeVisible();
    expect(await page.getByRole("button",{name:"แก้ไขข้อมูล"}).count()).toBe(0);
    expect(await page.getByRole("button",{name:"ปิดใช้งาน"}).count()).toBe(0);
    await page.goto(frontend+"/org/stores/view/?organizationId="+org+"&storeId="+ids.storeId+"&tab=settings");
    await expect(page.getByText("ตั้งค่าร้านค้า",{exact:true})).toBeVisible();
    await expect(page.locator("#workspace-store-cover")).toBeVisible();
    await expect(page.getByRole("button",{name:"ปิดใช้งานร้าน"})).toBeVisible();
    await page.locator("#workspace-store-cover").setInputFiles(pngFile);
    await page.getByRole("button",{name:"บันทึกรูปหน้าร้าน"}).click();
    await expect(page.getByText("อัปโหลดรูปหน้าร้านแล้ว")).toBeVisible();
    await expect(page.getByRole("img",{name:"รูปหน้าร้าน Test Store"})).toBeVisible();
    expect(writes.slice(0,3)).toEqual(["SIGN","PUT","PATCH:imageKey"]);
    await page.getByRole("button",{name:"ปิดใช้งานร้าน"}).click();
    await expect(page.getByRole("dialog",{name:"ยืนยันปิดใช้งานร้าน"})).toBeVisible();
    await page.getByRole("dialog",{name:"ยืนยันปิดใช้งานร้าน"}).getByRole("button",{name:"ปิดใช้งาน"}).click();
    await expect(page.getByRole("button",{name:"เปิดใช้งานร้าน"})).toBeVisible();
    expect(stored.status).toBe("INACTIVE");
    for(const width of [320,390,768,1024]){
      await page.setViewportSize({width,height:820});
      expect(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),"settings overflow "+width).toBeLessThanOrEqual(2);
    }
  }finally{await context.close();}
});

test("Create Store modal accepts optional cover and uploads only after store creation",async({browser,request})=>{
  const {frontend}=localAuditTargets();
  const ctx=await browser.newContext({viewport:{width:1024,height:800}});
  await establishSeedRoleSession(ctx,request,"organizationAdmin");
  const id="22222222-2222-4222-8222-222222222222";
  const key="stores/"+ids.organizationId+"/"+id+"/11111111-1111-4111-8111-111111111111";
  const writes:string[]=[];
  let created: {storeId:string;organizationId:string;name:string;description:string;status:string;imageKey:string|null;imageUrl:string|null;createdAt:string;updatedAt:string}|null=null;
  await ctx.route("**/*",async route=>{
    const r=route.request(),path=new URL(r.url()).pathname,method=r.method();
    const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
    if(path===base+"/stores" && method==="GET"){
      return ok({items:created?[created]:[],nextCursor:null});
    }
    if(path===base+"/stores" && method==="POST"){
      writes.push("CREATE");
      const body=r.postDataJSON() as {name:string;description:string};
      created={...body,storeId:id,organizationId:ids.organizationId,status:"ACTIVE",imageKey:null,imageUrl:null,createdAt:now,updatedAt:now};
      return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({success:true,data:created})});
    }
    if(path===base+"/stores/"+id+"/image-upload-url" && method==="POST"){
      writes.push("SIGN");return ok({objectKey:key,url:frontend+"/__qa_store_cover__/create-put",method:"PUT",expiresInSeconds:900});
    }
    if(path==="/__qa_store_cover__/create-put" && method==="PUT"){writes.push("PUT");return route.fulfill({status:200});}
    if(path===base+"/stores/"+id && method==="PATCH"){
      if (!created) return route.fulfill({ status:404 });
      writes.push("PATCH");
      created={...created,imageKey:key,imageUrl:frontend+"/__qa_store_cover__/new.png"};
      return ok(created);
    }
    if(path===base+"/stores/"+id && method==="GET"){writes.push("READ");return ok(created);}
    if(path==="/__qa_store_cover__/new.png")return route.fulfill({status:200,contentType:"image/png",body:PNG});
    return route.continue();
  });
  const page=await ctx.newPage();
  try{
    await page.goto(frontend+"/org/stores/?organizationId="+ids.organizationId);
    await page.getByRole("button",{name:"+ สร้างร้านค้า"}).click();
    const dialog=page.getByRole("dialog",{name:"สร้างร้านค้าใหม่"});
    await dialog.locator("#store-create-name").fill("New Cover Shop");
    await dialog.locator("#store-create-cover").setInputFiles(pngFile);
    await dialog.getByRole("button",{name:"สร้างร้านค้า"}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("New Cover Shop",{exact:true})).toBeVisible();
    expect(writes).toEqual(["CREATE","SIGN","PUT","PATCH","READ"]);
  }finally{await ctx.close();}
});

test("real local S3 store-cover upload from create and edit", async ({ browser, request }) => {
  test.skip(process.env.E2E_LIVE_S3 !== "1", "Opt-in for real LocalStack object writes");
  test.setTimeout(90000);
  const {frontend,api}=localAuditTargets();
  const context=await browser.newContext({ viewport:{width:1100,height:850} });
  await establishSeedRoleSession(context,request,"organizationAdmin");
  const page=await context.newPage();
  const name="Live QA Cover "+randomUUID().slice(0,8);
  let storeId: string | null=null;
  const mutations:string[]=[];
  page.on("request",r=>{
    if (r.method()==="POST"&&r.url().includes("image-upload-url")) mutations.push("SIGN");
    if (r.method()==="PUT") mutations.push("PUT");
    if (r.method()==="PATCH"&&r.url().includes("/stores/")) mutations.push("PATCH");
  });
  try {
    await page.goto(frontend+"/org/stores/?organizationId="+ids.organizationId);
    await page.getByRole("button",{name:"+ สร้างร้านค้า"}).click();
    const dialog=page.getByRole("dialog",{name:"สร้างร้านค้าใหม่"});
    await dialog.locator("#store-create-name").fill(name);
    await dialog.locator("#store-create-cover").setInputFiles({name:"first.png",mimeType:"image/png",buffer:PNG});
    await dialog.getByRole("button",{name:"สร้างร้านค้า"}).click();
    await expect(dialog).toHaveCount(0);
    const row=page.locator("article").filter({has:page.getByRole("heading",{name,exact:true})});
    await expect(row).toBeVisible();
    const href=await row.getByRole("link",{name:"จัดการร้านค้า"}).getAttribute("href");
    if (!href) throw new Error("New store workspace URL missing");
    storeId=new URL(href,frontend).searchParams.get("storeId");
    if(!storeId)throw new Error("Missing new store ID");
    console.log("Create upload requests:",mutations.join(","));
    expect(mutations.slice(0,3)).toEqual(["SIGN","PUT","PATCH"]);
    await page.goto(frontend+"/org/stores/view/?organizationId="+ids.organizationId+"&storeId="+storeId+"&tab=settings");
    await expect(page.locator("#workspace-store-cover")).toBeVisible();
    const image=page.getByRole("img",{name:"รูปหน้าร้าน "+name});
    await expect(image).toBeVisible();
    await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const initialSrc=await image.getAttribute("src");
    await page.locator("#workspace-store-cover").setInputFiles({name:"second.png",mimeType:"image/png",buffer:PNG});
    await page.getByRole("button",{name:"บันทึกรูปหน้าร้าน"}).click();
    await expect(page.getByText("อัปโหลดรูปหน้าร้านแล้ว")).toBeVisible();
    await expect.poll(async()=>image.getAttribute("src")).not.toBe(initialSrc);
    await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    console.log("Create + edit S3 requests:",mutations.join(","));
    expect(mutations.filter(s=>s==="SIGN")).toHaveLength(2);
    expect(mutations.filter(s=>s==="PUT")).toHaveLength(2);
    expect(mutations.filter(s=>s==="PATCH")).toHaveLength(2);
    const publicResponse=await request.get(api+"/storefront/directory");
    expect(publicResponse.ok()).toBeTruthy();
    const data=await publicResponse.json();
    expect(data.success).toBe(true);
    const orgEntry=data.data.find((entry:{organization:{organizationId:string}})=>entry.organization.organizationId===ids.organizationId);
    const publicStore=orgEntry?.stores?.find((entry:{storeId:string})=>entry.storeId===storeId);
    expect(publicStore?.imageUrl).toBeTruthy();
    expect(publicStore).not.toHaveProperty("imageKey");
    const publicImage=await request.get(publicStore.imageUrl);
    expect(publicImage.status()).toBe(200);
    expect(publicImage.headers()["content-type"]).toContain("image/png");
  } finally {
    if(storeId) {
      const token=await getSeedRoleToken(request,"organizationAdmin");
      const closed=await request.patch(api+"/organizations/"+ids.organizationId+"/stores/"+storeId,{
        headers:{Authorization:"Bearer "+token}, data:{status:"INACTIVE"}
      });
      expect(closed.ok()).toBeTruthy();
      console.log("Retained disposable local store, now inactive:",storeId);
    }
    await context.close();
  }
});
