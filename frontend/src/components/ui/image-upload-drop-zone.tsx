"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { ResilientImage } from "./resilient-image";
import styles from "./image-upload-drop-zone.module.css";

/** The same 16:9 uploader is used when creating products and creating/editing stores. */
export function ImageUploadDropZone({
  id, file, imageUrl, alt, disabled = false, error, onError, onFileChange, validateFile,
  ariaLabel, ariaLabelledBy, emptyText = "หรือวางรูปภาพลงในพื้นที่นี้",
}: {
  id: string;
  file: File | null;
  imageUrl?: string | null;
  alt: string;
  disabled?: boolean;
  error?: string;
  onError: (message: string) => void;
  onFileChange: (file: File | null) => void;
  validateFile: (file: File) => string | null;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  emptyText?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const imageSource = file ? previewUrl : imageUrl;
  const hasImage = Boolean(imageSource);

  function selectFile(candidate: File | null) {
    if (!candidate) {
      onFileChange(null);
      onError("");
      return;
    }
    const message = validateFile(candidate);
    if (message) {
      onFileChange(null);
      onError(message);
      return;
    }
    onError("");
    onFileChange(candidate);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
    // Permit reselecting the same file after clearing it or encountering an error.
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <label
      className={styles.dropZone}
      data-dragging={dragging ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      data-has-image={hasImage ? "true" : undefined}
      onDragEnter={event => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={event => {
        event.preventDefault();
        if (!disabled) {
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }
      }}
      onDragLeave={event => {
        event.preventDefault();
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        id={id}
        className={styles.input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + "-error" : undefined}
        disabled={disabled}
        onChange={onInputChange}
      />
      {hasImage ? (
        <>
          <ResilientImage
            src={imageSource}
            alt={alt}
            className={styles.previewImage}
            loading="eager"
            fallback={<span className={styles.emptyState}>ไม่สามารถแสดงรูปภาพได้ กรุณาเลือกไฟล์ใหม่</span>}
          />
          <span className={styles.previewCaption}>
            <span className={styles.primary}>
              <Upload size={15} aria-hidden="true" />
              เปลี่ยนรูปภาพ
            </span>
            {file ? <span className={styles.secondary}>เลือกแล้ว: {file.name}</span> : null}
          </span>
        </>
      ) : (
        <span className={styles.emptyState}>
          <span className={styles.primary}>
            <Upload size={15} aria-hidden="true" />
            เลือกไฟล์รูปภาพ
          </span>
          <span className={styles.secondary}>{emptyText}</span>
        </span>
      )}
    </label>
  );
}
