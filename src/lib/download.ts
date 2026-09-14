/** Download a demo item, using its source when available or a small text file.
 *
 * Cross-origin, data: and file: sources are re-fetched as a same-origin blob so
 * the `download` attribute is honored (browser ignores it for cross-origin
 * URLs), and every object URL we create is revoked after the click. `file://`
 * is a reference to an assembled cloud file served by
 * GET /api/drawers/files/[id].
 */
export function downloadItem({ name, content }: { name: string; content?: string }) {
  const saveBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    /* Safari aborts the download if the object URL is revoked synchronously —
       defer the revoke to a later tick. */
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fileRef = content && content.startsWith("file://") ? content.slice(7) : null;
  if (fileRef) {
    void (async () => {
      try {
        const res = await fetch(`/api/drawers/files/${fileRef}`);
        if (!res.ok) throw new Error();
        saveBlob(await res.blob());
      } catch {
        saveBlob(new Blob([content ?? name], { type: "text/plain" }));
      }
    })();
    return;
  }

  const source = content && /^(blob:|data:|https?:|\/)/i.test(content) ? content : null;

  if (!source) {
    saveBlob(new Blob([content ?? name], { type: "text/plain" }));
    return;
  }

  void (async () => {
    try {
      const res = await fetch(source);
      if (!res.ok) throw new Error();
      saveBlob(await res.blob());
    } catch {
      if (source.startsWith("blob:") || source.startsWith("data:")) {
        saveBlob(new Blob([source], { type: "text/plain" }));
      } else {
        window.open(source, "_blank", "noopener,noreferrer");
      }
    }
  })();
}