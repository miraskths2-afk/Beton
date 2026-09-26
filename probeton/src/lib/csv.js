// Выгрузка данных в CSV (открывается в Excel / Google Таблицах).
// Разделитель — точка с запятой: Excel с русской/казахской локалью
// ожидает именно его. В начале файла — BOM, чтобы Excel правильно
// показал кириллицу.

function cell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(";");
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(";"));
  return "﻿" + [head, ...body].join("\r\n");
}

export function downloadCsv(filename, columns, rows) {
  const blob = new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
