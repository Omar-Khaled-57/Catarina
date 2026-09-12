/** A loose file sitting directly in a drawer, outside every envelope. */

"use client";

import { Download, FileCode2, FileText, ImageIcon, Link2, Video } from "lucide-react";
import type { DirItem } from "./types";
import { downloadItem } from "@/lib/download";

export default function LooseFile({
  file,
  index,
  onOpenInFocus,
}: {
  file: DirItem;
  index: number;
  onOpenInFocus: () => void;
}) {
  const isMedia = file.type === "IMAGE" || file.type === "VIDEO";
  const preview = file.content?.startsWith("/") || file.content?.startsWith("http");
  const FileIcon =
    file.type === "IMAGE"
      ? ImageIcon
      : file.type === "VIDEO"
        ? Video
        : file.type === "LINK"
          ? Link2
          : file.type === "CODE"
            ? FileCode2
            : FileText;

  return (
    <div
      className={`drawer-file drawer-file--${file.type.toLowerCase()}`}
      style={{ "--file-index": index } as React.CSSProperties}
      role="button"
      tabIndex={0}
      onClick={onOpenInFocus}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenInFocus();
        }
      }}
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
      ) : (
        <span className="drawer-file__text-preview">
          <FileIcon size={18} aria-hidden="true" />
          <span className="drawer-file__main-name">{file.name}</span>
          {file.type !== "LINK" && (
            <span className="drawer-file__snippet">
              {(file.content ?? "No preview yet").slice(0, 32)}
            </span>
          )}
        </span>
      )}
      {isMedia && (
        <span className="drawer-file__header">
          <FileIcon size={12} aria-hidden="true" />
          <span>{file.name}</span>
        </span>
      )}
      <button type="button" className="drawer-file__download" onClick={(event) => { event.stopPropagation(); downloadItem(file); }} aria-label={`Download ${file.name}`} title={`Download ${file.name}`}>
        <Download size={11} />
      </button>
    </div>
  );
}
