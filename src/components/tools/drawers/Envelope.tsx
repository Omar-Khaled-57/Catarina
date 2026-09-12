/** Physical envelope and its interactive file tray. */

"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, FileText } from "lucide-react";
import type { DirItem, EnvelopeData } from "./types";
import { downloadItem } from "@/lib/download";

export default function Envelope({
  envelope,
  index,
  raised,
  onRaise,
  onOpenInFocus,
}: {
  envelope: EnvelopeData;
  index: number;
  raised: boolean;
  onRaise: () => void;
  onOpenInFocus: (fileId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const files = envelope.items ?? [];

  const openEnvelope = () => {
    if (!raised) {
      onRaise();
      return;
    }
    if (isOpen) {
      setIsClosing(true);
      window.setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 180);
    } else {
      setIsOpen(true);
    }
    setNotice(null);
  };

  const handleFile = async (file: DirItem) => {
    if (file.type === "CODE") {
      try {
        await navigator.clipboard.writeText(file.content ?? file.name);
        setNotice(`Copied ${file.name}`);
      } catch {
        setNotice(`Copy ${file.name} from the browser`);
      }
      return;
    }
    if (file.type === "LINK" && file.content?.startsWith("http")) {
      window.open(file.content, "_blank", "noopener,noreferrer");
      return;
    }
    setNotice(`Opened ${file.name}`);
  };

  return (
    <div
      className={`envelope-slot${raised ? " is-raised" : ""}`}
      style={{ "--envelope-index": index } as React.CSSProperties}
    >
      <button
        type="button"
        className="envelope"
        onClick={openEnvelope}
        aria-expanded={isOpen}
        aria-label={`${envelope.name}${raised ? " — open files" : " — raise"}`}
      >
        <span className="envelope__label">{envelope.name}</span>
        <span className="envelope__meta">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
      </button>
      {isOpen && (
        <div
          className={`envelope__files${isClosing ? " is-closing" : ""}`}
          aria-label={`${envelope.name} files`}
        >
          {files.length === 0 ? (
            <span className="envelope__empty">No files yet</span>
          ) : (
            files.map((file) => {
              const copies = file.type === "CODE";
              return (
                <div key={file.id} className="envelope__file">
                  <button type="button" className="envelope__file-open" onClick={() => void handleFile(file)} title={copies ? `Copy ${file.name}` : `Open ${file.name}`}>
                    <FileText size={11} aria-hidden="true" />
                    <span>{file.name}</span>
                    {copies && <Copy size={10} />}
                  </button>
                  <button type="button" className="envelope__file-focus" onClick={() => onOpenInFocus(file.id)} aria-label={`Open ${file.name} in focus mode`} title="Open in focus mode">
                    <ExternalLink size={10} />
                  </button>
                  <button type="button" className="envelope__file-download" onClick={() => downloadItem(file)} aria-label={`Download ${file.name}`} title={`Download ${file.name}`}>
                    <Download size={10} />
                  </button>
                </div>
              );
            })
          )}
          {notice && <span className="envelope__notice">{notice}</span>}
        </div>
      )}
    </div>
  );
}
