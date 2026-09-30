"use client";

import { useState } from "react";

import { Button, ConfirmDialog } from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { CampaignDTO } from "@/types";

import { lifecycleActionsForStatus } from "./campaign-lifecycle";
import { campaignService } from "./campaign-service";
import styles from "./campaign-lifecycle-actions.module.css";

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "PAYMENT_NOT_REVIEWABLE") {
      return "ยังมีคำสั่งซื้อที่อยู่ระหว่างตรวจสอบการชำระเงิน จึงยังไม่สามารถเริ่มการผลิตได้";
    }

    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "Backend ไม่อนุญาตการเปลี่ยนสถานะนี้ อาจเป็นเพราะ Campaign หรือ Order ที่เกี่ยวข้องมีสถานะเปลี่ยนไปแล้ว";
    }

    if (error.code === "CAMPAIGN_NOT_FOUND") {
      return "ไม่พบ Campaign นี้แล้ว กรุณารีเฟรชรายการ";
    }

    return error.userMessage;
  }

  return "ไม่สามารถเปลี่ยนสถานะ Campaign ได้ กรุณาลองใหม่อีกครั้ง";
}

export function CampaignLifecycleActions({
  organizationId,
  campaign,
  onCampaignChanged,
}: {
  organizationId: string;
  campaign: CampaignDTO;
  onCampaignChanged: (campaign: CampaignDTO) => void;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const actions = lifecycleActionsForStatus(campaign.status);

  async function handleAction(
    action: (typeof actions)[number],
  ) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action.action);
    setError(null);
    setNotice(null);

    try {
      const updated = await campaignService.transition(
        organizationId,
        campaign.campaignId,
        action.action,
      );

      onCampaignChanged(updated);
      setNotice(
        `เปลี่ยนสถานะ Campaign เป็น ${updated.status} แล้ว`,
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      setError(errorMessage(error));

      try {
        const refreshed = await campaignService.get(
          organizationId,
          campaign.campaignId,
        );
        onCampaignChanged(refreshed);
      } catch {
        // Preserve the lifecycle error; the parent still holds the last known DTO.
      }
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h3 className={styles.title}>Lifecycle actions</h3>
        <p className={styles.description}>
          สถานะจะเปลี่ยนเฉพาะเมื่อกด action และ Backend อนุมัติ
          ระบบไม่เปลี่ยนสถานะอัตโนมัติตามเวลาใน planning fields
        </p>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}

      {actions.length === 0 ? (
        <span className={styles.none}>
          ไม่มี lifecycle action สำหรับสถานะปัจจุบัน
        </span>
      ) : (
        <div className={styles.actions}>
          {actions.map((action) => {
            const pending = pendingAction === action.action;

            return (
              <ConfirmDialog
                key={action.action}
                trigger={
                  <Button
                    variant={action.danger ? "danger" : "secondary"}
                    disabled={pendingAction !== null}
                  >
                    {action.label}
                  </Button>
                }
                title={action.title}
                description={action.description}
                confirmLabel={action.label}
                danger={action.danger}
                pending={pending}
                onConfirm={() => {
                  void handleAction(action);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
