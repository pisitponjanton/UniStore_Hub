# UniStore Hub — ผลทดสอบเว็บไซต์จริงหลัง Redeploy บน AWS

**วันที่ตรวจ:** 28 ตุลาคม 2569 (Asia/Bangkok)
**Source Commit:** c02ff57
**Environment:** AWS Academy Learner Lab, us-east-1, CloudFormation: unistore-hub-dev
**Scope:** Read-only Browser Smoke และการตรวจสิทธิ์ API โดยใช้ข้อมูล QA เดิม (ไม่สร้างคำสั่งซื้อใหม่)

## 1. วัตถุประสงค์และวิธีการทดสอบ

ทดสอบส่วนติดต่อผู้ใช้ UniStore Hub ที่ Deploy จริงด้วย Google Chrome/Chromium แบ่งเป็น Public, Customer และ Organization Admin โดยเข้าผ่าน Amazon S3 Static Website (HTTP) และตรวจการเชื่อมต่อ Backend ผ่าน API Gateway (HTTPS) → Lambda → DynamoDB

เกณฑ์ Browser PASS คือหน้า HTTP 200, แสดงข้อความหลักตามที่กำหนด, ไม่พบ JavaScript Page Error, ไม่ปรากฏหน้า Not Found/Permission Denied โดยไม่คาดหมาย และไม่มี Horizontal Overflow บนขนาดหน้าจอที่ทดสอบ

## 2. สรุปผล

| บทบาท/กรณี | ทดสอบ | ผ่าน | ไม่ผ่าน |
|---|---:|---:|---:|
| Public | 4 | 4 | 0 |
| Customer | 8 | 8 | 0 |
| Organization Admin | 9 | 9 | 0 |
| **Browser รวม** | **21** | **21** | **0** |
| การตรวจสิทธิ์ API (Negative) | 3 | 3 | 0 |

**ตรวจ Responsive:** 4 กรณีบนหน้าจอ 390×844 ไม่มี Horizontal Overflow ที่ตรวจพบ; ที่เหลือตรวจบน 1440×900

## 3. ตารางผลทดสอบหน้าเว็บจริง

| No. | Role | Route | Screen | HTTP | Result | Screenshot |
|---:|---|---|---|---:|---|---|
| 1 | public | / | 1440x900 | 200 | PASS | public--.png |
| 2 | public | /shops/ | 1440x900 | 200 | PASS | public--shops-.png |
| 3 | public | /stores/view/ | 1440x900 | 200 | PASS | public--stores-view-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe-.png |
| 4 | public | /shops/ | 390x844 | 200 | PASS | public-mobile--shops-.png |
| 5 | buyer | / | 1440x900 | 200 | PASS | buyer--.png |
| 6 | buyer | /my/orders/ | 1440x900 | 200 | PASS | buyer--my-orders-.png |
| 7 | buyer | /my/order/ | 1440x900 | 200 | PASS | buyer--my-order-orderId-5dc8a6f9-6f0c-4112-9d9b-033cac771a6d.png |
| 8 | buyer | /notifications/ | 1440x900 | 200 | PASS | buyer--notifications-.png |
| 9 | buyer | /products/view/ | 1440x900 | 200 | PASS | buyer--products-view-organizationId-e27c3a6b-0de9-4c89-9b16-139064568ab.png |
| 10 | buyer | /my/orders/ | 390x844 | 200 | PASS | buyer-mobile--my-orders-.png |
| 11 | buyer | /notifications/ | 390x844 | 200 | PASS | buyer-mobile--notifications-.png |
| 12 | buyer | /platform/organizations/ | 1440x900 | 200 | PASS | buyer--platform-organizations-.png |
| 13 | owner | /org/dashboard/ | 1440x900 | 200 | PASS | owner--org-dashboard-organizationId-e27c3a6b-0de9-4c89-9b16-139064568ab.png |
| 14 | owner | /org/stores/ | 1440x900 | 200 | PASS | owner--org-stores-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png |
| 15 | owner | /org/products/ | 1440x900 | 200 | PASS | owner--org-products-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png |
| 16 | owner | /org/orders/ | 1440x900 | 200 | PASS | owner--org-orders-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png |
| 17 | owner | /org/payments/ | 1440x900 | 200 | PASS | owner--org-payments-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png |
| 18 | owner | /org/production/ | 1440x900 | 200 | PASS | owner--org-production-organizationId-e27c3a6b-0de9-4c89-9b16-139064568a.png |
| 19 | owner | /org/audit/ | 1440x900 | 200 | PASS | owner--org-audit-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png |
| 20 | owner | /org/stores/campaign/ | 1440x900 | 200 | PASS | owner--org-stores-campaign-organizationId-e27c3a6b-0de9-4c89-9b16-13906.png |
| 21 | owner | /org/dashboard/ | 390x844 | 200 | PASS | owner-mobile--org-dashboard-organizationId-e27c3a6b-0de9-4c89-9b16-139064568ab.png |

## 4. ผลตรวจสิทธิ์ API

| User | API GET Path | Actual HTTP | Error Code | Result |
|---|---|---:|---|---|
| buyer | /platform/organizations | 403 | ROLE_FORBIDDEN | PASS |
| buyer | /organizations/e27c3a6b-0de9-4c89-9b16-139064568abe/orders | 403 | MEMBERSHIP_REQUIRED | PASS |
| owner | /platform/organizations | 403 | ROLE_FORBIDDEN | PASS |

บัญชี Customer และ Organization Admin ไม่สามารถเข้าถึง API ของ Platform Admin ได้ (HTTP 403) และ Customer ไม่สามารถอ่าน Orders ระดับ Organization ได้ (HTTP 403). เป็นการตรวจ GET เท่านั้น

## 5. ข้อความสรุปพร้อมใช้ในบทที่ 4

การทดสอบระบบ UniStore Hub หลัง Redeploy บน AWS Academy Learner Lab ดำเนินการด้วยเว็บเบราว์เซอร์ Chromium โดยใช้บัญชีทดสอบจำลอง และตรวจส่วนติดต่อผู้ใช้งานตามสิทธิ์ของ Public, Customer และ Organization Admin รวม 21 กรณี ครอบคลุมการแสดงผลหน้าแรก ร้านค้า สินค้า คำสั่งซื้อ การแจ้งเตือน Dashboard การชำระเงิน สรุปการผลิต และ Audit Logs ผลการตรวจตามเกณฑ์ที่กำหนดผ่านครบ 21 กรณี และการป้องกันการเรียก API โดยบัญชีที่ไม่มีสิทธิ์ผ่าน 3 กรณี โดยไม่ตรวจพบ JavaScript Error หรือ Horizontal Overflow ในหน้าที่ทดสอบ ทั้งนี้ผลดังกล่าวยืนยันเฉพาะการแสดงผลและสิทธิ์อ่านข้อมูล ไม่ได้เป็นการทดสอบธุรกรรมใหม่หรือรับรองความปลอดภัยระดับ Production

## 6. รูปประกอบที่แนะนำสำหรับรายงาน

จัดภาพจากชุดหลักฐานไว้ตามหัวข้อดังต่อไปนี้ โดยใช้คำบรรยายแล้วปรับเลขรูปตามรูปเล่มฉบับจริง:
- ภาพประกอบ 01: หน้าแรกของระบบ UniStore Hub — public--.png
- ภาพประกอบ 02: หน้าร้านสาธิตบน Storefront — public--stores-view-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe-.png
- ภาพประกอบ 03: Customer ตรวจสอบรายการคำสั่งซื้อ — buyer--my-orders-.png
- ภาพประกอบ 04: Customer ติดตามสถานะรับสินค้า — buyer--my-order-orderId-5dc8a6f9-6f0c-4112-9d9b-033cac771a6d.png
- ภาพประกอบ 05: Customer ดู Notification ที่ Worker บันทึก — buyer--notifications-.png
- ภาพประกอบ 06: รายละเอียดสินค้าและตัวเลือก — buyer--products-view-organizationId-e27c3a6b-0de9-4c89-9b16-139064568ab.png
- ภาพประกอบ 07: Dashboard ของ Organization Admin — owner--org-dashboard-organizationId-e27c3a6b-0de9-4c89-9b16-139064568ab.png
- ภาพประกอบ 08: หน้าจัดการร้านค้าของหน่วยงาน — owner--org-stores-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png
- ภาพประกอบ 09: รายการคำสั่งซื้อของหน่วยงาน — owner--org-orders-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png
- ภาพประกอบ 10: หน้าตรวจสอบการชำระเงิน — owner--org-payments-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png
- ภาพประกอบ 11: สรุปงานผลิต — owner--org-production-organizationId-e27c3a6b-0de9-4c89-9b16-139064568a.png
- ภาพประกอบ 12: ประวัติการทำรายการ — owner--org-audit-organizationId-e27c3a6b-0de9-4c89-9b16-139064568abe.png
- ภาพประกอบ 13: หน้ารายละเอียดแคมเปญ QA — owner--org-stores-campaign-organizationId-e27c3a6b-0de9-4c89-9b16-13906.png

ภาพบนมือถือ: public-mobile--shops-.png และภาพที่ขึ้นต้นด้วย buyer-mobile / owner-mobile ใน ZIP หลักฐาน

## 7. ผลการทดสอบก่อนหน้าที่ใช้ประกอบ แต่ไม่นับซ้ำใน Browser 21 กรณี

- ทดสอบธุรกิจบน AWS ด้วยข้อมูล QA: สมัครสมาชิก, สร้างองค์กร/ร้าน, สินค้าและ Variant, Pre-order, Order, เอกสารชำระเงินจำลอง TEST ONLY, Payment Approval, Production, Ready for Pickup, QR และยืนยันรับสินค้าจำลอง สำเร็จแล้วก่อนรอบนี้ ไม่ได้มีการชำระเงินจริง
- Notifications: หลังซ่อม Lambda SQS Event Source Mapping จาก Disabled เป็น Enabled หน้า Customer แสดง Payment Approved และ Ready for Pickup จริง
- AWS Smoke หลัง Redeploy ก่อนหน้านี้ผ่าน 13/13 บน Commit c02ff57; การเรียกรันซ้ำล่าสุดถูก CloudShell Disconnect จึงไม่อ้างเป็นผลรันใหม่

## 8. ข้อจำกัดและงานต่อไป

- ยังไม่ได้ลงชื่อเข้าใช้ Platform Admin ที่มีสิทธิ์จริง และไม่ได้ทดสอบ Staff Role แยกในรอบนี้
- ยังไม่ได้ทำธุรกรรม Order/Payment/Pickup ซ้ำหลัง Redeploy; ผลเดิมเป็นอีกช่วงเวลาหนึ่ง
- ยังไม่มี Load/Stress Test, Penetration Test, Backup/Restore Test หรือสรุปต้นทุนเฉพาะโครงการแบบแยกบริการ
- Frontend แบบ S3 Static Website ใช้ HTTP เฉพาะสภาพแวดล้อม Learner Lab ไม่ควรสรุปว่าเป็น HTTPS Frontend แบบ Production
- ไม่รวมภาพ Pickup QR และ Token ลงหลักฐานที่แชร์

## 9. ตำแหน่งไฟล์หลักฐาน

- Script ทดสอบ: tests/e2e/aws-live-browser-qa.mjs
- ผล JSON: tests/.tmp/aws-live-browser/results-public.json, results-buyer.json, results-owner.json
- Screenshots 21 ภาพ, Contact Sheet: tests/.tmp/aws-live-browser/
- ZIP: tests/.tmp/aws-live-browser/UniStore_Hub_AWS_Live_Browser_Evidence.zip
- รายงาน AWS Deploy ก่อนหน้า: tests/reports/aws-learner-lab-live-results.md
- ข้อค้นพบ Worker Recovery: docs/deployment/AWS_NOTIFICATION_WORKER_RECOVERY_2026-10-28.md
