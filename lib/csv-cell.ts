/** Encode untrusted text as a spreadsheet-safe CSV cell. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r]/.test(text))
    text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '\"\"')}"` : text;
}
