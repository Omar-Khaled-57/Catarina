/** A loose file sitting directly in a drawer, outside every envelope. */

"use client";

import { Download, FileCode2, FileText, ImageIcon, Link2, Video } from "lucide-react";
import type { DirItem } from "./types";
import { downloadItem } from "@/lib/download";

export default function LooseFile({ file, index }: { file: DirItem; index: number }) {
  const isMedia = file.type === "IMAGE" || file.type === "VIDEO";
  const preview = file.content?.startsWith("/") || file.content?.startsWith("http");

  return (
    <div
      className={`drawer-file drawer-file--${file.type.toLowerCase()}`}
      style={{ "--file-index": index } as React.CSSProperties}
    >
      {isMedia ? (
        <span className="drawer-file__thumbnail">
          {preview && file.type === "IMAGE" ? (
            // Demo content may contain an image URL; otherwise a clear media placeholder is shown.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.content} alt="" />
          ) : file.type === "VIDEO" ? (
            <Video size={22} aria-hidden="true" />
          ) : (
            <ImageIcon size={22} aria-hidden="true" />
          )}
        </span>
      ) : file.type === "LINK" ? (
        <span className="drawer-file__link-icon"><Link2 size={20} aria-hidden="true" /></span>
      ) : (
        <span className="drawer-file__text-preview">
          <FileCode2 size={13} aria-hidden="true" />
          {(file.content ?? file.name).slice(0, 38)}
        </span>
      )}
      <span className="drawer-file__name">{file.name}</span>
      {!isMedia && file.type !== "LINK" && <FileText size={10} aria-hidden="true" />}
      <button type="button" className="drawer-file__download" onClick={() => downloadItem(file)} aria-label={`Download ${file.name}`} title={`Download ${file.name}`}>
        <Download size={11} />
      </button>
    </div>
  );
}
