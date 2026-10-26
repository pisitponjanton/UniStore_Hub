"use client";

import { useEffect, useMemo } from "react";
import { ResilientImage } from "@/components/ui/resilient-image";
import { validateUploadCandidate } from "@/utils";
import styles from "./product-create-image-field.module.css";

export function ProductCreateImageField({
  id, file, disabled = false, error, onFileChange, onError,
}: {
  id: string;
  file: File | null;
  disabled?: boolean;
  error?: string;
  onFileChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const preview = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return <div className={styles.field}>
    <div className={styles.heading}>
      <span id={id + "-label"}>รูปสินค้า (ไม่บังคับ)</span>
      <small>JPEG, PNG หรือ WebP · ไม่เกิน 5 MiB</small>
    </div>
    <div className={styles.picker}>
      <div className={styles.preview}>
        <ResilientImage src={preview} alt="ตัวอย่างรูปสินค้าที่เลือก"
          className={styles.image}
          fallback={<span className={styles.fallback}>ยังไม่มีรูปสินค้า</span>}/>
      </div>
      <div className={styles.details}>
        <label htmlFor={id} className={styles.choose}>เลือกรูปสินค้า
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp"
            aria-labelledby={id + "-label"}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? id + "-error" : undefined}
            disabled={disabled} className={styles.input}
            onChange={event => {
              const selected = event.target.files?.[0] ?? null;
              if (!selected) {
                onFileChange(null); onError(""); return;
              }
              const validation = validateUploadCandidate(selected, "productImage");
              if (!validation.ok) {
                onFileChange(null);
                onError(validation.reason === "UNSUPPORTED_TYPE"
                  ? "รองรับเฉพาะรูป JPEG, PNG และ WebP"
                  : "รูปสินค้าต้องมีขนาดไม่เกิน 5 MiB");
                event.target.value = "";
                return;
              }
              onError("");
              onFileChange(selected);
            }}
          />
        </label>
        <p className={styles.detailsText}>{file ? file.name : "เลือกไฟล์เพื่อแนบไปพร้อมการสร้างสินค้า"}</p>
        {file ? <button type="button" className={styles.clear} disabled={disabled}
          onClick={() => { onFileChange(null); onError(""); }}>ยกเลิกไฟล์ที่เลือก</button> : null}
      </div>
    </div>
    {error ? <p role="alert" id={id + "-error"} className={styles.error}>{error}</p> : null}
  </div>;
}
