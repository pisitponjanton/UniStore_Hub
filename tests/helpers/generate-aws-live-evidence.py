#!/usr/bin/env python3
"""Generate report-ready browser evidence from verified, read-only Chromium results."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import os

qa_workspace=Path(os.environ.get("UNISTORE_QA_WORKSPACE","../../test/test-0.4.0")).resolve()
assert qa_workspace.name=="test-0.4.0" and qa_workspace.is_dir(), "Separate test-0.4.0 workspace required"
root=qa_workspace/"evidence/report/aws-live-browser"
roles=("public","buyer","owner")
collections={role:json.loads((root/("results-"+role+".json")).read_text()) for role in roles}
pages=[p for v in collections.values() for p in v["pages"]]
checks=[x for v in collections.values() for x in v["authorizations"]]
assert len(pages)==21 and len(checks)==3
assert all(p["status"]=="PASS" and not p["horizontalOverflow"] and not p["errors"] for p in pages)
assert all(p["status"]=="PASS" for p in checks)
assert all((root/p["evidence"]).exists() for p in pages)
report=Path("tests/reports/aws-live-browser-verification.md")
lines=[]
def a(value=""):lines.append(value)
a("# UniStore Hub — ผลทดสอบเว็บไซต์จริงหลัง Redeploy บน AWS")
a()
a("**วันที่ตรวจ:** 28 ตุลาคม 2569 (Asia/Bangkok)")
a("**Source Commit:** c02ff57")
a("**Environment:** AWS Academy Learner Lab, us-east-1, CloudFormation: unistore-hub-dev")
a("**Scope:** Read-only Browser Smoke และการตรวจสิทธิ์ API โดยใช้ข้อมูล QA เดิม (ไม่สร้างคำสั่งซื้อใหม่)")
a()
a("## 1. วัตถุประสงค์และวิธีการทดสอบ")
a()
a("ทดสอบส่วนติดต่อผู้ใช้ UniStore Hub ที่ Deploy จริงด้วย Google Chrome/Chromium แบ่งเป็น Public, Customer และ Organization Admin โดยเข้าผ่าน Amazon S3 Static Website (HTTP) และตรวจการเชื่อมต่อ Backend ผ่าน API Gateway (HTTPS) → Lambda → DynamoDB")
a()
a("เกณฑ์ Browser PASS คือหน้า HTTP 200, แสดงข้อความหลักตามที่กำหนด, ไม่พบ JavaScript Page Error, ไม่ปรากฏหน้า Not Found/Permission Denied โดยไม่คาดหมาย และไม่มี Horizontal Overflow บนขนาดหน้าจอที่ทดสอบ")
a()
a("## 2. สรุปผล")
a()
a("| บทบาท/กรณี | ทดสอบ | ผ่าน | ไม่ผ่าน |")
a("|---|---:|---:|---:|")
for role,title in (("public","Public"),("buyer","Customer"),("owner","Organization Admin")):
 items=collections[role]["pages"]
 a(f"| {title} | {len(items)} | {sum(x['status']=='PASS' for x in items)} | 0 |")
a("| **Browser รวม** | **21** | **21** | **0** |")
a("| การตรวจสิทธิ์ API (Negative) | 3 | 3 | 0 |")
a()
a("**ตรวจ Responsive:** 4 กรณีบนหน้าจอ 390×844 ไม่มี Horizontal Overflow ที่ตรวจพบ; ที่เหลือตรวจบน 1440×900")
a()
a("## 3. ตารางผลทดสอบหน้าเว็บจริง")
a()
a("| No. | Role | Route | Screen | HTTP | Result | Screenshot |")
a("|---:|---|---|---|---:|---|---|")
for n,p in enumerate(pages,1):
 route=p["url"].split("?")[0]
 a(f"| {n} | {p['role']} | {route} | {p['viewport']} | {p['http']} | {p['status']} | {p['evidence']} |")
a()
a("## 4. ผลตรวจสิทธิ์ API")
a()
a("| User | API GET Path | Actual HTTP | Error Code | Result |")
a("|---|---|---:|---|---|")
for c in checks:
 a(f"| {c['role']} | {c['route']} | {c['actualHttp']} | {c['errorCode']} | {c['status']} |")
a()
a("บัญชี Customer และ Organization Admin ไม่สามารถเข้าถึง API ของ Platform Admin ได้ (HTTP 403) และ Customer ไม่สามารถอ่าน Orders ระดับ Organization ได้ (HTTP 403). เป็นการตรวจ GET เท่านั้น")
a()
a("## 5. ข้อความสรุปพร้อมใช้ในบทที่ 4")
a()
a("การทดสอบระบบ UniStore Hub หลัง Redeploy บน AWS Academy Learner Lab ดำเนินการด้วยเว็บเบราว์เซอร์ Chromium โดยใช้บัญชีทดสอบจำลอง และตรวจส่วนติดต่อผู้ใช้งานตามสิทธิ์ของ Public, Customer และ Organization Admin รวม 21 กรณี ครอบคลุมการแสดงผลหน้าแรก ร้านค้า สินค้า คำสั่งซื้อ การแจ้งเตือน Dashboard การชำระเงิน สรุปการผลิต และ Audit Logs ผลการตรวจตามเกณฑ์ที่กำหนดผ่านครบ 21 กรณี และการป้องกันการเรียก API โดยบัญชีที่ไม่มีสิทธิ์ผ่าน 3 กรณี โดยไม่ตรวจพบ JavaScript Error หรือ Horizontal Overflow ในหน้าที่ทดสอบ ทั้งนี้ผลดังกล่าวยืนยันเฉพาะการแสดงผลและสิทธิ์อ่านข้อมูล ไม่ได้เป็นการทดสอบธุรกรรมใหม่หรือรับรองความปลอดภัยระดับ Production")
a()
a("## 6. รูปประกอบที่แนะนำสำหรับรายงาน")
a()
a("จัดภาพจากชุดหลักฐานไว้ตามหัวข้อดังต่อไปนี้ โดยใช้คำบรรยายแล้วปรับเลขรูปตามรูปเล่มฉบับจริง:")
captions=[
 ("public","/","หน้าแรกของระบบ UniStore Hub"),
 ("public","/stores/view/","หน้าร้านสาธิตบน Storefront"),
 ("buyer","/my/orders/","Customer ตรวจสอบรายการคำสั่งซื้อ"),
 ("buyer","/my/order/","Customer ติดตามสถานะรับสินค้า"),
 ("buyer","/notifications/","Customer ดู Notification ที่ Worker บันทึก"),
 ("buyer","/products/view/","รายละเอียดสินค้าและตัวเลือก"),
 ("owner","/org/dashboard/","Dashboard ของ Organization Admin"),
 ("owner","/org/stores/","หน้าจัดการร้านค้าของหน่วยงาน"),
 ("owner","/org/orders/","รายการคำสั่งซื้อของหน่วยงาน"),
 ("owner","/org/payments/","หน้าตรวจสอบการชำระเงิน"),
 ("owner","/org/production/","สรุปงานผลิต"),
 ("owner","/org/audit/","ประวัติการทำรายการ"),
 ("owner","/org/stores/campaign/","หน้ารายละเอียดแคมเปญ QA")
]
for number,(role,route,title) in enumerate(captions,1):
 item=next(p for p in pages if p["role"]==role and p["url"].split("?")[0]==route and p["viewport"]=="1440x900")
 a(f"- ภาพประกอบ {number:02d}: {title} — {item['evidence']}")
a()
a("ภาพบนมือถือ: public-mobile--shops-.png และภาพที่ขึ้นต้นด้วย buyer-mobile / owner-mobile ใน ZIP หลักฐาน")
a()
a("## 7. ผลการทดสอบก่อนหน้าที่ใช้ประกอบ แต่ไม่นับซ้ำใน Browser 21 กรณี")
a()
a("- ทดสอบธุรกิจบน AWS ด้วยข้อมูล QA: สมัครสมาชิก, สร้างองค์กร/ร้าน, สินค้าและ Variant, Pre-order, Order, เอกสารชำระเงินจำลอง TEST ONLY, Payment Approval, Production, Ready for Pickup, QR และยืนยันรับสินค้าจำลอง สำเร็จแล้วก่อนรอบนี้ ไม่ได้มีการชำระเงินจริง")
a("- Notifications: หลังซ่อม Lambda SQS Event Source Mapping จาก Disabled เป็น Enabled หน้า Customer แสดง Payment Approved และ Ready for Pickup จริง")
a("- AWS Smoke หลัง Redeploy ก่อนหน้านี้ผ่าน 13/13 บน Commit c02ff57; การเรียกรันซ้ำล่าสุดถูก CloudShell Disconnect จึงไม่อ้างเป็นผลรันใหม่")
a()
a("## 8. ข้อจำกัดและงานต่อไป")
a()
a("- ยังไม่ได้ลงชื่อเข้าใช้ Platform Admin ที่มีสิทธิ์จริง และไม่ได้ทดสอบ Staff Role แยกในรอบนี้")
a("- ยังไม่ได้ทำธุรกรรม Order/Payment/Pickup ซ้ำหลัง Redeploy; ผลเดิมเป็นอีกช่วงเวลาหนึ่ง")
a("- ยังไม่มี Load/Stress Test, Penetration Test, Backup/Restore Test หรือสรุปต้นทุนเฉพาะโครงการแบบแยกบริการ")
a("- Frontend แบบ S3 Static Website ใช้ HTTP เฉพาะสภาพแวดล้อม Learner Lab ไม่ควรสรุปว่าเป็น HTTPS Frontend แบบ Production")
a("- ไม่รวมภาพ Pickup QR และ Token ลงหลักฐานที่แชร์")
a()
a("## 9. ตำแหน่งไฟล์หลักฐาน")
a()
a("- Script ทดสอบ: UniStore_Hub/tests/e2e/aws-live-browser-qa.mjs")
a("- ตำแหน่งเก็บหลักฐานแยก Workspace: test-0.4.0/evidence/report/aws-live-browser/")
a("- สคริปต์จะไม่บันทึกภาพใน UniStore_Hub และจะหยุดหากไม่พบ Workspace test-0.4.0")
a("- ผล JSON: test-0.4.0/evidence/report/aws-live-browser/results-public.json, results-buyer.json, results-owner.json")
a("- Screenshots 21 ภาพ, Contact Sheet: test-0.4.0/evidence/report/aws-live-browser/")
a("- ZIP: test-0.4.0/evidence/report/aws-live-browser/UniStore_Hub_AWS_Live_Browser_Evidence.zip")
a("- รายงาน AWS Deploy ก่อนหน้า: tests/reports/aws-learner-lab-live-results.md")
a("- ข้อค้นพบ Worker Recovery: docs/deployment/AWS_NOTIFICATION_WORKER_RECOVERY_2026-10-28.md")
report.write_text("\n".join(lines)+"\n",encoding="utf-8")
archive=root/"UniStore_Hub_AWS_Live_Browser_Evidence.zip"
with ZipFile(archive,"w",ZIP_DEFLATED,compresslevel=7) as z:
 z.write(report,report.name)
 for p in pages:z.write(root/p["evidence"],"screenshots/"+p["evidence"])
 for role in roles:z.write(root/("results-"+role+".json"),"results-"+role+".json")
 z.write(root/"contact-sheet.png","contact-sheet.png")
with ZipFile(archive) as z:
 assert z.testzip() is None
 print("REPORT",report,"IMAGES",len(pages),"FILES_IN_ZIP",len(z.namelist()),"ZIP_BYTES",archive.stat().st_size)
 print("SHA256",hashlib.sha256(archive.read_bytes()).hexdigest())
