"use client";

/**
 * DirectoryBrowser — the right-hand panel in chest focus mode. Browses a
 * section as: drawers (projects) → envelopes (children) + files (items).
 * In focus mode everything can be opened, edited and made fresh:
 *   - drawers can be added, renamed and deleted
 *   - envelopes can be added, renamed, and opened to see their files
 *   - files can be added (via a rich creation dialog), opened, and renamed
 *   - multiple loose files can be selected and grouped into an envelope
 * It stays two-way linked with the chest: opening a drawer shows its
 * directory here, and clicking a project's directory opens its drawer.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useThemeSafeGlyphColor } from "@/components/tools/drawers/useThemeSafeColor";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  File,
  Folder,
  Image,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import type {
  DemoProject,
  DemoSection,
  DirItem,
  EnvelopeData,
} from "./types";
import { downloadItem } from "@/lib/download";
import { useFocusTrap } from "./useFocusTrap";

const FILE_TYPES = ["CODE", "IMAGE", "FILE", "LINK", "NOTE", "VIDEO"] as const;
const FILE_TYPE_LABELS: Record<(typeof FILE_TYPES)[number], string> = {
  CODE: "Code",
  IMAGE: "Image",
  FILE: "File",
  LINK: "Link",
  NOTE: "Note",
  VIDEO: "Video",
};
const ITEM_ICONS: Record<DirItem["type"], LucideIcon> = {
  CODE: Code2,
  IMAGE: Image,
  FILE: File,
  LINK: Link2,
  NOTE: StickyNote,
  VIDEO: Video,
};

const isPreviewableUrl = (value: string) =>
  /^(blob:|https?:|data:)/i.test(value);

/**
 * Schemes that may be handed to a NAVIGATING sink — `window.open(...)` and an
 * `<a href target="_blank">`.
 *
 * `data:` is deliberately excluded even though it is a legitimate inline preview
 * source: a drawer item's content is written by any member of the section, so a
 * planted `data:text/html,…` would otherwise be navigable by a teammate who
 * clicks "Open externally". `isPreviewableUrl` still permits `data:` for
 * media, where the URL only ever reaches an `<img>`/`<video>` src and cannot
 * execute script.
 */
const isNavigableUrl = (value: string) => /^(blob:|https?:)/i.test(value);

const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".log",
];
const CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".css",
  ".html",
  ".htm",
  ".svg",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".php",
  ".sh",
  ".bash",
  ".sql",
  ".graphql",
  ".proto",
  ".prisma",
];

/* Arabic ⇄ English search normalization.
 *
 * Startup: every string is folded so spelling variants never block a match:
 *  أ / إ / آ → ا, ة → ه, ى → ي, plus diacritics and tatweel are stripped.
 *
 * Layout-smart: if the user typed on the wrong keyboard layout (Arabic letters
 * for an English word, or English letters for an Arabic word), the letters are
 * remapped through the Arabic QWERTY layout so that "اخةث" matches "home"
 * (ا→h, خ→o, ة→m, ث→e). Both the query and every candidate get a folded form
 * plus a keyboard-translated form, and any cross-combination can match.
 */
const removeDiacritics = (s: string) =>
  s.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "");
const variantFold = (s: string) =>
  removeDiacritics(s.toLowerCase())
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A");

const EN_TO_AR: Record<string, string> = {
  q: "\u0636", w: "\u0635", e: "\u062B", r: "\u0642", t: "\u0641",
  y: "\u063A", u: "\u0639", i: "\u0647", o: "\u062E", p: "\u062D",
  "[": "\u062C", "]": "\u062F",
  a: "\u0634", s: "\u0633", d: "\u064A", f: "\u0628", g: "\u0644",
  h: "\u0627", j: "\u062A", k: "\u0646", l: "\u0645", ";": "\u0643",
  "'": "\u0637",
  z: "\u0626", x: "\u0621", c: "\u0624", v: "\u0631", n: "\u0649",
  m: "\u0629", ",": "\u0648", ".": "\u0632", "/": "\u0638",
};
const AR_TO_EN: Record<string, string> = {
  "\u0636": "q", "\u0635": "w", "\u062B": "e", "\u0642": "r", "\u0641": "t",
  "\u063A": "y", "\u0639": "u", "\u0647": "i", "\u062E": "o", "\u062D": "p",
  "\u062C": "[", "\u062F": "]",
  "\u0634": "a", "\u0633": "s", "\u064A": "d", "\u0628": "f", "\u0644": "g",
  "\u0627": "h", "\u062A": "j", "\u0646": "k", "\u0645": "l", "\u0643": ";",
  "\u0637": "'",
  "\u0626": "z", "\u0621": "x", "\u0624": "c", "\u0631": "v", "\u0649": "n",
  "\u0629": "m", "\u0648": ",", "\u0632": ".", "\u0638": "/",
};

const toKeys = (s: string) => {
  let out = "";
  for (const ch of s) {
    out += AR_TO_EN[ch] ?? EN_TO_AR[ch] ?? ch;
  }
  return out;
};

const formsOf = (s: string) => {
  const base = removeDiacritics(s.toLowerCase());
  return [variantFold(base), variantFold(toKeys(base))];
};

const matchesQuery = (text: string, query: string) => {
  if (!query) return false;
  const [qf0, qf1] = formsOf(query);
  return formsOf(text).some(
    (hay) => (qf0 && hay.includes(qf0)) || (qf1 && hay.includes(qf1)),
  );
};

interface SearchHits {
  projects: DemoProject[];
  envelopes: { project: DemoProject; envelope: EnvelopeData }[];
  files: { project: DemoProject; envelope: EnvelopeData | null; file: DirItem }[];
}

function searchSection(section: DemoSection, query: string): SearchHits {
  const hits: SearchHits = {
    projects: [],
    envelopes: [],
    files: [],
  };
  if (!query) return hits;
  for (const project of section.projects) {
    if (matchesQuery(project.name, query)) hits.projects.push(project);
    for (const envelope of project.envelopes) {
      if (matchesQuery(envelope.name, query))
        hits.envelopes.push({ project, envelope });
      for (const file of envelope.items ?? []) {
        const hay = `${file.name} ${FILE_TYPE_LABELS[file.type]}`;
        if (matchesQuery(hay, query))
          hits.files.push({ project, envelope, file });
      }
    }
    for (const file of project.items ?? []) {
      const hay = `${file.name} ${FILE_TYPE_LABELS[file.type]}`;
      if (matchesQuery(hay, query)) hits.files.push({ project, envelope: null, file });
    }
  }
  return hits;
}

function Row({
  icon: Icon,
  label,
  meta,
  color,
  active = false,
  onClick,
  actions,
  trailing,
  checked,
  onCheck,
}: {
  icon: LucideIcon;
  label: string;
  meta?: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
  actions?: React.ReactNode;
  trailing?: React.ReactNode;
  checked?: boolean;
  onCheck?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-out ${
        active ? "bg-accent/10" : "hover:bg-accent/10"
      } ${checked ? "bg-accent/10" : ""}`}
    >
      {onClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="sr-only focus:not-sr-only focus:absolute focus:inset-0 focus:z-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          aria-label={`Open ${label}`}
        />
      )}
      {typeof checked === "boolean" && (
        <button
          type="button"
          role="checkbox"
          aria-checked={!!checked}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCheck?.();
          }}
          className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
            checked
              ? "border-accent bg-accent text-accent-ink"
              : "border-text-muted hover:border-accent"
          }`}
          aria-label={checked ? "Deselect" : "Select"}
        >
          {checked && <Check className="size-3" />}
        </button>
      )}
      <Icon
        className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:scale-110"
        style={{ color }}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
        {label}
      </span>
      {meta && (
        <span className="hidden shrink-0 text-xs text-text-muted min-[400px]:inline">{meta}</span>
      )}
      {actions && (
        <span className="-translate-x-1 shrink-0 opacity-100 transition-[transform,opacity] duration-200 ease-out sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-x-0 sm:group-focus-within:opacity-100">
          <span className="flex items-center gap-1"> {actions}</span>
        </span>
      )}
      {trailing && <span className="shrink-0">{trailing}</span>}
      <ChevronRight className="size-3.5 shrink-0 text-text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </div>
  );
}

function Crumb({
  onClick,
  children,
  strong = false,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  strong?: boolean;
}) {
  const inner = (
    <span
      className={`truncate ${
        strong
          ? "font-semibold text-text"
          : "text-text-muted transition-colors hover:text-text"
      }`}
    >
      {children}
    </span>
  );
  if (!onClick) return inner;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {inner}
    </button>
  );
}

function CopyButton({
  value,
  disabled = false,
  className = "",
}: {
  value: string;
  disabled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    if (disabled || !value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch {
        return;
      }
    }
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      aria-label="Copy content"
      disabled={disabled}
      onClick={copy}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium transition-colors ${
        disabled
          ? "pointer-events-none border-transparent bg-transparent text-text-muted/60"
          : "bg-surface text-text-muted hover:border-accent/40 hover:text-accent"
      } ${className}`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Resolve a stored content string to something renderable. `file://<id>`
 *  references are fetched (bas64-free, raw bytes) and turned into an object
 *  URL; plain data:/blob:/https: content passes through unchanged. The object
 *  URL is revoked when the content changes or the component unmounts. */
function useResolvedSource(content: string | undefined): {
  url: string;
  loading: boolean;
} {
  const ref = useMemo(
    () => (content && content.startsWith("file://") ? content.slice(7) : null),
    [content],
  );
  const [meta, setMeta] = useState<{ ref: string | null; url: string }>({
    ref: null,
    url: "",
  });

  useEffect(() => {
    if (!ref) return;
    let active = true;
    fetch(`/api/drawers/files/${encodeURIComponent(ref)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const created = URL.createObjectURL(blob);
        setMeta((prev) => (prev.ref === ref ? prev : { ref, url: created }));
      })
      .catch(() => {
        if (!active) return;
        setMeta((prev) => (prev.ref === ref ? prev : { ref, url: "" }));
      });
    return () => {
      active = false;
      /* Revoke this effect's object URL once its fetch result is stored (or if
         the component unmounts / the ref changes before it resolves). */
      setMeta((prev) => {
        if (prev.ref === ref && prev.url) {
          URL.revokeObjectURL(prev.url);
          return { ref, url: "" };
        }
        return prev;
      });
    };
  }, [ref]);

  /* Until the fetch for the CURRENT ref settles, meta still refers to the
     previous ref — so show a loader and an empty source. Plain (non-ref)
     content always passes through — refs never touch it. */
  if (ref === null) return { url: content ?? "", loading: false };
  return { url: meta.ref === ref ? meta.url : "", loading: meta.ref !== ref };
}

function FileDetail({
  file,
  color,
  onRename,
  onUpdateContent,
  onDone,
}: {
  file: DirItem;
  color: string;
  onRename: (name: string) => void;
  onUpdateContent: (content: string) => void;
  onDone: () => void;
}) {
  const ItemIcon = ITEM_ICONS[file.type];
  const [value, setValue] = useState(file.name);
  const [draft, setDraft] = useState(file.content ?? "");

  const commitName = () => onRename(value.trim() || file.name);
  const commitContent = () => onUpdateContent(draft);

  const rawContent = file.content ?? "";
  const { url, loading: urlLoading } = useResolvedSource(rawContent);
  const isRef = rawContent.startsWith("file://");
  const hasRefUrl = isRef && !!url;
  const isMedia =
    (file.type === "IMAGE" || file.type === "VIDEO") &&
    !!rawContent &&
    (isRef ? hasRefUrl : isPreviewableUrl(rawContent));
  const showsImagePreview = file.type === "IMAGE";
  /* Only ever navigate to a scheme we trust; see isNavigableUrl. */
  const isNavigable = !isRef && isNavigableUrl(rawContent);
  const isLink = file.type === "LINK" && !!rawContent && isNavigable;
  const canOpenExternally =
    file.type !== "CODE" &&
    file.type !== "NOTE" &&
    file.type !== "FILE" &&
    !!rawContent &&
    isNavigable;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-accent/10">
          <ItemIcon className="size-5" style={{ color }} />
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              commitName();
              if (!isRef) commitContent(); /* mirror the Done button — Enter must not drop textarea edits */
              onDone();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onDone();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text focus:border-accent focus:outline-2 focus:outline-accent"
          aria-label="File name"
        />
        <button
          type="button"
          onClick={() => downloadItem(file)}
          aria-label={`Download ${file.name}`}
          title={`Download ${file.name}`}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Download className="size-3.5" />
        </button>
        {canOpenExternally && (
          <button
            type="button"
            onClick={() => window.open(url ?? "", "_blank", "noopener,noreferrer")}
            aria-label="Open externally"
            title="Open externally"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ExternalLink className="size-3.5" />
          </button>
        )}
        <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
          {file.type.toLowerCase()}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        {isMedia || showsImagePreview ? (
          <div className="flex h-full min-h-0 w-full items-center justify-center">
            {urlLoading ? (
              <div className="flex flex-col items-center gap-2 text-xs text-text-muted">
                <Loader2 className="size-5 animate-spin" />
                Loading the file…
              </div>
            ) : showsImagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob/data URLs need a plain <img>
              <img
                src={isMedia ? url : "/media/banner.png"}
                alt={file.name}
                className="max-h-64 max-w-full rounded-lg border border-border object-contain shadow-lg shadow-black/20"
              />
            ) : (
              <video
                src={url}
                controls
                playsInline
                className="max-h-40 w-full max-w-full rounded-lg border border-border bg-black shadow-lg shadow-black/20"
              />
            )}
          </div>
        ) : isLink ? (
          <div className="flex h-full flex-col gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{url}</span>
            </a>
            <CopyButton value={url} className="self-start" />
          </div>
        ) : isRef ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-accent/10">
              <File className="size-6 text-accent" />
            </div>
            <p className="text-sm font-medium text-text">
              Stored in the team cloud
            </p>
            <p className="max-w-md text-xs leading-relaxed text-text-muted">
              This file&apos;s bytes live in the shared workspace. Use the
              Download button in the header to get the original — its content
              isn&apos;t editable in place, and the name still can be changed
              above.
            </p>
            <p className="max-w-md text-xs leading-relaxed text-text-muted">
              Deleting it is permanent: the stored copy is purged from the
              cloud the moment you do, for everyone on the team, with no undo.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col text-left">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">
                Content
              </span>
              <div className="flex items-center gap-2">
                <CopyButton value={draft} disabled={!draft.trim()} />
              </div>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                file.type === "CODE"
                  ? "Paste or type code…"
                  : file.type === "LINK"
                    ? "Paste or type a URL…"
                    : "Add content…"
              }
              aria-label="File content"
              className="h-full min-h-0 w-full flex-1 resize-none rounded-lg border border-border bg-surface/70 p-3 font-mono text-xs leading-relaxed text-text/90 placeholder:text-text-muted focus:border-accent focus:outline-2 focus:outline-accent"
              onBlur={commitContent}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
          </div>
        )}
      </div>

      <footer className="mt-auto flex items-center justify-between border-t border-border px-5 py-2">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="size-3" />
          Back
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            commitName();
            if (!isRef) commitContent();
            onDone();
          }}
          className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Check className="size-3" />
          Done
        </button>
      </footer>
    </div>
  );
}

function EditorRow({
  icon: Icon,
  color,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  icon: LucideIcon;
  color: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2">
      <Icon className="size-4 shrink-0" style={{ color }} />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            onCommit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-accent/30 bg-surface px-2 py-1 text-sm text-text focus:outline-2 focus:outline-accent"
        aria-label="Rename"
      />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onCommit();
        }}
        onClick={onCommit}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-accent transition-colors hover:bg-accent/10"
        aria-label="Confirm"
      >
        <Check className="size-3.5" />
      </button>
    </div>
  );
}

function FileForm({
  existingCount,
  color,
  onCreate,
  onCancel,
}: {
  existingCount: number;
  color: string;
  onCreate: (item: Omit<DirItem, "id"> & { file?: File }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof FILE_TYPES)[number]>("FILE");
  const [content, setContent] = useState("");
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);

  const urlRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  /* Bumped on every file pick so a slow async text read can never overwrite a
     newer upload target. */
  const uploadGenRef = useRef(0);

  const revokePreview = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  useEffect(
    () => () => {
      if (!submittedRef.current) revokePreview();
    },
    [],
  );

  const TypeIcon = ITEM_ICONS[type];
  const defaultName = `file ${existingCount + 1}`;

  const handleUpload = (file: File | null) => {
    const gen = ++uploadGenRef.current;
    setUpload(file);
    if (!file) return;
    if (!name.trim()) setName(file.name);
    const lower = file.name.toLowerCase();
    const ext = lower.includes(".") ? `.${lower.split(".").pop() ?? ""}` : "";

    if (file.type.startsWith("image/")) {
      revokePreview();
      setType("IMAGE");
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setUploadUrl(url);
      setContent("");
    } else if (file.type.startsWith("video/")) {
      revokePreview();
      setType("VIDEO");
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      setUploadUrl(url);
      setContent("");
    } else if (
      file.type.startsWith("text/") ||
      TEXT_EXTENSIONS.includes(ext) ||
      CODE_EXTENSIONS.includes(ext)
    ) {
      revokePreview();
      setUploadUrl(null);
      setContent("");
      void file.text().then((text) => {
        /* A newer upload superseded this read — drop the stale result. */
        if (uploadGenRef.current !== gen) return;
        setContent(text);
        setType(CODE_EXTENSIONS.includes(ext) ? "CODE" : "FILE");
      });
    } else {
      revokePreview();
      setUploadUrl(null);
      setContent("");
      setType("FILE");
    }
  };

  /* When the user switches the type away from a media preview, the temporary
     blob URL becomes garbage — release it so the page doesn't hold it. */
  const switchType = (t: (typeof FILE_TYPES)[number]) => {
    if (type === t) return;
    if (
      uploadUrl &&
      (type === "IMAGE" || type === "VIDEO") &&
      t !== "IMAGE" &&
      t !== "VIDEO"
    ) {
      revokePreview();
      setUploadUrl(null);
    }
    setType(t);
  };

  const submit = () => {
    submittedRef.current = true;
    const finalName = name.trim() || defaultName;
    const contentValue =
      (type === "IMAGE" || type === "VIDEO") && uploadUrl
        ? uploadUrl
        : content
          ? content
          : undefined;
    onCreate({
      name: finalName,
      type,
      ...(contentValue ? { content: contentValue } : {}),
      ...(upload ? { file: upload } : {}),
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex w-full flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-2xl shadow-black/40 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl transition-colors duration-200"
          style={{ backgroundColor: `${color}22`, color }}
        >
          <TypeIcon className="size-5" />
        </div>
        <div className="min-w-0">
              <h2 id="new-file-title" className="text-sm font-bold text-text">New file</h2>
          <p className="text-xs text-text-muted">
            Everything is optional — sensible defaults kick in.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold tracking-wide text-text-muted uppercase">
          Name
        </span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultName}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted focus:border-accent focus:outline-2 focus:outline-accent"
        />
      </label>

      <div>
        <span className="mb-1 block text-[11px] font-semibold tracking-wide text-text-muted uppercase">
          Type
        </span>
        <div className="flex flex-wrap gap-1.5">
          {FILE_TYPES.map((t) => {
            const TIcon = ITEM_ICONS[t];
            const isActive = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ease-out ${
                  isActive
                    ? "scale-[1.03] border-accent bg-accent/10 text-accent shadow-sm"
                    : "border-border text-text-muted hover:border-accent/40 hover:text-text"
                }`}
              >
                <TIcon className="size-3.5" />
                {FILE_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          type === "LINK"
            ? "Paste a URL"
            : type === "CODE"
              ? "Paste some code…"
              : "Add a note or content (optional)"
        }
        aria-label="Content or URL"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted focus:border-accent focus:outline-2 focus:outline-accent"
      />

      <label className="grid cursor-pointer place-items-center gap-1 rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted transition-colors hover:border-accent/50 hover:text-text focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        <UploadCloud className="size-4" />
        <span className="font-medium text-text">
          Upload image, video or any file
        </span>
        <span>
          Saved into the team drawers — everyone sees updates
        </span>
        <input
          type="file"
          className="sr-only"
          onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
        />
      </label>

      {upload && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-accent/5 px-3 py-2 text-xs">
          <File className="size-3.5 shrink-0" style={{ color }} />
          <span className="min-w-0 flex-1 truncate font-medium text-text">
            {upload.name}
          </span>
          <span className="shrink-0 text-text-muted">
            {(upload.size / 1024).toFixed(1)} KB
          </span>
        </div>
      )}

      {uploadUrl && type === "IMAGE" && (
        <div className="overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
          <img
            src={uploadUrl}
            alt={upload?.name ?? "Preview"}
            className="max-h-32 w-full bg-black object-contain"
          />
        </div>
      )}
      {uploadUrl && type === "VIDEO" && (
        <video
          src={uploadUrl}
          controls
          playsInline
          className="max-h-32 w-full rounded-lg border border-border bg-black"
        />
      )}

      <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
        <span>Becomes:</span>
        <span className="max-w-[40%] truncate font-semibold text-text">
          {name.trim() || defaultName}
        </span>
        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent uppercase">
          {type.toLowerCase()}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.03] hover:brightness-110 active:scale-95"
        >
          <Plus className="size-3.5" />
          Create
        </button>
      </div>
    </form>
  );
}

type EditTarget =
  | { kind: "drawer"; id: string }
  | { kind: "envelope"; id: string }
  | { kind: "item"; envId: string | null; id: string };

function SearchResults({
  hits,
  color,
  onOpenResult,
  query,
}: {
  hits: SearchHits;
  color: string;
  onOpenResult: (
    projectId: string,
    envId: string | null,
    fileId: string | null,
  ) => void;
  query: string;
}) {
  const { projects, envelopes, files } = hits;
  const total = projects.length + envelopes.length + files.length;

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <Search className="size-6 text-text-muted/40" />
        <p className="text-sm text-text-muted">
          No matches for “{query.trim()}”
        </p>
        <p className="max-w-xs text-xs text-text-muted">
          Try an English or Arabic keyword — spelling variants count (ة≈ه, أ≈ا)
          and you can even type on the wrong keyboard layout (اخةث finds home).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between px-1 text-xs text-text-muted">
        <span>
          {total} {total === 1 ? "result" : "results"} for “{query.trim()}”
        </span>
        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent uppercase">
          EN / عربي
        </span>
      </div>

      {projects.length > 0 && (
        <div>
          <p className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
            Drawers
          </p>
          <div className="space-y-1">
            {projects.map((p) => (
              <Row
                key={p.id}
                icon={Folder}
                label={p.name}
                color={color}
                meta={`${p.envelopes.length} ${
                  p.envelopes.length === 1 ? "envelope" : "envelopes"
                } · ${(p.items ?? []).length} ${
                  (p.items ?? []).length === 1 ? "file" : "files"
                }`}
                onClick={() => onOpenResult(p.id, null, null)}
              />
            ))}
          </div>
        </div>
      )}

      {envelopes.length > 0 && (
        <div>
          <p className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
            Envelopes
          </p>
          <div className="space-y-1">
            {envelopes.map(({ project, envelope }) => (
              <Row
                key={envelope.id}
                icon={Folder}
                label={envelope.name}
                color={color}
                meta={`${project.name} · ${
                  (envelope.items ?? []).length
                } ${(envelope.items ?? []).length === 1 ? "file" : "files"}`}
                onClick={() => onOpenResult(project.id, envelope.id, null)}
              />
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <p className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-text-muted uppercase">
            Files
          </p>
          <div className="space-y-1">
            {files.map(({ project, envelope, file }) => (
              <Row
                key={file.id}
                icon={ITEM_ICONS[file.type]}
                label={file.name}
                color={color}
                meta={`${project.name}${
                  envelope ? " · " + envelope.name : ""
                } · ${FILE_TYPE_LABELS[file.type]}`}
                onClick={() =>
                  onOpenResult(project.id, envelope?.id ?? null, file.id)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DirectoryBrowser({
  section,
  color: rawColor,
  activeProject,
  focusTarget,
  onOpenProject,
  onAddProject,
  onAddEnvelope,
  onCreateFile,
  onRenameProject,
  onRenameEnvelope,
  onRenameItem,
  onUpdateFileContent,
  onRemoveItem,
  onDeleteEnvelope,
  onDeleteProject,
  onGroupItems,
  onClose,
}: {
  section: DemoSection;
  color: string;
  activeProject: DemoProject | null;
  focusTarget: { envelopeId: string | null; fileId: string } | null;
  onOpenProject: (id: string | null) => void;
  onAddProject: () => void;
  onAddEnvelope: (projectId: string) => void;
  onCreateFile: (
    projectId: string,
    envId: string | null,
    item: Omit<DirItem, "id"> & { file?: File },
  ) => void;
  onRenameProject: (id: string, name: string) => void;
  onRenameEnvelope: (
    projectId: string,
    envelopeId: string,
    name: string,
  ) => void;
  onRenameItem: (
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    name: string,
  ) => void;
  onUpdateFileContent: (
    projectId: string,
    envelopeId: string | null,
    itemId: string,
    content: string,
  ) => void;
  onRemoveItem: (
    projectId: string,
    envelopeId: string | null,
    itemId: string,
  ) => void;
  onDeleteEnvelope: (projectId: string, envelopeId: string) => void;
  onDeleteProject: (id: string) => void;
  onGroupItems: (projectId: string, itemIds: string[]) => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const viewT = reduce
    ? { duration: 0.01 }
    : { duration: 0.18, ease: "easeOut" as const };
  /* Theme-safe shade for the section glyphs: vivid in dark mode (with very
     dark hues lifted just enough to clear 3:1), and blended toward a dark
     steel in light mode. The raw stored color stays available as `rawColor`
     (used nowhere further). */
  const color = useThemeSafeGlyphColor(rawColor);

  const [envelopeId, setEnvelopeId] = useState<string | null>(
    () => focusTarget?.envelopeId ?? null,
  );
  const [openFile, setOpenFile] = useState<{
    envId: string | null;
    id: string;
  } | null>(() =>
    focusTarget
      ? { envId: focusTarget.envelopeId, id: focusTarget.fileId }
      : null,
  );
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ envId: string | null } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");

  const envelope =
    (activeProject &&
      envelopeId &&
      activeProject.envelopes.find((e) => e.id === envelopeId)) ||
    null;

  const depth = activeProject ? (envelope ? 2 : 1) : 0;
  const looseFiles = activeProject?.items ?? [];
  const trimmedQuery = query.trim();
  const hits = searchSection(section, trimmedQuery);
  const totalHits =
    hits.projects.length + hits.envelopes.length + hits.files.length;

  const clearTransient = () => {
    setOpenFile(null);
    setEdit(null);
    setSelectMode(false);
    setSelected(new Set());
    setDialog(null);
  };

  const openProject = (id: string | null) => {
    clearTransient();
    onOpenProject(id);
  };

  const goToEnvelope = (id: string | null) => {
    clearTransient();
    setEnvelopeId(id);
  };

  const openResult = (
    projectId: string,
    envId: string | null,
    fileId: string | null,
  ) => {
    setQuery("");
    clearTransient();
    onOpenProject(projectId);
    setEnvelopeId(envId);
    if (fileId) setOpenFile({ envId, id: fileId });
  };

  const commitEdit = () => {
    if (!edit) return;
    const v = editValue.trim();
    if (edit.kind === "drawer") onRenameProject(edit.id, v);
    else if (edit.kind === "envelope" && activeProject)
      onRenameEnvelope(activeProject.id, edit.id, v);
    else if (edit.kind === "item" && activeProject)
      onRenameItem(activeProject.id, edit.envId, edit.id, v);
    setEdit(null);
  };

  const openFileItem = (envId: string | null, itemId: string) => {
    setOpenFile({ envId, id: itemId });
    setEdit(null);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupSelected = () => {
    if (activeProject && selected.size > 0) {
      onGroupItems(activeProject.id, [...selected]);
      setSelectMode(false);
      setSelected(new Set());
    }
  };

  const runningFile = openFile
    ? (openFile.envId
        ? (envelope?.items ?? []).find((i) => i.id === openFile.id)
        : looseFiles.find((i) => i.id === openFile.id)) || null
    : null;

  const viewKey = runningFile
    ? `file:${runningFile.id}`
    : trimmedQuery
      ? `search:${trimmedQuery}`
      : `view:${depth}:${envelopeId ?? "root"}`;

  const openDialog = (envId: { envId: string | null }) => {
    dialogTriggerRef.current = (document.activeElement as HTMLElement) ?? null;
    setDialog(envId);
  };
  const closeDialog = () => {
    setDialog(null);
    /* Focus goes home to whichever button opened the dialog. */
    requestAnimationFrame(() => {
      dialogTriggerRef.current?.focus?.();
      dialogTriggerRef.current = null;
    });
  };
  useFocusTrap(dialogRef, dialog !== null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${section.label} directory`}
      tabIndex={-1}
      className="directory-browser relative flex h-full w-full max-h-[82vh] min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface/85 shadow-2xl shadow-black/40 backdrop-blur-xl outline-none sm:min-h-[480px]"
    >
      <header className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <Crumb onClick={() => openProject(null)}>
            <Folder className="mr-1 inline size-3.5" style={{ color }} />
            {section.label}
          </Crumb>
          {activeProject && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-text-muted" />
              <Crumb onClick={() => goToEnvelope(null)} strong>
                {activeProject.name}
              </Crumb>
            </>
          )}
          {envelope && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-text-muted" />
              <Crumb strong>{envelope.name}</Crumb>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close focus mode"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X className="size-4" />
        </button>
      </header>

      {!runningFile && (
        <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
          <Search className="size-4 shrink-0 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent placeholder:text-text-muted"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
              }
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="grid size-6 shrink-0 place-items-center rounded-md text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {trimmedQuery && (
        <p role="status" aria-live="polite" className="sr-only">
          {totalHits === 0
            ? `No matches for ${trimmedQuery} in ${section.label}`
            : `${totalHits} ${totalHits === 1 ? "result" : "results"} for ${trimmedQuery}`}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={viewT}
            className="flex h-full min-h-0 w-full flex-col"
          >
            {trimmedQuery ? (
              <SearchResults
                hits={hits}
                color={color}
                onOpenResult={openResult}
                query={query}
              />
            ) : runningFile ? (
              <FileDetail
                file={runningFile}
                color={color}
                onRename={(name) =>
                  activeProject &&
                  onRenameItem(
                    activeProject.id,
                    openFile!.envId,
                    openFile!.id,
                    name,
                  )
                }
                onUpdateContent={(content) =>
                  activeProject &&
                  onUpdateFileContent(
                    activeProject.id,
                    openFile!.envId,
                    openFile!.id,
                    content,
                  )
                }
                onDone={() => setOpenFile(null)}
              />
            ) : depth === 0 ? (
              section.projects.length === 0 && edit?.kind !== "drawer" ? (
                <p className="px-3 py-8 text-center text-sm text-text-muted">
                  No drawers yet — add one below.
                </p>
              ) : (
                <div className="w-full space-y-1">
                  {section.projects.map((project) =>
                    edit?.kind === "drawer" && edit.id === project.id ? (
                      <EditorRow
                        key={project.id}
                        icon={Folder}
                        color={color}
                        value={editValue}
                        onChange={setEditValue}
                        onCommit={commitEdit}
                        onCancel={() => setEdit(null)}
                      />
                    ) : (
                      <Row
                        key={project.id}
                        icon={Folder}
                        label={project.name}
                        color={color}
                        active={activeProject?.id === project.id}
                        meta={`${project.envelopes.length} ${
                          project.envelopes.length === 1
                            ? "envelope"
                            : "envelopes"
                        } · ${project.items?.length ?? 0} ${
                          (project.items?.length ?? 0) === 1 ? "file" : "files"
                        }`}
onClick={() =>
                        openProject(
                          activeProject?.id === project.id ? null : project.id,
                        )
                      }
                        actions={
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEdit({ kind: "drawer", id: project.id });
                                setEditValue(project.name);
                              }}
                              className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                              aria-label={`Rename ${project.name}`}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEdit(null);
                                onDeleteProject(project.id);
                              }}
                              className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
                              aria-label={`Delete ${project.name}`}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </>
                        }
                      />
                    ),
                  )}
                </div>
              )
            ) : envelope ? (
              <div className="w-full space-y-1">
                {envelope.items?.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-text-muted">
                    Empty envelope — add a file below.
                  </p>
                )}
                {envelope.items?.map((item) =>
                  edit?.kind === "item" &&
                  edit.id === item.id &&
                  edit.envId === envelope.id ? (
                    <EditorRow
                      key={item.id}
                      icon={ITEM_ICONS[item.type]}
                      color={color}
                      value={editValue}
                      onChange={setEditValue}
                      onCommit={commitEdit}
                      onCancel={() => setEdit(null)}
                    />
                  ) : (
                    <Row
                      key={item.id}
                      icon={ITEM_ICONS[item.type]}
                      label={item.name}
                      color={color}
                      onClick={() => openFileItem(envelope.id, item.id)}
                      trailing={
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-text-muted uppercase">
                          {FILE_TYPE_LABELS[item.type]}
                        </span>
                      }
                      actions={
                        <>
                          <button type="button" onClick={(e) => { e.stopPropagation(); downloadItem(item); }} className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-accent" aria-label={`Download ${item.name}`}>
                            <Download className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEdit({ kind: "item", envId: envelope.id, id: item.id });
                              setEditValue(item.name);
                            }}
                            className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                            aria-label={`Rename ${item.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEdit(null);
                              onRemoveItem(activeProject!.id, envelope.id, item.id);
                            }}
                            className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      }
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="w-full space-y-1">
                {selectMode && (
                  <div className="flex min-h-0 items-center gap-2 px-1 pb-2 text-xs text-text-muted">
                    <span>
                      {selected.size > 0
                        ? `${selected.size} selected`
                        : "Select files to group"}
                    </span>
                    {selected.size > 0 && (
                      <button
                        type="button"
                        onClick={groupSelected}
                        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-accent/10 px-2 py-1 font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <Folder className="size-3" />
                        Make envelope
                      </button>
                    )}
                  </div>
                )}
                {looseFiles.length === 0 &&
                  activeProject!.envelopes.length === 0 && (
                    <p className="px-3 py-8 text-center text-sm text-text-muted">
                      Empty drawer — add an envelope or a file below.
                    </p>
                  )}
                {activeProject!.envelopes.map((env) =>
                  edit?.kind === "envelope" && edit.id === env.id ? (
                    <EditorRow
                      key={env.id}
                      icon={Image}
                      color={color}
                      value={editValue}
                      onChange={setEditValue}
                      onCommit={commitEdit}
                      onCancel={() => setEdit(null)}
                    />
                  ) : (
                    <Row
                      key={env.id}
                      icon={Image}
                      label={env.name}
                      color={color}
                      meta={`${env.items?.length ?? 0} ${
                        (env.items?.length ?? 0) === 1 ? "item" : "items"
                      }`}
                      onClick={() => goToEnvelope(env.id)}
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEdit({ kind: "envelope", id: env.id });
                              setEditValue(env.name);
                            }}
                            className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                            aria-label={`Rename ${env.name}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEdit(null);
                              onDeleteEnvelope(activeProject!.id, env.id);
                            }}
                            className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
                            aria-label={`Delete ${env.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      }
                    />
                  ),
                )}
                {looseFiles.map((item) =>
                  edit?.kind === "item" &&
                  edit.id === item.id &&
                  edit.envId === null ? (
                    <EditorRow
                      key={item.id}
                      icon={ITEM_ICONS[item.type]}
                      color={color}
                      value={editValue}
                      onChange={setEditValue}
                      onCommit={commitEdit}
                      onCancel={() => setEdit(null)}
                    />
                  ) : (
                    <Row
                      key={item.id}
                      icon={ITEM_ICONS[item.type]}
                      label={item.name}
                      color={color}
                      active={selected.has(item.id)}
                      checked={selectMode ? selected.has(item.id) : undefined}
                      onCheck={() => selectMode && toggleSelected(item.id)}
                      trailing={
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-text-muted uppercase">
                          {FILE_TYPE_LABELS[item.type]}
                        </span>
                      }
                      onClick={() =>
                        selectMode
                          ? toggleSelected(item.id)
                          : openFileItem(null, item.id)
                      }
                      actions={
                        selectMode ? undefined : (
                          <>
                            <button type="button" onClick={(e) => { e.stopPropagation(); downloadItem(item); }} className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-accent" aria-label={`Download ${item.name}`}>
                              <Download className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEdit({ kind: "item", envId: null, id: item.id });
                                setEditValue(item.name);
                              }}
                              className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-accent/10 hover:text-accent"
                              aria-label={`Rename ${item.name}`}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEdit(null);
                                onRemoveItem(activeProject!.id, null, item.id);
                              }}
                              className="grid size-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-600"
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </>
                        )
                      }
                    />
                  ),
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 pb-4 text-xs text-text-muted">
        {runningFile ? (
          <span className="ml-auto">Editing {runningFile.name}</span>
        ) : depth === 2 ? (
          <>
            <button
              type="button"
              onClick={() => goToEnvelope(null)}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="size-3" />
              Back to {activeProject!.name}
            </button>
            <button
              type="button"
              onClick={() => openDialog({ envId: envelope!.id })}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-3" />
              Add file
            </button>
            <span className="ml-auto">
              {envelope!.items?.length ?? 0}{" "}
              {(envelope!.items?.length ?? 0) === 1 ? "file" : "files"}
            </span>
          </>
        ) : depth === 1 ? (
          <>
            <button
              type="button"
              onClick={() => onAddEnvelope(activeProject!.id)}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-3" />
              Envelope
            </button>
            <button
              type="button"
              onClick={() => openDialog({ envId: null })}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-3" />
              File
            </button>
            {looseFiles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelected(new Set());
                }}
                className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  selectMode ? "text-accent" : "text-text hover:text-accent"
                }`}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
            )}
            <span className="ml-auto">
              {selectMode
                ? `${selected.size} selected`
                : `${activeProject!.envelopes.length} ${
                    activeProject!.envelopes.length === 1
                      ? "envelope"
                      : "envelopes"
                  } · ${looseFiles.length} ${
                    looseFiles.length === 1 ? "file" : "files"
                  }`}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onAddProject}
              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="size-3" />
              Add drawer
            </button>
            <span className="ml-auto">
              {section.projects.length}{" "}
              {section.projects.length === 1 ? "drawer" : "drawers"}
            </span>
          </>
        )}
      </footer>

      <AnimatePresence>
        {dialog && (
          <motion.div
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                closeDialog();
              }
            }}
            className="absolute inset-0 z-10 flex items-start justify-center overflow-hidden p-3 backdrop-blur-[2px] sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0.01 } : { duration: 0.18 }}
          >
            <motion.button
              type="button"
              aria-label="Close dialog"
              onClick={closeDialog}
              className="absolute inset-0 cursor-pointer bg-black/30"
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 0 }}
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-file-title"
              className="relative z-[1] flex max-h-full w-full max-w-sm"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={
                reduce
                  ? { duration: 0.01 }
                  : { type: "spring", stiffness: 420, damping: 34 }
              }
              onClick={(e) => e.stopPropagation()}
            >
              <FileForm
                existingCount={
                  dialog.envId
                    ? (envelope?.items?.length ?? 0)
                    : looseFiles.length
                }
                color={color}
                onCreate={(item) => {
                  if (activeProject) onCreateFile(activeProject.id, dialog.envId, item);
                  closeDialog();
                }}
                onCancel={closeDialog}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
