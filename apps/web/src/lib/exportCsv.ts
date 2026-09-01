/**
 * Generic CSV export utility.
 * Takes an array of flat objects and downloads them as a CSV file.
 * Handles null/undefined → empty cell, objects → JSON string.
 */
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    // Wrap in quotes if the value contains a comma, quote, or newline
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Flatten a row with segment objects {v,s} into plain segment values for export */
export function flattenSegments(row: Record<string, unknown>, segKey = "segments"): Record<string, unknown> {
  const { [segKey]: segs, ...rest } = row;
  const segArr = segs as { v: string | null; s?: string }[] | (string | null)[];
  const segCols: Record<string, string> = {};
  const NAMES = ["Agency","Operating Unit","Fund","Cost Centre","Account","Project","Donor","Interagency","Future"];
  if (Array.isArray(segArr)) {
    segArr.forEach((seg, i) => {
      segCols[NAMES[i] ?? `Seg${i + 1}`] = typeof seg === "object" && seg !== null ? (seg as any).v ?? "" : (seg ?? "");
    });
  }
  return { ...rest, ...segCols };
}
