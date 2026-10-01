import type { Metadata } from "next";

import { AuthEntryState, AuthPageFrame, LoginForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | UniStore Hub",
};

export default function LoginPage() {
  return (
    <AuthPageFrame
      introTitle="กลับมาทำรายการต่อใน UniStore Hub"
      introDescription="เข้าสู่ระบบเพื่อดูคำสั่งซื้อ การแจ้งเตือน และพื้นที่หน่วยงานที่บัญชีของคุณมีสิทธิ์ใช้งาน"
    >
      <AuthEntryState>
        <LoginForm />
      </AuthEntryState>
    </AuthPageFrame>
  );
}
