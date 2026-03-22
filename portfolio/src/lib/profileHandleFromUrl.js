/**
 * Last non-empty path segment after stripping ?query and #hash and trailing slashes.
 * e.g. https://linkedin.com/in/rohit-raj/?trk=x -> rohit-raj
 */
export function profileHandleFromUrl(href) {
  if (!href || typeof href !== "string") {
    return "";
  }
  let s = href.trim();
  const q = s.indexOf("?");
  if (q !== -1) {
    s = s.slice(0, q);
  }
  const h = s.indexOf("#");
  if (h !== -1) {
    s = s.slice(0, h);
  }
  try {
    const u = new URL(s);
    const path = u.pathname.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : "";
  } catch {
    const withoutOrigin = s.replace(/^https?:\/\/[^/]+/i, "");
    const path = withoutOrigin.replace(/\/+$/, "").replace(/^\/+/, "");
    const segments = path.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : "";
  }
}
