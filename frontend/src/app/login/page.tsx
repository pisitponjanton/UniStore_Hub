import type { Metadata } from "next";

import { AuthPageFrame, LoginForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | UniStore Hub",
};

export default function LoginPage() {
  return (
    <AuthPageFrame
      eyebrow="Account access"
      introTitle="จัดการการสั่งซื้อและงานของหน่วยงานจากบัญชีเดียว"
      introDescription="เข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ หรือทำงานในหน่วยงานตามสิทธิ์ที่ Backend ยืนยันให้บัญชีนี้"
    >
      <LoginForm />
    </AuthPageFrame>
  );
}
