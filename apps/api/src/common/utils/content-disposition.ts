/**
 * Build a safe Content-Disposition value. The ASCII fallback drops control
 * characters — which would otherwise make `res.setHeader` throw and 500 the
 * download — along with quotes and backslashes; `filename*` carries the real,
 * possibly non-ASCII name percent-encoded per RFC 5987/6266 for clients that
 * understand it.
 */
export function contentDisposition(name: string): string {
  const asciiFallback =
    name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '').trim() || 'download';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
