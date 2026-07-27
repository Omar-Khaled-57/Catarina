"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Reusable file upload hook — handles FormData POST to /api/upload
 * and returns the uploaded URL on success.
 */
export default function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Upload failed, try again");
        return null;
      }
      const data = await res.json();
      toast.success("Profile picture updated");
      return data.url;
    } catch {
      toast.error("Upload failed, try again");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
