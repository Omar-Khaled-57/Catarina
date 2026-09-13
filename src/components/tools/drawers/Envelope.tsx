/** Physical envelope and its interactive file tray. */

"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, FileText } from "lucide-react";
import type { DirItem, EnvelopeData } from "./types";
import { downloadItem } from "@/lib/download";

const NOTICE_MS = 2600;

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
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const files = envelope.items ?? [];

  const clearNotice = () => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    setNotice(null);
  };

  const showNotice = (msg: string) => {
    clearNotice();
    setNotice(msg);
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null;
      setNotice(null);
    }, NOTICE_MS);
  };

  /* Clear the notice timer on unmount to avoid a setState-after-unmount */
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

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
    clearNotice();
  };

  const handleFile = async (file: DirItem) => {
    if (file.type === "CODE") {
      try {
        await navigator.clipboard.writeText(file.content ?? file.name);
        showNotice(`Copied ${file.name}`);
      } catch {
        showNotice(`Copy ${file.name} from the browser`);
      }
      return;
    }
    if (file.type === "LINK" && file.content?.startsWith("http")) {
      window.open(file.content, "_blank", "noopener,noreferrer");
      return;
    }
    showNotice(`Opened ${file.name}`);
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
