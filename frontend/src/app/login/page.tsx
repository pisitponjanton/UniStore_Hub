import type { Metadata } from "next";

import { AuthEntryState, AuthPageFrame, LoginForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | UniStore Hub",
};

export default function LoginPage() {
  return (
    <AuthPageFrame
      introTitle="กลับมาดูรายการที่กำลังดำเนินการ"
      introDescription="เข้าสู่ระบบเพื่อดูคำสั่งซื้อ การชำระเงิน การรับสินค้า และพื้นที่หน่วยงานตามสิทธิ์ของบัญชี"
    >
      <AuthEntryState>
        <LoginForm />
      </AuthEntryState>
    </AuthPageFrame>
  );
}
