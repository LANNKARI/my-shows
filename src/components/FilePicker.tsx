"use client";
import { useId, useRef, useState } from "react";
export default function FilePicker({ accept, label, inputLabel = label, disabled = false, onFile }: { accept: string; label: string; inputLabel?: string; disabled?: boolean; onFile: (file: File) => void | Promise<void> }) {
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  return <div className="file-picker">
    <input id={id} ref={input} type="file" accept={accept} disabled={disabled} hidden aria-label={inputLabel} onChange={event => {
      const file = event.target.files?.[0]; if (!file) return;
      setFilename(file.name); void onFile(file); event.target.value = "";
    }} />
    <button type="button" className="file-picker-button" disabled={disabled} aria-controls={id} onClick={() => input.current?.click()}>{label}</button>
    <span className="file-picker-name" aria-live="polite">{filename || "Файл не выбран"}</span>
  </div>;
}
