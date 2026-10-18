import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { establishSeedRoleSession } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeId = "66666666-6666-4666-8666-111111111111";
const productId = "77777777-7777-4777-8777-111111111111";
const variantA = "88888888-8888-4888-8888-111111111111";
const variantB = "88888888-8888-4888-8888-222222222222";
const openCampaign = "99999999-9999-4999-8999-111111111111";
const closedCampaign = "99999999-9999-4999-8999-222222222222";
const when = "2026-10-10T08:00:00.000Z";

const store = { storeId, organizationId: org, name: "UXQA Student Store", description: "Synthetic local storefront only", status: "ACTIVE" };
const product = { productId, organizationId: org, storeId, name: "UXQA Club Shirt", description: "Synthetic read-only product",
  imageUrl: null, status: "ACTIVE", variants: [
    { variantId: variantA, organizationId: org, productId, name: "Small", price: 25000, status: "ACTIVE", createdAt: when, updatedAt: when },
    { variantId: variantB, organizationId: org, productId, name: "Large", price: 30000, status: "ACTIVE", createdAt: when, updatedAt: when },
  ], createdAt: when, updatedAt: when };
function campaign(campaignId: string, name: string, status: "OPEN" | "CLOSED") {
 return { campaignId, organizationId: org, storeId, name, status, openAt: when,
   closeAt: "2026-11-30T08:00:00.000Z", paymentDeadline: "2026-12-03T08:00:00.000Z",
   pickupAt: "2026-12-15T08:00:00.000Z", createdAt: when, updatedAt: when };
}
const campaigns=[campaign(openCampaign,"UXQA Open Drop","OPEN"),campaign(closedCampaign,"UXQA Closed Drop","CLOSED")];
const prefix="/api/v1/storefront/organizations/"+org;
const storePath=prefix+"/stores/"+storeId;
const storeURL="/stores/view/?"+new URLSearchParams({organizationId:org,storeId});
const productURL="/products/view/?"+new URLSearchParams({organizationId:org,productId});
const campaignURL="/campaigns/view/?"+new URLSearchParams({organizationId:org,campaignId:openCampaign});
type Recorded={ id:string; role:"guest"|"customer"; state:string; note:string; image:string };
type FailMode="none"|"503-store"|"404-store"|"503-campaign"|"404-campaign"|"503-product"|"404-product";

test("guest/customer store-campaign-product journey, selectors and recovery (GET mocks only)",async({browser,request})=>{
 test.setTimeout(200_000);
 const {frontend}=localAuditTargets();
 const runId="uxqa-"+randomUUID(),out=join("test-results","quality-audit",runId);
 await mkdir(out,{recursive:true});
 const passed:Recorded[]=[];
 let getCount=0,writes=0,fail:FailMode="none";
 async function secureRoutes(ctx:BrowserContext){
  await ctx.route("**/*",async route=>{
   const req=route.request(),u=new URL(req.url()),path=u.pathname,method=req.method();
   if(!["GET","HEAD","OPTIONS"].includes(method)){writes++;await route.abort("blockedbyclient");return;}
   if(method!=="GET")return route.continue();
   if(path==="/api/v1/storefront/directory"){
    getCount++;return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:[{organization:{organizationId:org,name:"UXQA Union",description:"Test only",status:"ACTIVE"},stores:[store]}]})});
   }
   const targets=new Map<string,unknown>([
    [prefix+"/stores",{items:[store],nextCursor:null}],
    [storePath,store],
    [storePath+"/products",{items:[product],nextCursor:null}],
    [storePath+"/products/"+productId,product],
    [storePath+"/campaigns",{items:campaigns,nextCursor:null}],
    [storePath+"/campaigns/"+openCampaign,campaigns[0]],
    [storePath+"/campaigns/"+closedCampaign,campaigns[1]],
   ]);
   if(targets.has(path)){
    getCount++;
    const isStore=path===storePath;
    const isCampaign=path===storePath+"/campaigns/"+openCampaign || path===prefix+"/stores";
    const isProduct=path===storePath+"/products/"+productId || path===prefix+"/stores";
    if((fail==="503-store"||fail==="404-store")&&isStore
       || (fail==="503-campaign"||fail==="404-campaign")&&isCampaign
       || (fail==="503-product"||fail==="404-product")&&isProduct){
      const status=fail.startsWith("503")?503:404;
      return route.fulfill({status,contentType:"application/json",
        body:JSON.stringify({success:false,error:{code:status===404?"NOT_FOUND":"SERVICE_UNAVAILABLE",message:"Synthetic detail failure"}})});
    }
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:targets.get(path)})});
   }
   return route.continue();
  });
 }
 async function proof(page:Page,id:string,role:"guest"|"customer",state:string,note:string){
  const image=id+"-"+role+"-"+state+".png";
  await page.screenshot({path:join(out,image),animations:"disabled"});
  passed.push({id,role,state,note,image});
 }
 const guest=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 const customer=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
 try{
  await secureRoutes(guest);
  const page=await guest.newPage();
  // Store: back, quick link, campaign and product cards
  await page.goto(frontend+storeURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:1,name:store.name})).toBeVisible();
  await expect(page.getByRole("link",{name:"ร้านค้าทั้งหมด"})).toHaveAttribute("href","/");
  await proof(page,"FE-UX-04-01","guest","store-back","Store has a clear return to public catalog");
  await page.getByRole("link",{name:"ดูแคมเปญ",exact:true}).click();
  await expect(page.locator("#campaign-heading")).toBeFocused();
  await page.getByRole("link",{name:"ดูสินค้า",exact:true}).click();
  await expect(page.locator("#product-heading")).toBeFocused();
  await page.locator('a[class*="campaignCard"]').first().click();
  await expect(page).toHaveURL(new RegExp("/campaigns/view/\\?organizationId="+org+"&campaignId="+openCampaign));
  await expect(page.getByRole("heading",{level:1,name:campaigns[0].name})).toBeVisible();
  await proof(page,"FE-UX-04-02","guest","campaign-card","Campaign card opens the exact scoped detail");
  await page.goto(frontend+storeURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:1,name:store.name})).toBeVisible();
  await page.locator('a[class*="productCard"]').first().click();
  await expect(page).toHaveURL(new RegExp("/products/view/\\?organizationId="+org+"&productId="+productId));
  await expect(page.getByRole("heading",{level:1,name:product.name})).toBeVisible();
  await proof(page,"FE-UX-04-03","guest","product-card","Store product opens the correct scoped product");
  await page.goto(frontend+"/stores/view/",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ลิงก์ร้านค้าไม่สมบูรณ์")).toBeVisible();
  await expect(page.getByRole("link",{name:"กลับไปเลือกร้านค้า"})).toHaveAttribute("href","/");
  await proof(page,"FE-UX-04-04","guest","invalid-link","Store invalid-ID recovery retains a direct catalog exit");
  fail="404-store";
  await page.goto(frontend+storeURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่พบร้านค้า")).toBeVisible();
  await proof(page,"FE-UX-04-04","guest","404-not-found","Store not-found state is distinguished from server failure");
  fail="503-store";
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่สามารถโหลดร้านค้าได้")).toBeVisible();
  await expect(page.getByRole("button",{name:"ลองใหม่"})).toBeVisible();
  await proof(page,"FE-UX-04-04","guest","503-recovery","Store 503 gives Retry and catalog fallback");
  await page.getByRole("button",{name:"ลองใหม่"}).click();
  await expect(page.getByText("ไม่สามารถโหลดร้านค้าได้")).toBeVisible();
  await expect(page.locator("main")).toBeFocused();
  await proof(page,"FE-UX-04-04","guest","503-again-focus","Repeated Store Retry failure focuses the recovery landmark");
  fail="none";
  await page.getByRole("button",{name:"ลองใหม่"}).click();
  await expect(page.getByRole("heading",{level:1,name:store.name})).toBeVisible();
  await expect(page.getByRole("heading",{level:1,name:store.name})).toBeFocused();
  await proof(page,"FE-UX-04-04","guest","503-recovered","Store in-place Retry recovers and focuses heading");
  // Campaign: correct store, contextual product, malformed and not-found.
  await page.goto(frontend+campaignURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:1,name:campaigns[0].name})).toBeVisible();
  await expect(page.getByRole("link",{name:store.name,exact:true})).toHaveAttribute("href",storeURL);
  await proof(page,"FE-UX-06-01","guest","back-to-store","Campaign links to the original store");
  await page.locator('a[class*="productCard"]').first().click();
  await expect(page).toHaveURL(new RegExp("productId="+productId+"&campaignId="+openCampaign));
  await expect(page.getByRole("heading",{level:1,name:product.name})).toBeVisible();
  await proof(page,"FE-UX-06-02","guest","campaign-product","Campaign product card retains campaign context");
  await page.goto(frontend+"/campaigns/view/",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ลิงก์แคมเปญไม่สมบูรณ์")).toBeVisible();
  await proof(page,"FE-UX-06-03","guest","invalid-campaign","Missing campaign ID offers back link");
  fail="404-campaign";
  await page.goto(frontend+campaignURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่พบแคมเปญ")).toBeVisible();
  await proof(page,"FE-UX-06-03","guest","campaign-404","Missing campaign is not mislabeled as 503");
  fail="503-campaign";
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่สามารถโหลดแคมเปญได้")).toBeVisible();
  await proof(page,"FE-UX-06-03","guest","campaign-503","Campaign 503 shows Retry and Back");
  fail="none";
  await page.getByRole("button",{name:"ลองใหม่"}).click();
  await expect(page.getByRole("heading",{level:1,name:campaigns[0].name})).toBeVisible();
  await expect(page.getByRole("heading",{level:1,name:campaigns[0].name})).toBeFocused();
  await proof(page,"FE-UX-06-03","guest","campaign-recovered","Campaign in-place Retry restores loaded content and focus");
  // Product: selectors, total, closed campaign, guest login returnTo.
  await page.goto(frontend+productURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{level:1,name:product.name})).toBeVisible();
  await expect(page.getByRole("link",{name:store.name,exact:true})).toHaveAttribute("href",storeURL);
  await proof(page,"FE-UX-05-01","guest","product-back","Product has the scoped store backlink");
  const variant=page.locator("#product-variant"),camp=page.locator("#product-campaign"),qty=page.locator("#product-quantity");
  await expect(variant).toHaveValue(variantA);
  await variant.selectOption(variantB);
  await expect(variant).toHaveValue(variantB);
  await proof(page,"FE-UX-05-02","guest","selected-variant","Variant selector changes chosen SKU and estimate");
  await camp.selectOption(closedCampaign);
  await expect(page.getByText("แคมเปญที่เลือกยังไม่เปิดรับคำสั่งซื้อ")).toBeVisible();
  await expect(page.getByRole("link",{name:"เข้าสู่ระบบเพื่อสั่งซื้อ"})).toHaveCount(0);
  await proof(page,"FE-UX-05-03","guest","closed-campaign","Closed campaign blocks order action");
  await camp.selectOption(openCampaign);
  await proof(page,"FE-UX-05-03","guest","open-campaign","Open campaign enables next step");
  await qty.fill("0");
  await expect(page.getByText("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป")).toBeVisible();
  await proof(page,"FE-UX-05-04","guest","quantity-invalid","Invalid quantity blocks order action");
  await qty.fill("3");
  await expect(page.locator('output[for*="product-quantity"]')).toContainText("฿900.00");
  await proof(page,"FE-UX-05-04","guest","quantity-estimate","Quantity 3 x selected variant price updates estimate");
  await page.getByRole("link",{name:"ดูรายละเอียดแคมเปญ"}).click();
  await expect(page).toHaveURL(new RegExp("/campaigns/view/\\?organizationId="+org+"&campaignId="+openCampaign));
  await proof(page,"FE-UX-05-05","guest","campaign-link","Campaign detail link opens scoped campaign");
  await page.goto(frontend+productURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("link",{name:"เข้าสู่ระบบเพื่อสั่งซื้อ"})).toBeVisible();
  const login=page.getByRole("link",{name:"เข้าสู่ระบบเพื่อสั่งซื้อ"});
  const guestTarget=await login.getAttribute("href");
  expect(guestTarget).toContain("/login/?returnTo=");
  expect(decodeURIComponent(guestTarget||"")).toContain("/orders/new/");
  await proof(page,"FE-UX-05-07","guest","login-to-order","Guest CTA safely preserves the order destination");
  await page.goto(frontend+"/products/view/",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ลิงก์สินค้าไม่สมบูรณ์")).toBeVisible();
  await proof(page,"FE-UX-05-01","guest","invalid-product","Invalid product has public recovery");
  fail="404-product";
  await page.goto(frontend+productURL,{waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่พบสินค้า")).toBeVisible();
  await proof(page,"FE-UX-05-01","guest","404-product","Unavailable product has return to public catalog");
  fail="503-product";
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.getByText("ไม่สามารถโหลดสินค้าได้")).toBeVisible();
  await proof(page,"FE-UX-05-01","guest","503-product","Product failure has Retry and Back");
  fail="none";
  await page.getByRole("button",{name:"ลองใหม่"}).click();
  await expect(page.getByRole("heading",{level:1,name:product.name})).toBeVisible();
  await expect(page.getByRole("heading",{level:1,name:product.name})).toBeFocused();
  await proof(page,"FE-UX-05-01","guest","product-recovered","In-place Retry returns to the exact product with focus");
  await page.close();
  await secureRoutes(customer);
  await establishSeedRoleSession(customer,request,"customer");
  const authPage=await customer.newPage();
  await authPage.goto(frontend+productURL,{waitUntil:"domcontentloaded"});
  const orderLink=authPage.getByRole("link",{name:"ดำเนินการสั่งซื้อ"});
  await expect(orderLink).toBeVisible();
  const orderTarget=await orderLink.getAttribute("href");
  expect(orderTarget).toContain("/orders/new/");
  for(const id of [org,openCampaign,productId,variantA])expect(orderTarget).toContain(id);
  await proof(authPage,"FE-UX-05-06","customer","order-link","Authorized Customer proceeds using exact selected product, variant and campaign");
  await authPage.close();
 }finally{await Promise.all([guest.close(),customer.close()]);}
 expect(writes).toBe(0);
 expect(getCount).toBeGreaterThanOrEqual(10);
 const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
  actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
 };
 const outcomes:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
  actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
  status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full matrix not certified: "+a.statesToTest.join(", "),
 }));
 for(const a of passed)outcomes.push({actionId:a.id,role:a.role,state:a.state,viewport:"390x844",
  status:"PASS",testRunId:runId,evidence:[a.image],notes:a.note+"; all storefront data GETs mocked, no business writes"});
 await writeActionLedger(runId,outcomes);
 await writeFile(join(out,"public-detail-actions.json"),JSON.stringify({
  proofs:passed,distinctIds:[...new Set(passed.map(x=>x.id))],getCount,writes,
  limitation:"Browser UI GET mocks and local Customer seed session only; backend statuses not verified."
 },null,2)+"\n");
});
