/**
 * Extract structured text items from a PDF Buffer (Node.js, pdfjs-dist).
 * Adapted from crew-allowance's pdfToText.js for server-side use.
 *
 * Returns per-page items with coordinates so pcsrParser can do
 * x-coordinate-based date column assignment.
 */

// Use the legacy build for Node.js compatibility (no web worker needed).
// pdfjs-dist is excluded from server bundling (see next.config.mjs) so
// Node.js resolves the worker natively — no webpack workarounds needed.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// ── one-page flattened text (legacy API) ─────────────────────────────────────
export async function pdfArrayBufferToText(buffer) {
  const { pages } = await pdfArrayBufferToItems(buffer);
  return pages.map(p => p.items.map(it => it.str).join(" ")).join("\n");
}

// ── structured item-level extraction ─────────────────────────────────────────
// Returns per-page items with coordinates. Used by pcsrParser's grid-first path
// so sector dates can be derived from x-position under the calendar header row
// instead of the (unreliable) Other Crew section on pages 2+.
export async function pdfArrayBufferToItems(buffer) {
  const data = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : buffer instanceof Buffer
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : buffer;

  const doc = await getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .map(it => ({
        str: "str" in it ? it.str : "",
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0,
        w: it.width ?? 0,
        h: it.height ?? 0,
      }))
      .filter(it => it.str !== "");
    pages.push({ items });
  }
  return { pages };
}
