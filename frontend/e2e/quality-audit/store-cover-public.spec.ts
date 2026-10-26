import { expect, test } from "@playwright/test";
import { localAuditTargets } from "./fixture-guard";

const photo=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y2A2SYAAAAASUVORK5CYII=","base64");
const org="c9d41c58-3af7-44a4-98d4-42e17fc1da93";
const shop="f6bb6bc0-5bd7-4b4b-b7c3-64a263b2bfa1";
const base="/api/v1/storefront/organizations/"+org+"/stores";
const store={storeId:shop,organizationId:org,name:"Uni Club",description:"Campus store",status:"ACTIVE",
 imageUrl:"http://localhost:3000/__qa_store_public__/store.png",
 createdAt:"2026-10-26T00:00:00.000Z",updatedAt:"2026-10-26T00:00:00.000Z"};
const organization={organizationId:org,name:"Campus Organization",description:"Campus",status:"ACTIVE",
 createdAt:"2026-10-26T00:00:00.000Z",updatedAt:"2026-10-26T00:00:00.000Z"};
test("public directory and store detail show real cover within responsive frames, broken URL shows fallback",async({browser})=>{
 const {frontend}=localAuditTargets();
 const ctx=await browser.newContext({viewport:{width:390,height:820},reducedMotion:"reduce"});
 let broken=false;
 await ctx.route("**/*",async route=>{
   const url=new URL(route.request().url()),p=url.pathname;
   const ok=(data:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
   if(p==="/api/v1/storefront/directory")return ok([{organization,stores:[store]}]);
   if(p===base+"/"+shop)return ok(store);
   if(p===base+"/"+shop+"/products"||p===base+"/"+shop+"/campaigns")
     return ok({items:[],nextCursor:null});
   if(p==="/__qa_store_public__/store.png")return broken?route.fulfill({status:404}):route.fulfill({status:200,contentType:"image/png",body:photo});
   return route.continue();
 });
 const page=await ctx.newPage();
 try{
   await page.goto(frontend+"/",{waitUntil:"domcontentloaded"});
   const card=page.getByRole("link",{name:"เข้าร้าน Uni Club ของ Campus Organization"});
   await expect(card).toBeVisible();
   const image=card.getByRole("img",{name:"รูปหน้าร้าน Uni Club"});
   await expect(image).toBeVisible();
   for(const width of [320,390,750,1024,1440]){
     await page.setViewportSize({width,height:870});
     expect(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),"directory overflow "+width).toBeLessThanOrEqual(2);
     const box=await card.locator('[class*="storeCardMedia"]').evaluate(el=>({
       frame:el.getBoundingClientRect().width,photo:el.querySelector("img")?.getBoundingClientRect().width??0,
     }));
     expect(box.photo).toBeLessThanOrEqual(box.frame+2);
   }
   await card.click();
   await expect(page.getByRole("heading",{name:"Uni Club",level:1})).toBeVisible();
   await expect(page.getByRole("img",{name:"รูปหน้าร้าน Uni Club"})).toBeVisible();
   for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:820});
     expect(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),"detail overflow "+width).toBeLessThanOrEqual(2);
   }
   broken=true;
   await page.reload();
   await expect(page.getByText("ไม่สามารถแสดงรูปหน้าร้านได้")).toBeVisible();
 }finally{await ctx.close();}
});
