export type ExportColumn<T> = { header: string; key: keyof T | string };

function valueOf<T extends Record<string, any>>(row: T, key: keyof T | string) {
  return String(row[key as string] ?? '');
}

export function downloadCsv<T extends Record<string, any>>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const content = [
    columns.map(c => quote(c.header)).join(';'),
    ...rows.map(row => columns.map(c => quote(valueOf(row, c.key))).join(';'))
  ].join('\r\n');
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export async function downloadXlsx<T extends Record<string, any>>(filename: string, sheetName: string, columns: ExportColumn<T>[], rows: T[]) {
  const mod = await import('exceljs');
  const ExcelJS: any = (mod as any).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0,31));
  sheet.columns = columns.map(c => ({ header: c.header, key: String(c.key), width: Math.max(14, c.header.length + 3) }));
  rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map(c => [String(c.key), valueOf(row,c.key)]))));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export function printTableReport<T extends Record<string, any>>(title: string, columns: ExportColumn<T>[], rows: T[]) {
  const escape = (s: string) => s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{font-family:Arial;padding:24px;color:#111}h1{font-size:22px}p{font-size:11px;color:#555}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:7px;text-align:left}th{background:#eee}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>${escape(title)}</h1><p>Données internes remontées par les observateurs du parti — non officielles.</p><table><thead><tr>${columns.map(c=>`<th>${escape(c.header)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${escape(valueOf(r,c.key))}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close();
}
