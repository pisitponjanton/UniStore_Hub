"use client";

import { useEffect, useMemo } from "react";
import { ResilientImage } from "@/components/ui/resilient-image";
import type { StoreDTO } from "@/types";
import { validateStoreImageFile } from "./store-image-upload";
import styles from "./store-cover-field.module.css";

export function StoreCoverField({
  id, store, file, onFileChange, disabled = false, error, onError,
}: {
  id: string;
  store?: StoreDTO | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  error?: string;
  onError: (message: string) => void;
}) {
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className={styles.wrapper}>
    <div className={styles.heading}>
      <label htmlFor={id}>รูปหน้าร้าน</label>
      <span>JPG, PNG, WebP · ไม่เกิน 5 MiB</span>
    </div>
    <div className={styles.preview}>
      <ResilientImage
        src={preview || store?.imageUrl}
        alt={store ? `รูปหน้าร้าน ${store.name}` : "ตัวอย่างรูปหน้าร้าน"}
        className={styles.image}
        fallback={<span className={styles.fallback}>ยังไม่มีรูปหน้าร้าน</span>}
      />
    </div>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp"
      disabled={disabled} className={styles.input}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? id + "-error" : undefined}
      onChange={event => {
        const next = event.target.files?.[0] ?? null;
        if (next) {
          try { validateStoreImageFile(next); onError(""); onFileChange(next); }
          catch (e) { onError(e instanceof Error ? e.message : "รูปไม่ถูกต้อง"); onFileChange(null); event.target.value = ""; }
        } else { onFileChange(null); onError(""); }
      }}
    />
    {error ? <p role="alert" id={id+"-error"} className={styles.error}>{error}</p> : null}
    {file ? <p className={styles.filename}>ไฟล์ที่เลือก: {file.name}</p> : null}
  </div>;
}
