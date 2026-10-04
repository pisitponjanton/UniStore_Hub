"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import {
  Button,
  ErrorState,
  ForbiddenState,
  LoadingState,
  UnauthorizedState,
} from "@/components";
import type { MembershipRole } from "@/types";

import {
  classifyApiAccessFailure,
  isDefinitiveSessionFailure,
  resolveOrganizationAccess,
} from "./access";
import { authSession } from "./session";
import { useAuthSession } from "./use-auth-session";
import { useCurrentLoginHref } from "./use-auth-navigation-context";

function LoginAction() {
  const href = useCurrentLoginHref();

  return (
    <Link href={href}>
      <Button>เข้าสู่ระบบ</Button>
    </Link>
  );
}

export function AuthenticatedBoundary({
  requestError,
  children,
}: {
  requestError?: unknown;
  children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiFailure = classifyApiAccessFailure(requestError);

  useEffect(() => {
    if (isDefinitiveSessionFailure(requestError)) {
      authSession.logout();
    }
  }, [requestError]);

  if (apiFailure === "forbidden") {
    return <ForbiddenState headingLevel={1} />;
  }

  if (apiFailure === "unauthorized") {
    return (
      <UnauthorizedState
        headingLevel={1}
        actions={<LoginAction />}
      />
    );
  }

  if (auth.status === "loading") {
    return (
      <LoadingState
        headingLevel={1}
        title="กำลังตรวจสอบบัญชี"
        description="กำลังตรวจสอบ Session ก่อนเปิดหน้านี้"
      />
    );
  }

  if (auth.status === "anonymous") {
    return (
      <UnauthorizedState
        headingLevel={1}
        actions={<LoginAction />}
      />
    );
  }

  return children;
}

export function OrganizationBoundary({
  organizationId,
  allowedRoles,
  requestError,
  children,
}: {
  organizationId: string | null | undefined;
  allowedRoles?: readonly MembershipRole[];
  requestError?: unknown;
  children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiFailure = classifyApiAccessFailure(requestError);

  useEffect(() => {
    if (isDefinitiveSessionFailure(requestError)) {
      authSession.logout();
    }
  }, [requestError]);

  if (apiFailure === "forbidden") {
    return <ForbiddenState headingLevel={1} />;
  }

  if (apiFailure === "unauthorized") {
    return (
      <UnauthorizedState
        headingLevel={1}
        actions={<LoginAction />}
      />
    );
  }

  if (auth.status === "loading") {
    return (
      <LoadingState
        headingLevel={1}
        title="กำลังตรวจสอบสิทธิ์ของหน่วยงาน"
      />
    );
  }

  if (auth.status === "anonymous") {
    return (
      <UnauthorizedState
        headingLevel={1}
        actions={<LoginAction />}
      />
    );
  }

  const access = resolveOrganizationAccess(
    auth,
    organizationId,
    allowedRoles,
  );

  if (access.status === "missing") {
    return (
      <ErrorState
        headingLevel={1}
        title="ลิงก์ไม่สมบูรณ์"
        description="ไม่พบ organizationId ที่จำเป็นสำหรับหน้านี้"
        actions={
          <Link href="/org/select/">
            <Button variant="secondary">เลือกหน่วยงาน</Button>
          </Link>
        }
      />
    );
  }

  if (access.status === "forbidden") {
    return <ForbiddenState headingLevel={1} />;
  }

  return children;
}

export function PlatformAdminBoundary({
  requestError,
  children,
}: {
  requestError?: unknown;
  children: ReactNode;
}) {
  const auth = useAuthSession();
  const apiFailure = classifyApiAccessFailure(requestError);

  useEffect(() => {
    if (isDefinitiveSessionFailure(requestError)) {
      authSession.logout();
    }
  }, [requestError]);

  if (apiFailure === "forbidden") {
    return <ForbiddenState headingLevel={1} />;
  }

  if (apiFailure === "unauthorized") {
    return (
      <UnauthorizedState
        headingLevel={1}
        actions={<LoginAction />}
      />
    );
  }

  if (auth.status === "loading") {
    return (
      <LoadingState
        headingLevel={1}
        title="กำลังตรวจสอบสิทธิ์ Platform Admin"
      />
    );
  }

  if (auth.status === "anonymous") {
    return (
      <UnauthorizedState
        headingLevel={1}
        actions={<LoginAction />}
      />
    );
  }

  if (auth.user.platformRole !== "PLATFORM_ADMIN") {
    return <ForbiddenState headingLevel={1} />;
  }

  return children;
}
