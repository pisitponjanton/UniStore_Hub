import type { Metadata } from "next";

import { AuthEntryState, AuthPageFrame, RegisterForm } from "@/modules/auth";

export const metadata: Metadata = {
  title: "สมัครสมาชิก | UniStore Hub",
};

export default function RegisterPage() {
  return (
    <AuthPageFrame
      introTitle="สั่งซื้อและติดตามสินค้าได้ในที่เดียว"
      introDescription="ใช้บัญชีเดียวเพื่อสั่งสินค้า ติดตามการชำระเงิน และดูข้อมูลรับสินค้า พื้นที่หน่วยงานจะแสดงตามสิทธิ์ที่บัญชีได้รับ"
    >
      <AuthEntryState>
        <RegisterForm />
      </AuthEntryState>
    </AuthPageFrame>
  );
}
