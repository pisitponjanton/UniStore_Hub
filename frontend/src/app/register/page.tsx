import type { Metadata } from "next";

import { AuthEntryState, AuthPageFrame, RegisterForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "สมัครสมาชิก | UniStore Hub",
};

export default function RegisterPage() {
  return (
    <AuthPageFrame
      introTitle="สร้างบัญชีสำหรับการสั่งซื้อในมหาวิทยาลัย"
      introDescription="ใช้บัญชีเดียวเพื่อสั่งสินค้า ติดตามการชำระเงิน และรับสินค้า หากได้รับสิทธิ์จากหน่วยงาน เมนูสำหรับ Staff/Admin จะปรากฏหลังเข้าสู่ระบบ"
    >
      <AuthEntryState>
        <RegisterForm />
      </AuthEntryState>
    </AuthPageFrame>
  );
}
