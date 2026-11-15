import { Upload } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { Button } from "./ui";

export function Dropzone({
  onFiles,
  busy = false,
  compact = false,
  title = "Drop images to begin",
  hint = "Add one or many images. Everything stays on this device.",
}: {
  onFiles: (files: FileList | File[]) => void;
  busy?: boolean;
  compact?: boolean;
  title?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) onFiles(event.dataTransfer.files);
  };

  return (
    <div
      className="dropzone"
      data-dragging={dragging}
      data-compact={compact || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        aria-label="Choose image files"
        multiple
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="dropzone__icon" aria-hidden="true">
        <Upload size={compact ? 22 : 30} strokeWidth={1.6} />
      </div>
      <div>
        <div className="dropzone__title">{title}</div>
        <div className="dropzone__hint">{hint}</div>
        <div className="field__hint">You can also paste an image with Ctrl/Cmd+V.</div>
      </div>
      <Button variant="primary" loading={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Importing…" : "Choose images"}
      </Button>
      <p className="field__hint mono">JPEG · PNG · WebP · AVIF</p>
    </div>
  );
}
