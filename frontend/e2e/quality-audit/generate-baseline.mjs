#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
// Execute from frontend/. This code has no network or database access.
const raw=readFileSync("interaction-coverage-matrix.md","utf8");
const table=raw.split("## Canonical route matrix")[1]?.split("Total source-defined")[0];
if(!table)throw Error("Missing canonical route matrix");
const rows=table.split("\n").filter(s=>/^\|\s*\d+\s*\|/.test(s));
if(rows.length!==28)throw Error("Expected 28 routes");
const expansion={
18:{
"create Store select/name/description/submit":["create Store select","create Product name","create Product description","create Product submit"],
"edit name/description/save":["edit Product name","edit Product description","save Product"],
"image file/upload":["image file","image upload"],
"Variant edit name/price/save/cancel":["Variant edit name","Variant edit price","Variant save","Variant cancel"],
"new Variant name/price/add":["new Variant name","new Variant price","add Variant"]
},
19:{
"create Store/Name/Open/Close/Payment deadline/Pickup dates/submit":["create Campaign Store","create Campaign Name","create Campaign Open date","create Campaign Close date","create Campaign Payment deadline","create Campaign Pickup dates","create Campaign submit"],
"draft edit Store/Name/4 dates/save":["draft edit Store","draft edit Name","draft edit Open date","draft edit Close date","draft edit Payment deadline","draft edit Pickup dates","save draft Campaign"],
"lifecycle confirm actions across supported statuses":["confirm DRAFT to OPEN","confirm OPEN to CLOSED","confirm CLOSED to PRODUCING","confirm PRODUCING to READY_FOR_PICKUP","confirm READY_FOR_PICKUP to COMPLETED","confirm cancel when eligible"]
},
22:{"Payment Status/Campaign ID/Order ID filters":["Payment Status filter","Campaign ID filter","Order ID filter"],"apply/clear":["apply filters","clear filters"]},
24:{"Pickup token/Order ID/Campaign ID/Status filters":["Pickup token filter","Order ID filter","Campaign ID filter","Pickup Status filter"],"apply/clear":["apply filters","clear filters"]},
25:{"Actor ID/Action/Resource Type/Resource ID filters":["Actor ID filter","Action filter","Resource Type filter","Resource ID filter"]}
};
const rolesFor=(s)=>[...new Set([
/Anonymous/i.test(s)?"guest":null,
/Customer|authenticated alternate/i.test(s)?"customer":null,
/Staff/i.test(s)?"staff":null,
/Organization Admin/i.test(s)?"organizationAdmin":null,
/Platform Admin/i.test(s)?"platformAdmin":null].filter(Boolean))];
const risk=(a)=>/create|submit|save|approve|reject|cancel|remove|deactivate|activate|upload|confirm|mark.read|role.change|switch Organization/i.test(a)?"mutation-or-conditional-review":"read-only-or-local-ui";
const states=(a)=>[...new Set(["loaded",
...(/retry|error|invalid|back/i.test(a)?["error"]:[]),
...(/modal|confirm|cancel|approve|reject|remove|deactivate|role.change/i.test(a)?["dialog-open","dialog-cancel","dialog-pending","dialog-server-error"]:[]),
...(/submit|save|upload|create|add|reason|email|password|quantity|name|date|price/i.test(a)?["validation-error","pending","success","server-error"]:[]),
...(/filter|load more|search/i.test(a)?["empty","no-match","server-error"]:[])])];
const routes=[],actions=[];
for(const line of rows){
 const [ix,path,ro,ac,co]=line.split("|").slice(1,-1).map(x=>x.trim());
 const index=Number(ix),count=Number(co),route=path.replaceAll(String.fromCharCode(96),""),roles=rolesFor(ro);
 if(!index||!route.startsWith("/")||!Number.isInteger(count)||!roles.length)throw Error("Malformed route "+ix);
 routes.push({index,route,roles,declaredActionCount:count});
 const groups=count?ac.split(";").map(x=>x.trim()).filter(Boolean):[];
 const items=groups.flatMap(x=>expansion[index]?.[x]??[x]);
 if(items.length!==count)throw Error("Action count mismatch "+route+" "+items.length+" != "+count);
 items.forEach((action,i)=>actions.push({id:"FE-UX-"+String(index).padStart(2,"0")+"-"+String(i+1).padStart(2,"0"),routeIndex:index,route,roles,action,risk:risk(action),statesToTest:states(action),status:"NOT_TESTED",testRunId:null,evidence:[],notes:"Inventory only, not a current PASS"}));
}
if(actions.length!==207)throw Error("Expected 207 actions");
const shell={
guest:["brand","stores","login","register"],
customer:["brand","storefront","my orders","notifications","skip link","logout","mobile menu open","mobile close","mobile Escape/focus return"],
staff:["brand","skip link","orders","payments","pickups","organization switch","logout","mobile menu open","mobile close","mobile Escape/focus return"],
organizationAdmin:["brand","skip link","dashboard","settings","staff","stores","products","campaigns","orders","payments","pickups","production","audit","organization switch","logout","mobile menu open","mobile close","mobile Escape/focus return"],
platformAdmin:["brand","skip link","platform summary","organizations","users","logout","mobile menu open","mobile close","mobile Escape/focus return"]
};
const shellActions=Object.entries(shell).flatMap(([role,names])=>names.map((action,i)=>({id:"FE-UX-SHELL-"+role.toUpperCase()+"-"+String(i+1).padStart(2,"0"),routeIndex:null,route:"shared-shell",roles:[role],action,risk:risk(action),statesToTest:["loaded","keyboard","mobile"],status:"NOT_TESTED",testRunId:null,evidence:[],notes:"Shell inventory, outside 207 route actions"})));
const baseline={schemaVersion:1,source:"frontend/interaction-coverage-matrix.md",sourceSha256:createHash("sha256").update(raw).digest("hex"),policy:"No status becomes PASS without specific current test evidence",statuses:["NOT_TESTED","PASS","FAIL","BLOCKED"],routeCount:routes.length,routeActionCount:actions.length,shellActionCount:shellActions.length,routes,actions,shellActions};
const dest="quality-audit/coverage-baseline.json",json=JSON.stringify(baseline,null,2)+"\n";
if(process.argv.includes("--verify")){if(readFileSync(dest,"utf8")!==json)throw Error("Stale baseline. Regenerate and review diff");}
else writeFileSync(dest,json);
console.log((process.argv.includes("--verify")?"Verified ":"Generated ")+routes.length+" routes / "+actions.length+" actions / "+shellActions.length+" shell");
