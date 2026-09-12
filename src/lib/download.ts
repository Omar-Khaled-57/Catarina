/** Download a demo item, using its source when available or a small text file. */
export function downloadItem({ name, content }: { name: string; content?: string }) {
  const source = content && /^(blob:|data:|https?:|\/)/i.test(content) ? content : null;
  const url = source ?? URL.createObjectURL(new Blob([content ?? name], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  if (!source) URL.revokeObjectURL(url);
}
