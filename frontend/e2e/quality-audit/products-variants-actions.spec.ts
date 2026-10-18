import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { establishSeedRoleSession, LOCAL_SEED_ENTITY_IDS as ids } from "../support/seed-auth";
import { localAuditTargets } from "./fixture-guard";
import { writeActionLedger, type ActionOutcome } from "./result-ledger";

const root="/api/v1/organizations/"+ids.organizationId;
const productsPath=root+"/products",storesPath=root+"/stores",stamp="2026-10-17T12:00:00.000Z";
const storeA={storeId:"uxqa-store-a",organizationId:ids.organizationId,name:"UXQA Shop Active",description:"Synthetic",status:"ACTIVE",createdAt:stamp,updatedAt:stamp};
const storeB={...storeA,storeId:"uxqa-store-b",name:"UXQA Empty Store"};
const variant={variantId:"uxqa-variant-a",organizationId:ids.organizationId,productId:"uxqa-product-a",name:"Size M",price:35000,status:"ACTIVE",createdAt:stamp,updatedAt:stamp};
const item={productId:"uxqa-product-a",organizationId:ids.organizationId,storeId:storeA.storeId,name:"UXQA Campus Shirt",description:"Test only",imageKey:null,imageUrl:null,status:"ACTIVE",variants:[variant],createdAt:stamp,updatedAt:stamp};
const item2={...item,productId:"uxqa-product-b",name:"UXQA Campus Mug",status:"INACTIVE",variants:[]};
type Proof={id:string;state:string;note:string;image:string};

test("product and variant safe interactions are directly evidenced",async({browser,request})=>{
  test.setTimeout(190000);
  const {frontend}=localAuditTargets(),runId="uxqa-"+randomUUID(),dir=join("test-results","quality-audit",runId);
  await mkdir(dir,{recursive:true});
  const evidence:Proof[]=[];const seen:string[]=[];
  let writes=0,details=0,failFilter=false,failures=0;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await establishSeedRoleSession(context,request,"organizationAdmin");
  await context.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==="GET"&&url.pathname===storesPath){
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{items:[storeA,storeB],nextCursor:null}})});return;
    }
    if(req.method()==="GET"&&url.pathname===productsPath){
      seen.push(url.search);
      if(failFilter&&url.searchParams.has("storeId")){
        failFilter=false;failures++;
        await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({success:false,error:{code:"SERVICE_UNAVAILABLE",message:"Test-only GET failure"}})});return;
      }
      const store=url.searchParams.get("storeId"),cursor=url.searchParams.get("cursor");
      const items=store===storeB.storeId?[]:cursor?[item2]:[item];
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:{items,nextCursor:store||cursor?null:"uxqa-next"}})});return;
    }
    if(req.method()==="GET"&&url.pathname===productsPath+"/"+item.productId){
      details++;await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data:item})});return;
    }
    if(!["GET","HEAD","OPTIONS"].includes(req.method())){writes++;await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  async function proof(page:Page,id:string,state:string,note:string){
    const image=id+"-"+state+".png";await page.screenshot({path:join(dir,image),animations:"disabled"});
    evidence.push({id,state,note,image});
  }
  try {
    const page=await context.newPage();
    await page.goto(frontend+"/org/products/?organizationId="+ids.organizationId,{waitUntil:"domcontentloaded"});
    const row=page.getByRole("article").filter({has:page.getByRole("heading",{name:item.name})});
    await expect(row).toBeVisible({timeout:18000});
    await page.getByRole("button",{name:"โหลดเพิ่มเติม",exact:true}).click();
    await expect(page.getByRole("heading",{name:item2.name})).toBeVisible();
    expect(seen.some(x=>new URLSearchParams(x).get("cursor")==="uxqa-next")).toBe(true);
    await proof(page,"FE-UX-18-05","cursor-next","Opaque GET cursor loads next item");
    const search=page.locator("#products-directory-search");
    await search.fill("never-found-uxqa");
    await expect(page.getByText("ไม่พบรายการที่ตรงคำค้นหา ลองเปลี่ยนคำหรือกดล้าง")).toBeVisible();
    await proof(page,"FE-UX-18-01","search-no-match","Local loaded-only search exposes no-match");
    await page.getByRole("button",{name:"ล้างคำค้นหา"}).click();

    const filter=page.locator("#product-store-filter");failFilter=true;
    await filter.selectOption(storeB.storeId);
    await expect(page.getByRole("alert").filter({hasText:"ดำเนินการไม่สำเร็จ"})).toBeVisible();
    await expect(row).toBeVisible();
    await proof(page,"FE-UX-18-01","503-preserved-rows","Failed scoped GET retains prior rows and surfaces alert");
    await filter.selectOption(storeA.storeId);
    await expect(row).toBeVisible();
    await proof(page,"FE-UX-18-01","scoped-get","Changed Store filter requests scoped product list");
    await filter.selectOption(storeB.storeId);
    await expect(page.getByText("ไม่พบสินค้า",{exact:true})).toBeVisible();
    await proof(page,"FE-UX-18-01","empty-store","Selected store with no products renders empty state");
    await page.getByRole("button",{name:"แสดงทุกร้านค้า"}).click();
    await expect(filter).toHaveValue("");await expect(row).toBeVisible();
    await proof(page,"FE-UX-18-02","clear-filter","Clear restores unfiltered GET result");

    const deactivate=row.getByRole("button",{name:"ปิดใช้งาน"});await deactivate.click();
    let dialog=page.getByRole("dialog",{name:"ยืนยันการปิดใช้งานสินค้า"});
    await expect(dialog).toContainText(item.name);
    await proof(page,"FE-UX-18-04","dialog-open","Product deactivation dialog identifies affected product");
    await dialog.getByRole("button",{name:"ยกเลิก"}).click();
    await expect(dialog).not.toBeVisible();await expect(deactivate).toBeFocused();
    await proof(page,"FE-UX-18-04","dialog-cancel","Cancel restores focus and sends no DELETE");

    await page.locator("#product-create-store").selectOption(storeB.storeId);
    await proof(page,"FE-UX-18-06","create-store-draft","Store select draft changes without network writes");
    await page.locator("#product-create-name").fill("Test-only New Product");
    await proof(page,"FE-UX-18-07","create-name-draft","Product name draft");
    await page.locator("#product-create-description").fill("Synthetic description");
    await proof(page,"FE-UX-18-08","create-description-draft","Product description draft");
    await page.locator("#product-create-name").fill("");
    await page.getByRole("button",{name:"สร้างสินค้า",exact:true}).click();
    const createSummary=page.locator("#product-create-error-summary");
    await expect(createSummary.getByRole("link",{name:"กรุณาระบุชื่อสินค้า"})).toBeVisible();
    await expect(createSummary).toBeFocused();
    await proof(page,"FE-UX-18-09","create-invalid-submit","First invalid create Submit focuses summary and never sends POST");

    await row.getByRole("button",{name:"แก้ไขข้อมูล"}).click();
    await expect(page.getByRole("heading",{name:"จัดการ "+item.name})).toBeVisible();
    await expect(page.locator("#product-edit-name")).toHaveValue(item.name);
    await proof(page,"FE-UX-18-03","edit-open","Fresh synthetic GET opens product editor");
    await page.locator("#product-edit-name").fill("Updated draft");
    await proof(page,"FE-UX-18-11","edit-name-draft","Editor name changed locally");
    await page.locator("#product-edit-description").fill("Updated synthetic description");
    await proof(page,"FE-UX-18-12","edit-description-draft","Editor description changed locally");
    await page.locator("#product-edit-name").fill("");
    await page.getByRole("button",{name:"บันทึกข้อมูล",exact:true}).click();
    const editSummary=page.locator("#product-edit-error-summary");
    await expect(editSummary.getByRole("link",{name:"กรุณาระบุชื่อสินค้า"})).toBeVisible();
    await expect(editSummary).toBeFocused();
    await proof(page,"FE-UX-18-13","edit-invalid-submit","Invalid edit Submit focuses summary and never PATCHes product");

    const variantRow=page.getByRole("article").filter({has:page.getByText("Size M",{exact:true})});
    await expect(variantRow).toBeVisible();
    const variantDeactivate=variantRow.getByRole("button",{name:"ปิดใช้งาน"});
    await variantDeactivate.click();
    dialog=page.getByRole("dialog",{name:"ยืนยันการปิดใช้งานตัวเลือก"});
    await expect(dialog).toContainText("Size M");
    await proof(page,"FE-UX-18-17","variant-dialog-open","Variant status dialog identifies exact variant");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();await expect(variantDeactivate).toBeFocused();
    await proof(page,"FE-UX-18-17","variant-dialog-escape","Escape restores focus without DELETE");

    await variantRow.getByRole("button",{name:"แก้ไขตัวเลือก"}).click();
    const vName=page.locator("#variant-edit-name-"+variant.variantId),vPrice=page.locator("#variant-edit-price-"+variant.variantId);
    await expect(vName).toHaveValue("Size M");
    await proof(page,"FE-UX-18-16","variant-edit-open","Variant editor exposes saved name and THB price");
    await vName.fill("UXQA edited size");
    await proof(page,"FE-UX-18-18","variant-name-draft","Variant name draft");
    await vPrice.fill("12.345");
    await proof(page,"FE-UX-18-19","variant-price-draft","Variant price draft");
    await variantRow.getByRole("button",{name:"บันทึกตัวเลือก"}).click();
    const vSummary=page.locator("#variant-edit-error-summary-"+variant.variantId);
    await expect(vSummary.getByRole("link",{name:/ทศนิยม/})).toBeVisible();
    await expect(vSummary).toBeFocused();
    await proof(page,"FE-UX-18-20","invalid-variant-price","Invalid 3-decimal price blocks PATCH and focuses summary");
    await variantRow.getByRole("button",{name:"ยกเลิก"}).click();
    await expect(vName).toHaveCount(0);
    await proof(page,"FE-UX-18-21","variant-cancel","Edit cancel leaves variant unchanged");
    const newName=page.locator("#variant-create-name-"+item.productId),newPrice=page.locator("#variant-create-price-"+item.productId);
    await newName.fill("UXQA new variant");
    await proof(page,"FE-UX-18-22","new-variant-name","New variant name draft");
    await newPrice.fill("19.999");
    await proof(page,"FE-UX-18-23","new-variant-price","New variant price draft");
    await page.getByRole("button",{name:"เพิ่มตัวเลือก",exact:true}).click();
    const newSummary=page.locator("#variant-create-error-summary-"+item.productId);
    await expect(newSummary.getByRole("link",{name:/ทศนิยม/})).toBeVisible();
    await expect(newSummary).toBeFocused();
    await proof(page,"FE-UX-18-24","new-variant-invalid-submit","Price validation prevents POST");

    await page.getByRole("button",{name:"ปิดส่วนแก้ไข"}).click();
    await expect(page.locator("#product-edit-name")).toHaveCount(0);
    await proof(page,"FE-UX-18-10","close-editor","Editor closes without changing records");
    await page.close();
  }finally {await context.close();}
  expect(writes).toBe(0);expect(failures).toBe(1);
  const baseline=JSON.parse(await readFile("quality-audit/coverage-baseline.json","utf8")) as {
    actions:Array<{id:string;roles:string[];statesToTest:string[]}>;
    shellActions:Array<{id:string;roles:string[];statesToTest:string[]}>;
  };
  const entries:ActionOutcome[]=[...baseline.actions,...baseline.shellActions].map(a=>({
    actionId:a.id,role:a.roles[0]!,state:"all-declared-states",viewport:"not-executed",
    status:"NOT_TESTED",testRunId:runId,evidence:[],notes:"Full multi-state certification not executed: "+a.statesToTest.join(", "),
  }));
  for(const e of evidence)entries.push({actionId:e.id,role:"organizationAdmin",state:e.state,viewport:"390x844",
    status:"PASS",testRunId:runId,evidence:[e.image],notes:e.note+"; GET-only synthetic fixture, zero write requests"});
  await writeActionLedger(runId,entries);
  await writeFile(join(dir,"product-variant-actions.json"),JSON.stringify({
    states:evidence,distinctIds:[...new Set(evidence.map(x=>x.id))],writes,details,failures,queries:seen,
    limitation:"No product/variant/image persistence and no real backend mutation tested.",
  },null,2)+"\n");
});
