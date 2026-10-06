import {
  test as base,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";

export type QaDiagnosticEvent =
  | {
      kind: "console-error";
      message: string;
    }
  | {
      kind: "page-error";
      message: string;
    }
  | {
      kind: "request-aborted";
      method: string;
      url: string;
      errorText: string;
    }
  | {
      kind: "request-failed";
      method: string;
      url: string;
      errorText: string;
    }
  | {
      kind: "http-error";
      method: string;
      url: string;
      status: number;
    };

type QaFixtures = {
  qaEvents: QaDiagnosticEvent[];
};

function isTrackedHttpStatus(status: number): boolean {
  return status >= 400;
}

function installDiagnostics(
  page: Page,
  events: QaDiagnosticEvent[],
): void {
  page.on("console", (message) => {
    if (message.type() === "error") {
      events.push({
        kind: "console-error",
        message: message.text(),
      });
    }
  });

  page.on("pageerror", (error) => {
    events.push({
      kind: "page-error",
      message: error.message,
    });
  });

  page.on("requestfailed", (request) => {
    const errorText =
      request.failure()?.errorText ?? "unknown request failure";

    events.push({
      kind:
        errorText === "net::ERR_ABORTED"
          ? "request-aborted"
          : "request-failed",
      method: request.method(),
      url: request.url(),
      errorText,
    });
  });

  page.on("response", (response) => {
    if (isTrackedHttpStatus(response.status())) {
      events.push({
        kind: "http-error",
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
      });
    }
  });
}

async function attachDiagnostics(
  testInfo: TestInfo,
  events: QaDiagnosticEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await testInfo.attach("qa-browser-diagnostics", {
    body: Buffer.from(JSON.stringify(events, null, 2)),
    contentType: "application/json",
  });
}

export const test = base.extend<QaFixtures>({
  qaEvents: async ({ page }, provide, testInfo) => {
    const events: QaDiagnosticEvent[] = [];
    installDiagnostics(page, events);

    await provide(events);
    await attachDiagnostics(testInfo, events);
  },
});

export function unexpectedDiagnostics(
  events: readonly QaDiagnosticEvent[],
  allowed: (event: QaDiagnosticEvent) => boolean = () => false,
): QaDiagnosticEvent[] {
  return events.filter(
    (event) =>
      event.kind !== "request-aborted" &&
      !allowed(event),
  );
}

export { expect };
