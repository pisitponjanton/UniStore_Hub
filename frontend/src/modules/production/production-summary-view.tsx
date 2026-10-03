"use client";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  Notice,
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
      return "ไม่พบแคมเปญนี้ในหน่วยงาน";
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

  async function loadSummary(nextCampaignId: string) {
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

  const totalVariants =
    state.status === "success"
      ? state.summary.products.reduce(
          (total, product) => total + product.variants.length,
          0,
        )
      : 0;
  const totalQuantity =
    state.status === "success"
      ? state.summary.products.reduce(
          (productTotal, product) =>
            productTotal +
            product.variants.reduce(
              (variantTotal, variant) =>
                variantTotal + variant.quantity,
              0,
            ),
          0,
        )
      : 0;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerCopy} data-ledger-heading>
            <span className={styles.pageKicker}>รายการเตรียมผลิตตามแคมเปญ</span>
            <h1 className={styles.title}>สรุปงานผลิต</h1>
            <p className={styles.description}>
              เลือกแคมเปญเพื่อดูจำนวนสินค้าที่ต้องเตรียม แยกตามสินค้าและตัวเลือก โดยใช้สรุปที่ระบบส่งกลับโดยตรง
            </p>
          </div>
        </header>

        <section
          className={styles.campaignPanel}
          aria-labelledby="production-campaign-title"
        >
          <div className={styles.panelHeading}>
            <div>
              <h2
                className={styles.sectionTitle}
                id="production-campaign-title"
              >
                เลือกแคมเปญ
              </h2>
              <p className={styles.sectionDescription}>
                Production Summary ต้องระบุ Campaign ID ก่อนโหลดข้อมูล
              </p>
            </div>
            {loadedCampaignId ? (
              <span className={styles.contextCode}>
                {loadedCampaignId}
              </span>
            ) : null}
          </div>

          <form className={styles.campaignForm} onSubmit={handleSubmit}>
            <TextField
              id="production-campaign-id"
              label="Campaign ID"
              value={campaignId}
              onChange={(event) => {
                setCampaignId(event.target.value);
                setCampaignError(undefined);
              }}
              error={campaignError}
              hint="ระบุแคมเปญที่ต้องการดูยอดผลิต"
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
        </section>

        {inlineError ? (
          <Notice tone="danger" role="alert" title="โหลดสรุปไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        {state.status === "idle" ? (
          <Notice tone="neutral" title="ยังไม่ได้เลือกแคมเปญ">
            ระบุ Campaign ID ด้านบนเพื่อดูจำนวนสินค้าที่ต้องผลิต
          </Notice>
        ) : null}

        {state.status === "loading" ? (
          <LoadingState
            title="กำลังโหลดสรุปการผลิต"
            description="กำลังเตรียมจำนวนสินค้าและตัวเลือกของแคมเปญ"
          />
        ) : null}

        {state.status === "notFound" ? (
          <ErrorState
            title="ไม่พบแคมเปญ"
            description="ตรวจสอบ Campaign ID แล้วลองใหม่อีกครั้ง"
          />
        ) : null}

        {state.status === "error" ? (
          <ErrorState
            title="ไม่สามารถโหลดสรุปการผลิตได้"
            description="กรุณาลองโหลดข้อมูลของแคมเปญนี้ใหม่อีกครั้ง"
          />
        ) : null}

        {state.status === "success" ? (
          <>
            <section
              className={styles.summaryStrip}
              aria-label="สรุปจำนวนที่ต้องผลิต"
            >
              <div>
                <span className={styles.summaryLabel}>สินค้า</span>
                <strong>{state.summary.products.length}</strong>
              </div>
              <div>
                <span className={styles.summaryLabel}>ตัวเลือกสินค้า</span>
                <strong>{totalVariants}</strong>
              </div>
              <div>
                <span className={styles.summaryLabel}>
                  จำนวนรวมที่ต้องผลิต
                </span>
                <strong>{totalQuantity.toLocaleString("th-TH")}</strong>
              </div>
            </section>

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
                    รายการผลิตตามสินค้า
                  </h2>
                  <p className={styles.sectionDescription}>
                    ใช้จำนวนในรายการนี้เป็นข้อมูลอ้างอิงสำหรับเตรียมงานผลิตของแคมเปญที่เลือก
                  </p>
                </div>
              </div>

              {state.summary.products.length === 0 ? (
                <EmptyState
                  title="ยังไม่มีรายการที่ต้องผลิต"
                  description="แคมเปญนี้ยังไม่มีคำสั่งซื้อที่เข้าเงื่อนไขสำหรับสรุปงานผลิต"
                />
              ) : (
                <div className={styles.productList}>
                  {state.summary.products.map((product) => {
                    const productQuantity = product.variants.reduce(
                      (total, variant) => total + variant.quantity,
                      0,
                    );

                    return (
                      <article
                        className={styles.productGroup}
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
                          <div className={styles.productTotal}>
                            <span>รวม</span>
                            <strong>
                              {productQuantity.toLocaleString("th-TH")}
                            </strong>
                          </div>
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
                                <strong>
                                  {variant.quantity.toLocaleString("th-TH")}
                                </strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
