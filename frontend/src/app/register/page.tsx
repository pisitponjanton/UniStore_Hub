import type { Metadata } from "next";

import { AuthPageFrame, RegisterForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "สมัครสมาชิก | UniStore Hub",
};

export default function RegisterPage() {
  return (
    <AuthPageFrame
      eyebrow="Create account"
      introTitle="เริ่มใช้งานร้านค้าและพรีออเดอร์ของหน่วยงานในมหาวิทยาลัย"
      introDescription="สร้างบัญชีสำหรับการสั่งสินค้า ชำระเงิน ติดตามสถานะ และรับสินค้า โดยสิทธิ์ของ Staff/Admin จะถูกกำหนดจากสมาชิกหน่วยงานในระบบ"
    >
      <RegisterForm />
    </AuthPageFrame>
  );
}
