import type { Metadata } from "next";

import { AuthEntryState, AuthPageFrame, RegisterForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "สมัครสมาชิก | UniStore Hub",
};

export default function RegisterPage() {
  return (
    <AuthPageFrame
      introKicker="บัญชีสำหรับการซื้อในมหาวิทยาลัย"
      introTitle="เริ่มสั่งซื้อและติดตามทุกขั้นตอนในที่เดียว"
      introDescription="สร้างบัญชีเพื่อสั่งสินค้า ติดตามการชำระเงิน และดูข้อมูลรับสินค้า หากหน่วยงานมอบสิทธิ์ให้ พื้นที่สำหรับ Staff/Admin จะปรากฏหลังเข้าสู่ระบบ"
    >
      <AuthEntryState>
        <RegisterForm />
      </AuthEntryState>
    </AuthPageFrame>
  );
}
