"use client";

import { ImageUploadDropZone } from "@/components/ui/image-upload-drop-zone";
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
  function validateFile(candidate: File): string | null {
    const validation = validateUploadCandidate(candidate, "productImage");
    if (validation.ok) return null;
    return validation.reason === "UNSUPPORTED_TYPE"
      ? "รองรับเฉพาะรูป JPEG, PNG และ WebP"
      : "รูปสินค้าต้องมีขนาดไม่เกิน 5 MiB";
  }

  return (
    <div className={styles.field}>
      <div className={styles.heading}>
        <span id={id + "-label"}>รูปสินค้า (ไม่บังคับ)</span>
        <small>JPEG, PNG หรือ WebP · ไม่เกิน 5 MiB</small>
      </div>
      <ImageUploadDropZone
        id={id}
        ariaLabelledBy={id + "-label"}
        file={file}
        alt="ตัวอย่างรูปสินค้าที่เลือก"
        disabled={disabled}
        error={error}
        onFileChange={onFileChange}
        onError={onError}
        validateFile={validateFile}
      />
      {error ? <p role="alert" id={id + "-error"} className={styles.error}>{error}</p> : null}
      {file ? (
        <button type="button" className={styles.clear} disabled={disabled}
          onClick={() => { onFileChange(null); onError(""); }}>
          ยกเลิกไฟล์ที่เลือก
        </button>
      ) : null}
    </div>
  );
}
