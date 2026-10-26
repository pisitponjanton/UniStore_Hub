"use client";

import { useState, type ReactNode } from "react";

/**
 * Render images only when the supplied URL loads.
 * Short-lived S3 URLs may expire or the original object may have been removed;
 * always retain a meaningful, dimensionally stable fallback.
 */
export function ResilientImage({
  src,
  alt,
  className,
  fallback,
  loading = "lazy",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading?: "eager" | "lazy";
}) {
  return <ImageForSource key={src ?? "no-image"} src={src} alt={alt} className={className}
    loading={loading} fallback={fallback} />;
}

function ImageForSource({
  src,
  alt,
  className,
  fallback,
  loading,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  // S3 signed URLs and local object URLs do not go through Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={alt} loading={loading}
    decoding="async" onError={() => setFailed(true)} />;
}
