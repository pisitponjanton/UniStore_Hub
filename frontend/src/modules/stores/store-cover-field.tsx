"use client";

import type { StoreDTO } from "@/types";
import { ImageUploadDropZone } from "@/components/ui/image-upload-drop-zone";
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
  function validateFile(candidate: File): string | null {
    try {
      validateStoreImageFile(candidate);
      return null;
    } catch (reason) {
      return reason instanceof Error ? reason.message : "รูปไม่ถูกต้อง";
    }
  }

  return (
    <div className={styles.wrapper}>
      <ImageUploadDropZone
        id={id}
        ariaLabel="เลือกรูปหน้าร้าน"
        file={file}
        imageUrl={store?.imageUrl}
        alt={file ? "ตัวอย่างรูปหน้าร้านที่เลือก" : `รูปหน้าร้าน ${store?.name ?? ""}`}
        disabled={disabled}
        error={error}
        onError={onError}
        onFileChange={onFileChange}
        validateFile={validateFile}
        emptyText={store?.imageKey ? "หรือวางรูปใหม่ลงในพื้นที่นี้" : "หรือวางรูปภาพลงในพื้นที่นี้"}
      />
      {error ? <p role="alert" id={id + "-error"} className={styles.error}>{error}</p> : null}
    </div>
  );
}
