# UniStore Hub — Route, Role and State Inventory

Source aligned to frontend/quality-audit/coverage-baseline.json (28 routes, 207 route action families, 50 shared-shell actions).
Every combination begins NOT_TESTED for the new redesign. Historical test results do not certify unseen new UI.

| Route | Source roles | Action families | Primary task |
| --- | --- | ---: | --- |
| / | guest, customer | 6 | ค้นหาร้านและสินค้าที่เปิดขาย |
| /login/ | guest, customer | 10 | เข้าสู่ระบบ |
| /register/ | guest, customer | 11 | สมัครบัญชี |
| /stores/view/ | guest, customer | 4 | ดูสินค้าในร้าน |
| /products/view/ | guest, customer | 7 | เลือกสินค้าและตัวเลือก |
| /campaigns/view/ | guest, customer | 3 | ดูรอบขายพรีออเดอร์ |
| /orders/new/ | customer | 8 | ตรวจและยืนยันคำสั่งซื้อ |
| /my/orders/ | customer | 4 | ดูสถานะรายการของฉัน |
| /my/order/ | customer | 6 | เปิดรายละเอียดคำสั่งซื้อ |
| /my/payment/ | customer | 5 | ส่งหลักฐานชำระเงิน |
| /my/pickup/ | customer | 4 | ดูข้อมูลรับสินค้า |
| /notifications/ | customer | 7 | เปิดรายการจากการแจ้งเตือน |
| /org/select/ | staff, organizationAdmin | 5 | เลือกหน่วยงาน |
| /org/dashboard/ | organizationAdmin | 12 | เปิดงานที่รอดำเนินการ |
| /org/settings/ | organizationAdmin | 6 | แก้ไขข้อมูลหน่วยงาน |
| /org/staff/ | organizationAdmin | 6 | จัดการทีมงาน |
| /org/stores/ | organizationAdmin | 9 | จัดการร้านค้า |
| /org/products/ | organizationAdmin | 24 | จัดการสินค้า/ตัวเลือก/รูปภาพ |
| /org/campaigns/ | organizationAdmin | 26 | จัดการรอบพรีออเดอร์ |
| /org/orders/ | staff, organizationAdmin | 7 | เปิดงานในคิวคำสั่งซื้อ |
| /org/orders/view/ | staff, organizationAdmin | 2 | ดูและดำเนินการตามสิทธิ์ |
| /org/payments/ | staff, organizationAdmin | 14 | ตรวจการชำระเงิน |
| /org/production/ | organizationAdmin | 2 | ตรวจยอดผลิต |
| /org/pickups/ | staff, organizationAdmin | 9 | ยืนยันการรับสินค้า |
| /org/audit/ | organizationAdmin | 8 | ค้นประวัติการทำรายการ |
| /platform/summary/ | platformAdmin | 0 | ดูภาพรวมแพลตฟอร์ม |
| /platform/organizations/ | platformAdmin | 2 | ตรวจหน่วยงานที่รออนุมัติ |
| /platform/users/ | platformAdmin | 0 | ค้นผู้ใช้ |

## Scope
Review all 5 user types (Guest, Customer, Staff, Organization Admin, Platform Admin), including authorized buyer flow for other authenticated roles and forbidden access to restricted routes.
Test Loading, Loaded, Empty, Error, Unauthorized, Forbidden, Validation, Conflict, Pending, Success, Retry, Dialog, Keyboard focus and reduced motion at 320/390/768/1024/1440 widths.
Platform Summary and Platform Users have zero inventory Action IDs but still require substantive visual and interaction review.

## Evidence limitations
Discovery visually observed only public homepage desktop/mobile and login loading; protected role screens and populated data remain NOT_TESTED. Keep the JSON manifest honest as each phase is implemented.
Never elevate actions to PASS through source inspection or screenshots alone; mutation states must be verified safely with intercepted requests or owned disposable fixtures.
