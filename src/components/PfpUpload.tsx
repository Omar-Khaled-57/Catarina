"use client";

import { useRef } from "react";
import { User, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "sonner";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024;

/**
 * PFP upload button with preview — used in admin modals.
 */
export default function PfpUpload({
  currentPfp,
  onUpload,
  uploading,
}: {
  currentPfp: string | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-border shrink-0">
        {currentPfp ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentPfp} alt="Profile picture preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <User size={24} className="text-text-muted" />
          </div>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; /* allow re-selecting the same file */
            if (!file) return;
            if (!ALLOWED_TYPES.has(file.type)) {
              toast.error("Unsupported file type. Use JPG, PNG, GIF, or WebP.");
              return;
            }
            if (file.size > MAX_SIZE) {
              toast.error("File too large. Max 2 MB.");
              return;
            }
            onUpload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          isLoading={uploading}
          className="text-xs"
        >
          <Upload size={12} /> Upload Photo
        </Button>
        <p className="text-[10px] text-text-muted mt-1">JPG, PNG, GIF, WebP (max 2 MB)</p>
      </div>
    </div>
  );
}
