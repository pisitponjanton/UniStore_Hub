"use client";

import Link from "next/link";
import { OrganizationOperationsNav } from "@/modules/operations/organization-operations-nav";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { LoadedDirectoryControls } from "@/modules/organization-directory/loaded-directory-controls";
import { searchLoadedItems, visibleLoadedItems } from "@/modules/organization-directory/loaded-directory-helpers";

import {
  Button,
  EmptyState,
  ErrorState,
  ErrorSummary,
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
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryLimit, setDirectoryLimit] = useState(24);
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
  const [summaryFeedback, setSummaryFeedback] = useState<string | null>(
    null,
  );
  const campaignErrorSummaryRef = useRef<HTMLDivElement>(null);

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
          setSummaryFeedback(
            `โหลดสรุปการผลิตของ ${summary.campaignId} แล้ว`,
          );
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
    setSummaryFeedback(null);

    try {
      const summary = await productionService.getSummary(
        organizationId,
        nextCampaignId,
      );

      setState({
        status: "success",
        summary,
      });
      setSummaryFeedback(
        `โหลดสรุปการผลิตของ ${summary.campaignId} แล้ว`,
      );

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
      requestAnimationFrame(() =>
        campaignErrorSummaryRef.current?.focus(),
      );
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

  const productionMatches = state.status === "success"
    ? searchLoadedItems(state.summary.products, directoryQuery, product => [
        product.productName, product.productId,
        ...product.variants.map(variant => variant.variantName),
      ])
    : [];
  const productionVisible = visibleLoadedItems(productionMatches, directoryLimit);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <OrganizationOperationsNav organizationId={organizationId} current="production" />
        <header className={styles.header}>
          <div className={styles.headerCopy}>
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
                ระบุรหัสรอบขายที่ต้องการดูยอดผลิต หรือไปที่หน้ารอบขายเพื่อเลือกรายการก่อน
              </p>
              <Link className={styles.campaignDirectoryLink} href={"/org/campaigns/?" + new URLSearchParams({ organizationId }).toString()}>
                เปิดรายการรอบขายเพื่อดูรหัสที่ต้องการ <span aria-hidden="true">↗</span>
              </Link>
            </div>
            {loadedCampaignId ? (
              <span className={styles.contextCode}>
                {loadedCampaignId}
              </span>
            ) : null}
          </div>

          <form
            className={styles.campaignForm}
            onSubmit={handleSubmit}
            noValidate
            aria-busy={state.status === "loading"}
          >
            <ErrorSummary
              ref={campaignErrorSummaryRef}
              id="production-campaign-error-summary"
              items={
                campaignError
                  ? [
                      {
                        fieldId: "production-campaign-id",
                        message: campaignError,
                      },
                    ]
                  : []
              }
            />
            <TextField
              id="production-campaign-id"
              label="รหัสรอบขาย (Campaign ID)"
              value={campaignId}
              onChange={(event) => {
                setCampaignId(event.target.value);
                setCampaignError(undefined);
                setSummaryFeedback(null);
              }}
              error={campaignError}
              announceError={false}
              onBlur={() => {
                setCampaignError(
                  normalizeCampaignId(campaignId)
                    ? undefined
                    : "กรุณาระบุ Campaign ID",
                );
              }}
              hint="รหัสรอบขายจากหน้ารอบขาย — เมื่อเปิดจากแคมเปญโดยตรงจะใช้รหัสนั้นให้อัตโนมัติ"
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

        {summaryFeedback ? (
          <p
            className={styles.loadFeedback}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {summaryFeedback}
          </p>
        ) : null}

        {inlineError ? (
          <Notice tone="danger" role="alert" title="โหลดสรุปไม่สำเร็จ">
            {inlineError}
          </Notice>
        ) : null}

        {state.status === "idle" ? (
          <Notice tone="neutral" title="ยังไม่ได้เลือกแคมเปญ">
            กรอกรหัสรอบขาย หรือไปยังหน้ารอบขายด้านบนเพื่อค้นหารอบที่ต้องการ ก่อนโหลดจำนวนสินค้าที่ต้องเตรียม
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
                <strong data-numeric>{state.summary.products.length}</strong>
              </div>
              <div>
                <span className={styles.summaryLabel}>ตัวเลือกสินค้า</span>
                <strong data-numeric>{totalVariants}</strong>
              </div>
              <div>
                <span className={styles.summaryLabel}>
                  จำนวนรวมที่ต้องผลิต
                </span>
                <strong data-numeric>{totalQuantity.toLocaleString("th-TH")}</strong>
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

              {state.summary.products.length > 0 ? (
                <LoadedDirectoryControls
                  id="production-product-search"
                  label="ค้นหารายการสินค้าที่ต้องผลิต"
                  query={directoryQuery}
                  onQueryChange={value => { setDirectoryQuery(value); setDirectoryLimit(24); }}
                  loadedCount={state.summary.products.length}
                  matchingCount={productionMatches.length}
                  visibleCount={productionVisible.length}
                  onShowMore={() => setDirectoryLimit(limit => limit + 24)}
                  placeholder="ชื่อสินค้า ตัวเลือก หรือรหัสสินค้า"
                />
              ) : null}
              {state.summary.products.length === 0 ? (
                <EmptyState
                  title="ยังไม่มีรายการที่ต้องผลิต"
                  description="แคมเปญนี้ยังไม่มีคำสั่งซื้อที่เข้าเงื่อนไขสำหรับสรุปงานผลิต"
                />
              ) : (
                <div className={styles.productList}>
                  {productionVisible.map((product) => {
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
                              รหัสสินค้า: {product.productId}
                            </span>
                          </div>
                          <div className={styles.productTotal}>
                            <span>รวม</span>
                            <strong data-numeric>
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
                                  รหัสตัวเลือก: {variant.variantId}
                                </span>
                              </div>

                              <div className={styles.quantity}>
                                <span className={styles.quantityLabel}>
                                  จำนวนที่ต้องผลิต
                                </span>
                                <strong data-numeric>
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
