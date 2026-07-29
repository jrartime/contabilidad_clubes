"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export function FileDropUpload({
  action,
  clubId,
  contabilidadId,
  redirectTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clubId: number;
  contabilidadId: number;
  redirectTo: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  function syncFiles(fileList: FileList | null) {
    setFiles(Array.from(fileList ?? []).map((file) => file.name));
  }

  function receiveDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!inputRef.current || event.dataTransfer.files.length === 0) return;
    inputRef.current.files = event.dataTransfer.files;
    syncFiles(event.dataTransfer.files);
  }

  return (
    <form action={action} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="club_id" value={clubId} />
      <input type="hidden" name="contabilidad_id" value={contabilidadId} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={receiveDrop}
        style={{
          minHeight: 110,
          border: `2px dashed ${dragging ? "var(--primary)" : "#b8c2cc"}`,
          borderRadius: 10,
          background: dragging ? "#eff6ff" : "#fafafa",
          display: "grid",
          placeItems: "center",
          alignContent: "center",
          gap: 6,
          padding: 16,
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 120ms ease, background 120ms ease",
        }}
      >
        <Icon name="upload" />
        <strong>Arrastra aquí los documentos</strong>
        <span style={{ fontSize: 12, opacity: 0.72 }}>
          o pulsa para seleccionarlos · PDF, JPG o PNG · máximo 1 MB por archivo
        </span>
        <input
          ref={inputRef}
          type="file"
          name="documentos"
          multiple
          required
          accept="application/pdf,image/jpeg,image/png"
          onChange={(event) => syncFiles(event.currentTarget.files)}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        />
      </label>
      {files.length > 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {files.length === 1 ? files[0] : `${files.length} archivos seleccionados`}
        </div>
      ) : null}
      <button type="submit" className="app-action-link" style={{ justifySelf: "start" }}>
        <Icon name="upload" />
        Subir documentos
      </button>
    </form>
  );
}
