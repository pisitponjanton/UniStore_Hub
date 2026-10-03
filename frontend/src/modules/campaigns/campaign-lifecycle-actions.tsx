"use client";

import { useState } from "react";

import { Badge, Button, ConfirmDialog, Notice } from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { CampaignDTO, CampaignStatus } from "@/types";

import { campaignStatusLabel } from "./campaign-helpers";
import { lifecycleActionsForStatus } from "./campaign-lifecycle";
import { campaignService } from "./campaign-service";
import styles from "./campaign-lifecycle-actions.module.css";

const LIFECYCLE: CampaignStatus[] = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "PRODUCING",
  "READY_FOR_PICKUP",
  "COMPLETED",
];

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "PAYMENT_NOT_REVIEWABLE") {
      return "ยังมีคำสั่งซื้อที่อยู่ระหว่างตรวจสอบการชำระเงิน จึงยังไม่สามารถเริ่มการผลิตได้";
    }

    if (error.code === "INVALID_STATUS_TRANSITION") {
      return "สถานะของแคมเปญหรือข้อมูลที่เกี่ยวข้องเปลี่ยนไปแล้ว ระบบจึงไม่อนุญาตการดำเนินการนี้ กรุณาตรวจสอบสถานะล่าสุด";
    }

    if (error.code === "CAMPAIGN_NOT_FOUND") {
      return "ไม่พบแคมเปญนี้แล้ว กรุณารีเฟรชรายการ";
    }

    return error.userMessage;
  }

  return "ไม่สามารถเปลี่ยนสถานะแคมเปญได้ กรุณาลองใหม่อีกครั้ง";
}

function lifecycleStepState(
  step: CampaignStatus,
  current: CampaignStatus,
): "done" | "current" | "upcoming" {
  if (current === "CANCELLED") {
    return "upcoming";
  }

  const currentIndex = LIFECYCLE.indexOf(current);
  const stepIndex = LIFECYCLE.indexOf(step);

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "upcoming";
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
        `สถานะเปลี่ยนเป็น “${campaignStatusLabel(updated.status)}” แล้ว`,
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
      <div className={styles.currentState}>
        <div>
          <span className={styles.stateLabel}>สถานะปัจจุบัน</span>
          <strong>{campaignStatusLabel(campaign.status)}</strong>
        </div>
        <Badge
          tone={
            campaign.status === "CANCELLED"
              ? "danger"
              : campaign.status === "COMPLETED" ||
                  campaign.status === "READY_FOR_PICKUP"
                ? "success"
                : campaign.status === "OPEN"
                  ? "info"
                  : campaign.status === "CLOSED" ||
                      campaign.status === "PRODUCING"
                    ? "warning"
                    : "neutral"
          }
        >
          {campaignStatusLabel(campaign.status)}
        </Badge>
      </div>

      {campaign.status === "CANCELLED" ? (
        <div className={styles.cancelledPath} role="status">
          <span className={styles.cancelledMarker} aria-hidden="true" />
          <div>
            <strong>วงจรแคมเปญสิ้นสุดด้วยการยกเลิก</strong>
            <span>
              ระบบจะไม่แสดงขั้นตอนถัดไปหลังจากสถานะยกเลิก
            </span>
          </div>
        </div>
      ) : (
        <ol className={styles.lifecycleRail} aria-label="ลำดับสถานะแคมเปญ">
          {LIFECYCLE.map((step, index) => {
            const stepState = lifecycleStepState(step, campaign.status);

            return (
              <li
                className={styles.lifecycleStep}
                data-state={stepState}
                aria-current={stepState === "current" ? "step" : undefined}
                key={step}
              >
                <span className={styles.lifecycleIndex} aria-hidden="true">
                  {stepState === "done" ? "✓" : index + 1}
                </span>
                <span className={styles.lifecycleLabel}>
                  {campaignStatusLabel(step)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {error ? (
        <Notice tone="danger" role="alert" title="เปลี่ยนสถานะไม่สำเร็จ">
          {error}
        </Notice>
      ) : null}

      {notice ? (
        <Notice tone="success" role="status" title="เปลี่ยนสถานะแล้ว">
          {notice}
        </Notice>
      ) : null}

      {actions.length === 0 ? (
        <div className={styles.none}>
          <strong>ไม่มีขั้นตอนถัดไปจากสถานะนี้</strong>
          <span>
            {campaign.status === "COMPLETED"
              ? "แคมเปญเสร็จสิ้นแล้ว"
              : "แคมเปญถูกยกเลิกแล้ว"}
          </span>
        </div>
      ) : (
        <div className={styles.actionArea}>
          <div className={styles.actionCopy}>
            <strong>การดำเนินการที่ทำได้</strong>
            <span>
              ระบบจะแสดงเฉพาะการเปลี่ยนสถานะที่รองรับจากสถานะปัจจุบัน และตรวจสอบเงื่อนไขอีกครั้งเมื่อยืนยัน
            </span>
          </div>

          <div className={styles.actions}>
            {actions.map((action, index) => {
              const pending = pendingAction === action.action;

              return (
                <ConfirmDialog
                  key={action.action}
                  trigger={
                    <Button
                      variant={
                        action.danger
                          ? "danger"
                          : index === 0
                            ? "primary"
                            : "secondary"
                      }
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
        </div>
      )}
    </div>
  );
}
