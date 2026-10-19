import Link from "next/link";

import type { OrderStatus } from "@/types";

import styles from "./staff-order-next-task.module.css";

const nextTask: Record<OrderStatus, { title: string; help: string; queue: "payments" | "pickups" | null }> = {
  PENDING_PAYMENT: {
    title: "รอผู้ซื้อส่งหลักฐาน",
    help: "ยังไม่ต้องตัดสินผลการชำระเงิน รอหลักฐานจากผู้ซื้อก่อน",
    queue: null,
  },
  PAYMENT_REVIEW: {
    title: "ตรวจหลักฐานการชำระเงิน",
    help: "เปิดคิวตรวจชำระเงินเพื่อเทียบหลักฐานกับยอดคำสั่งซื้อ ก่อนอนุมัติหรือปฏิเสธ",
    queue: "payments",
  },
  PAYMENT_REJECTED: {
    title: "รอผู้ซื้อส่งหลักฐานใหม่",
    help: "แจ้งเหตุผลปฏิเสธแล้ว ระบบรอให้ผู้ซื้อแก้ไขและส่งหลักฐานใหม่",
    queue: null,
  },
  PAID: {
    title: "ผ่านการชำระเงินแล้ว",
    help: "ติดตามการยืนยันคำสั่งซื้อและขั้นตอนการผลิตต่อจากข้อมูลล่าสุด",
    queue: null,
  },
  CONFIRMED: {
    title: "คำสั่งซื้อได้รับการยืนยัน",
    help: "รอเข้าสู่ขั้นตอนการผลิตตามกระบวนการของหน่วยงาน",
    queue: null,
  },
  IN_PRODUCTION: {
    title: "อยู่ระหว่างการผลิต",
    help: "ตรวจความคืบหน้าการผลิตก่อนแจ้งผู้ซื้อให้มารับสินค้า",
    queue: null,
  },
  READY_FOR_PICKUP: {
    title: "ตรวจข้อมูลก่อนส่งมอบ",
    help: "เปิดคิวรับสินค้า แล้วเทียบ Token กับคำสั่งซื้อก่อนยืนยันว่ามีการส่งมอบจริง",
    queue: "pickups",
  },
  RECEIVED: {
    title: "ส่งมอบสินค้าเรียบร้อย",
    help: "รายการนี้เสร็จสิ้นแล้ว ไม่ต้องยืนยันรับสินค้าซ้ำ",
    queue: null,
  },
  CANCELLED: {
    title: "รายการถูกยกเลิก",
    help: "คำสั่งซื้อนี้สิ้นสุดแล้ว ไม่มีขั้นตอนชำระเงินหรือรับสินค้าต่อ",
    queue: null,
  },
};

export function StaffOrderNextTask({ organizationId, status }: { organizationId: string; status: OrderStatus }) {
  const task = nextTask[status];
  const path = task.queue === "payments" ? "/org/payments/" : "/org/pickups/";
  return (
    <aside className={styles.box} aria-label="แนวทางดำเนินการสำหรับสถานะนี้">
      <div className={styles.body}>
        <span className={styles.eyebrow}>ขั้นตอนถัดไป</span>
        <strong>{task.title}</strong>
        <p>{task.help}</p>
      </div>
      {task.queue ? (
        <Link className={styles.link} href={path + "?" + new URLSearchParams({ organizationId }).toString()}>
          {task.queue === "payments" ? "เปิดคิวตรวจชำระเงิน" : "เปิดคิวรับสินค้า"}
          <span aria-hidden="true">↗</span>
        </Link>
      ) : null}
    </aside>
  );
}
