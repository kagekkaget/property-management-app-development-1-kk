export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  const head = columns.map((c) => csvCell(c.label)).join(";");
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(";"));
  return [head, ...body].join("\r\n");
}

export function csvResponse(filename: string, content: string) {
  const bom = "\uFEFF";
  return new Response(bom + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
