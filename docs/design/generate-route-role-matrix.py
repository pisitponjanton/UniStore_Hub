"""Generate honest redesign coverage inventory from canonical frontend action list."""
from pathlib import Path
import json

src=json.loads(Path("frontend/quality-audit/coverage-baseline.json").read_text())
assert (src["routeCount"],src["routeActionCount"],src["shellActionCount"]) == (28,207,50)
purposes=[
"ค้นหาร้านและสินค้าที่เปิดขาย","เข้าสู่ระบบ","สมัครบัญชี","ดูสินค้าในร้าน","เลือกสินค้าและตัวเลือก",
"ดูรอบขายพรีออเดอร์","ตรวจและยืนยันคำสั่งซื้อ","ดูสถานะรายการของฉัน","เปิดรายละเอียดคำสั่งซื้อ",
"ส่งหลักฐานชำระเงิน","ดูข้อมูลรับสินค้า","เปิดรายการจากการแจ้งเตือน",
"เลือกหน่วยงาน","เปิดงานที่รอดำเนินการ","แก้ไขข้อมูลหน่วยงาน","จัดการทีมงาน",
"จัดการร้านค้า","จัดการสินค้า/ตัวเลือก/รูปภาพ","จัดการรอบพรีออเดอร์",
"เปิดงานในคิวคำสั่งซื้อ","ดูและดำเนินการตามสิทธิ์","ตรวจการชำระเงิน",
"ตรวจยอดผลิต","ยืนยันการรับสินค้า","ค้นประวัติการทำรายการ",
"ดูภาพรวมแพลตฟอร์ม","ตรวจหน่วยงานที่รออนุมัติ","ค้นผู้ใช้"
]
roles=["guest","customer","staff","organizationAdmin","platformAdmin"]
states=["loading","loaded","empty","error","unauthorized","forbidden","validation","conflict","pending","success","retry","modal-and-focus","keyboard","reduced-motion"]
routes=[]
for i,route in enumerate(src["routes"]):
 actions=[a for a in src["actions"] if a["route"]==route["route"]]
 assert len(actions)==route["declaredActionCount"]
 routes.append({
 "route":route["route"],"sourceRoles":route["roles"],"sourceActionCount":len(actions),
 "actionIds":[a["id"] for a in actions],"primaryTask":purposes[i],"redesignStatus":"NOT_STARTED",
 "roleEvidence":{r:"NOT_TESTED" for r in roles},
 "viewportEvidence":{str(w):"NOT_TESTED" for w in [320,390,768,1024,1440]},
 "stateEvidence":{s:"NOT_TESTED" for s in states},
 "actionEvidence":{a["id"]:"NOT_TESTED" for a in actions}
 })
assert len(routes)==28 and sum(r["sourceActionCount"] for r in routes)==207
data={
 "schemaVersion":1,"baselineCommit":"9007ec3","source":"frontend/quality-audit/coverage-baseline.json",
 "sourceSha256":src["sourceSha256"],"routeCount":28,"routeActions":207,"shellActions":50,
 "newRedesignStatus":"NOT_STARTED",
 "browserObserved":["/ desktop 1440x900 loading","/ mobile 390x844 loading","/login/ account loading"],
 "notYetObserved":["Populated homepage","Role-protected views","All new modal and responsive states"],
 "notes":"Every NEW redesign state must be verified after implementing it. Source roles are not proof of all allowed/denied contexts; verify alternate roles without changing RBAC.",
 "routes":routes,"shellActionIds":[a["id"] for a in src["shellActions"]]
}
Path("docs/design/ROUTE_ROLE_STATE_MATRIX.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
lines=[
 "# UniStore Hub — Route, Role and State Inventory","",
 "Source aligned to frontend/quality-audit/coverage-baseline.json (28 routes, 207 route action families, 50 shared-shell actions).",
 "Every combination begins NOT_TESTED for the new redesign. Historical test results do not certify unseen new UI.","",
 "| Route | Source roles | Action families | Primary task |","| --- | --- | ---: | --- |"
]
for row in routes:
 lines.append("| "+row["route"]+" | "+", ".join(row["sourceRoles"])+" | "+str(row["sourceActionCount"])+" | "+row["primaryTask"]+" |")
lines+=["","## Scope",
 "Review all 5 user types (Guest, Customer, Staff, Organization Admin, Platform Admin), including authorized buyer flow for other authenticated roles and forbidden access to restricted routes.",
 "Test Loading, Loaded, Empty, Error, Unauthorized, Forbidden, Validation, Conflict, Pending, Success, Retry, Dialog, Keyboard focus and reduced motion at 320/390/768/1024/1440 widths.",
 "Platform Summary and Platform Users have zero inventory Action IDs but still require substantive visual and interaction review.","",
 "## Evidence limitations",
 "Discovery visually observed only public homepage desktop/mobile and login loading; protected role screens and populated data remain NOT_TESTED. Keep the JSON manifest honest as each phase is implemented.",
 "Never elevate actions to PASS through source inspection or screenshots alone; mutation states must be verified safely with intercepted requests or owned disposable fixtures."
]
Path("docs/design/ROUTE_ROLE_STATE_MATRIX.md").write_text("\n".join(lines)+"\n")
print("Created 28-route manifest with 207 route Action IDs and 50 shell IDs")
