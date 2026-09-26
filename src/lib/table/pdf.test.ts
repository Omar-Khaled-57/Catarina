import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildTablePdfHtml, esc, numOr } from "./pdf";
import { PDF_PALETTE } from "@/lib/pdf-palette";
import type { GridState } from "./grid";

/* The export is written into a SAME-ORIGIN iframe with `document.write`, so an
   unescaped value in this document is not a cosmetic bug: it executes with the
   user's session. Server-side validation now bounds every sticker field, but
   rows saved before that validation existed are still in the database, so the
   renderer has to hold the line on its own. */

const grid: GridState = {
  rows: [[{ v: "hello", rs: 1, cs: 1 }, null, null]],
  cols: 3,
};

const doc = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  name: "Plan",
  section: "goals",
  color: "#00E8A2",
  cells: grid,
  stickers: [],
  isDateBased: false,
  ...over,
});

const render = (table: Record<string, unknown>, stickers = false) =>
  buildTablePdfHtml({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hostile input on purpose
    table: table as any,
    theme: "dark",
    includeStickers: stickers,
  });

describe("esc neutralizes HTML metacharacters", () => {
  test("escapes the characters that break out of an attribute", () => {
    assert.equal(esc('"'), "&quot;");
    assert.equal(esc("<"), "&lt;");
    assert.equal(esc(">"), "&gt;");
    assert.equal(esc("&"), "&amp;");
    assert.equal(esc(`<img src=x onerror="alert(1)">`),
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

describe("numOr keeps interpolated numbers finite and in range", () => {
  test("passes through in-range values", () => {
    assert.equal(numOr(50, 88, 40, 240), 50);
  });
  test("falls back on non-numeric and non-finite input", () => {
    for (const bad of [undefined, null, "abc", NaN, Infinity, -Infinity, {}]) {
      assert.equal(numOr(bad, 88, 40, 240), 88, `${String(bad)} was not rejected`);
    }
  });
  test("clamps rather than emitting an out-of-range value", () => {
    assert.equal(numOr(9999, 88, 40, 240), 240);
    assert.equal(numOr(-5, 88, 40, 240), 40);
  });
});

describe("the PDF export resists hostile stored values", () => {
  test("quote-bearing sprite yields no injected attribute", () => {
    const html = render(
      doc({
        stickers: [
          {
            id: "s1",
            sprite: 'x" onerror="alert(1)',
            x: 10,
            y: 20,
            w: 88,
          },
        ],
      }),
      true,
    );
    /* The payload may survive as harmless percent-encoded text inside the URL
       (`alert(1)` has no metacharacters to encode); what must not exist is a
       real event-handler attribute, or a raw quote inside the src value. */
    assert.ok(!/\son[a-z]+\s*=/i.test(html), "an event handler reached the document");
    const src = html.match(/<img src="([^"]*)"/)?.[1] ?? "";
    assert.ok(src.length > 0, "the sticker image was not rendered at all");
    assert.ok(!src.includes('"'), "a raw quote survived inside the src attribute");
    assert.ok(src.includes("%22"), `the quote was not encoded: ${src}`);
  });

  test("a non-numeric position cannot inject a style or attribute", () => {
    const html = render(
      doc({
        stickers: [
          {
            id: "s1",
            sprite: "happy",
            x: '0%" onload="alert(1)',
            y: '0;background:url(javascript:alert(1))',
            w: '99" onerror="alert(2)',
          },
        ],
      }),
      true,
    );
    assert.ok(!/\son[a-z]+\s*=/i.test(html), "an event handler reached the document");
    assert.ok(!/javascript:/.test(html), "a javascript: URL reached the document");
  });

  test("cell text is escaped, not interpreted", () => {
    const html = render(
      doc({
        cells: {
          rows: [[{ v: '<script>alert("x")</script>', rs: 1, cs: 1 }]],
          cols: 1,
        },
      }),
    );
    assert.ok(!/<script>/.test(html), "cell text produced a live script tag");
    assert.ok(html.includes("&lt;script&gt;"), "cell text was not escaped");
  });

  test("a hostile table name cannot inject markup", () => {
    const html = render(doc({ name: '</title><script>alert(1)</script>' }));
    assert.ok(!/<script>/.test(html));
  });

  test("the palette themes all render", () => {
    for (const theme of Object.keys(PDF_PALETTE)) {
      const html = buildTablePdfHtml({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- theme key is dynamic
        table: doc() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- theme key is dynamic
        theme: theme as any,
        includeStickers: true,
      });
      assert.ok(html.startsWith("<!DOCTYPE html>"), `${theme} produced no document`);
    }
  });
});
