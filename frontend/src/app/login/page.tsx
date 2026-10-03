import type { Metadata } from "next";

import { AuthEntryState, AuthPageFrame, LoginForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | UniStore Hub",
};

export default function LoginPage() {
  return (
    <AuthPageFrame
      introKicker="กลับมาทำรายการต่อ"
      introTitle="กลับเข้าสู่รายการของคุณได้จากบัญชีเดียว"
      introDescription="เข้าสู่ระบบเพื่อดูคำสั่งซื้อ การชำระเงิน การรับสินค้า และพื้นที่หน่วยงานที่บัญชีของคุณได้รับสิทธิ์"
    >
      <AuthEntryState>
        <LoginForm />
      </AuthEntryState>
    </AuthPageFrame>
  );
}
