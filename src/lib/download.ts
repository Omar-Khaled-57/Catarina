/** Download a demo item, using its source when available or a small text file.
 *
 * Cross-origin and data: sources are re-fetched as a same-origin blob so the
 * `download` attribute is honored (browser ignores it for cross-origin URLs),
 * and every object URL we create is revoked after the click.
 */
export function downloadItem({ name, content }: { name: string; content?: string }) {
  const source = content && /^(blob:|data:|https?:|\/)/i.test(content) ? content : null;

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