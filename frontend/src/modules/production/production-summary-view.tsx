"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  TextField,
  UnauthorizedState,
} from "@/components";
import {
  authSession,
  isDefinitiveSessionFailure,
} from "@/modules/auth";
import { ApiClientError } from "@/services";
import type { ProductionSummaryDTO } from "@/types";

import {
  normalizeCampaignId,
  productionHref,
} from "./production-helpers";
import { productionService } from "./production-service";
import styles from "./production-summary-view.module.css";

type SummaryState =
  | { status: "idle" }
  | { status: "loading"; campaignId: string }
  | {
      status: "success";
      summary: ProductionSummaryDTO;
    }
  | { status: "notFound"; campaignId: string }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "error"; campaignId: string };

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "CAMPAIGN_NOT_FOUND") {
      return "ไม่พบ Campaign นี้ในหน่วยงาน";
    }

    return error.userMessage;
  }

  return "ไม่สามารถโหลดสรุปการผลิตได้ กรุณาลองใหม่อีกครั้ง";
}

export function ProductionSummaryView({
  organizationId,
  initialCampaignId,
}: {
  organizationId: string;
  initialCampaignId: string | null;
}) {
  const [campaignId, setCampaignId] = useState(
    initialCampaignId ?? "",
  );
  const [campaignError, setCampaignError] = useState<
    string | undefined
  >();
  const [state, setState] = useState<SummaryState>(
    initialCampaignId
      ? {
          status: "loading",
          campaignId: initialCampaignId,
        }
      : { status: "idle" },
  );
  const [inlineError, setInlineError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!initialCampaignId) {
      return;
    }

    const campaign: string = initialCampaignId;
    const controller = new AbortController();

    async function loadInitial() {
      try {
        const summary = await productionService.getSummary(
          organizationId,
          campaign,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setState({
            status: "success",
            summary,
          });
        }
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          return;
        }

        if (isDefinitiveSessionFailure(error)) {
          authSession.logout();
          return;
        }

        if (error instanceof ApiClientError) {
          if (error.kind === "unauthorized") {
            setState({ status: "unauthorized" });
            return;
          }

          if (error.kind === "forbidden") {
            setState({ status: "forbidden" });
            return;
          }

          if (
            error.kind === "notFound" ||
            error.code === "CAMPAIGN_NOT_FOUND"
          ) {
            setState({
              status: "notFound",
              campaignId: campaign,
            });
            return;
          }
        }

        setInlineError(loadErrorMessage(error));
        setState({
          status: "error",
          campaignId: campaign,
        });
      }
    }

    void loadInitial();

    return () => controller.abort();
  }, [initialCampaignId, organizationId]);

  async function loadSummary(
    nextCampaignId: string,
  ) {
    setState({
      status: "loading",
      campaignId: nextCampaignId,
    });
    setInlineError(null);

    try {
      const summary = await productionService.getSummary(
        organizationId,
        nextCampaignId,
      );

      setState({
        status: "success",
        summary,
      });

      window.history.replaceState(
        {},
        "",
        productionHref(organizationId, nextCampaignId),
      );
    } catch (error) {
      if (isDefinitiveSessionFailure(error)) {
        authSession.logout();
        return;
      }

      if (error instanceof ApiClientError) {
        if (error.kind === "unauthorized") {
          setState({ status: "unauthorized" });
          return;
        }

        if (error.kind === "forbidden") {
          setState({ status: "forbidden" });
          return;
        }

        if (
          error.kind === "notFound" ||
          error.code === "CAMPAIGN_NOT_FOUND"
        ) {
          setState({
            status: "notFound",
            campaignId: nextCampaignId,
          });
          return;
        }
      }

      setInlineError(loadErrorMessage(error));
      setState({
        status: "error",
        campaignId: nextCampaignId,
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = normalizeCampaignId(campaignId);

    if (!normalized) {
      setCampaignError("กรุณาระบุ Campaign ID");
      return;
    }

    setCampaignId(normalized);
    setCampaignError(undefined);
    void loadSummary(normalized);
  }

  if (state.status === "unauthorized") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <UnauthorizedState />
        </main>
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div className={styles.page}>
        <main className={styles.stateWrap}>
          <ForbiddenState />
        </main>
      </div>
    );
  }

  const loadedCampaignId =
    state.status === "success"
      ? state.summary.campaignId
      : state.status === "loading" ||
          state.status === "notFound" ||
          state.status === "error"
        ? state.campaignId
        : null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.eyebrow}>
              Production summary
            </span>
            <h1 className={styles.title}>สรุปการผลิต</h1>
            <p className={styles.description}>
              แสดงยอดผลิตที่ Backend สรุปจาก Order ที่ผ่านการชำระเงิน
              และอยู่ใน paid lifecycle ของ Campaign เท่านั้น
              หน้านี้ไม่คำนวณยอดใหม่จาก Order cache ฝั่ง Browser
            </p>
          </div>

          <Badge tone="info">Organization Admin</Badge>
        </header>

        <form
          className={styles.campaignPanel}
          onSubmit={handleSubmit}
        >
          <TextField
            id="production-campaign-id"
            label="Campaign ID"
            value={campaignId}
            onChange={(event) => {
              setCampaignId(event.target.value);
              setCampaignError(undefined);
            }}
            error={campaignError}
            hint="ระบุ Campaign ที่ต้องการดู Production Summary"
            placeholder="เช่น campaign-123"
            disabled={state.status === "loading"}
            required
          />

          <div className={styles.campaignActions}>
            <Button
              type="submit"
              pending={state.status === "loading"}
              pendingLabel="กำลังโหลดสรุป"
            >
              โหลดสรุปการผลิต
            </Button>
          </div>
        </form>

        {loadedCampaignId ? (
          <div className={styles.context}>
            <span>Campaign ที่กำลังแสดง:</span>
            <span className={styles.contextCode}>
              {loadedCampaignId}
            </span>
          </div>
        ) : null}

        {inlineError ? (
          <div className={styles.errorBox} role="alert">
            {inlineError}
          </div>
        ) : null}

        {state.status === "idle" ? (
          <div className={styles.infoBox}>
            ระบุ Campaign ID เพื่อโหลดสรุปการผลิตจาก Backend
          </div>
        ) : null}

        {state.status === "loading" ? (
          <LoadingState title="กำลังโหลดสรุปการผลิต" />
        ) : null}

        {state.status === "notFound" ? (
          <ErrorState
            title="ไม่พบ Campaign"
            description="ตรวจสอบ Campaign ID แล้วลองใหม่อีกครั้ง"
          />
        ) : null}

        {state.status === "error" ? (
          <ErrorState
            title="ไม่สามารถโหลดสรุปการผลิตได้"
            description="ข้อมูลเดิมจะไม่ถูกนำมาคำนวณทดแทน กรุณาลองโหลดจาก Backend ใหม่"
          />
        ) : null}

        {state.status === "success" ? (
          <section
            className={styles.section}
            aria-labelledby="production-summary-products"
          >
            <div className={styles.sectionHeader}>
              <div>
                <h2
                  className={styles.sectionTitle}
                  id="production-summary-products"
                >
                  Product / Variant ที่ต้องผลิต
                </h2>
                <p className={styles.description}>
                  ปริมาณด้านล่างมาจาก Production Summary endpoint
                  โดยตรง
                </p>
              </div>

              <Badge tone="neutral">
                {state.summary.products.length} Product
              </Badge>
            </div>

            {state.summary.products.length === 0 ? (
              <EmptyState
                title="ยังไม่มีรายการที่ต้องผลิต"
                description="Campaign นี้ยังไม่มี Order ที่มี Payment APPROVED และอยู่ในสถานะ PAID, CONFIRMED, IN_PRODUCTION, READY_FOR_PICKUP หรือ RECEIVED"
              />
            ) : (
              <div className={styles.productList}>
                {state.summary.products.map((product) => (
                  <article
                    className={styles.productCard}
                    key={product.productId}
                  >
                    <div className={styles.productHeader}>
                      <div className={styles.productCopy}>
                        <h3 className={styles.productName}>
                          {product.productName}
                        </h3>
                        <span className={styles.productId}>
                          Product ID: {product.productId}
                        </span>
                      </div>

                      <Badge tone="neutral">
                        {product.variants.length} Variant
                      </Badge>
                    </div>

                    <div className={styles.variantList}>
                      {product.variants.map((variant) => (
                        <div
                          className={styles.variantRow}
                          key={variant.variantId}
                        >
                          <div className={styles.variantCopy}>
                            <span className={styles.variantName}>
                              {variant.variantName}
                            </span>
                            <span className={styles.variantId}>
                              Variant ID: {variant.variantId}
                            </span>
                          </div>

                          <div className={styles.quantity}>
                            <span className={styles.quantityLabel}>
                              จำนวนที่ต้องผลิต
                            </span>
                            {variant.quantity.toLocaleString("th-TH")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
