/** Turn address-bar input into a navigable URL (site or search). */
export function resolveOmniboxUrl(
  input: string,
  searchUrl: (query: string) => string = (query) =>
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).href;
    } catch {
      return searchUrl(raw);
    }
  }
  // localhost / IPs — browsers commonly use http here
  if (!/\s/.test(raw) && /^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?([/:?#].*)?$/i.test(raw)) {
    try {
      return new URL(`http://${raw}`).href;
    } catch {
      return searchUrl(raw);
    }
  }
  // host.tld or host.tld/path — prepend https
  if (!/\s/.test(raw) && /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(raw)) {
    try {
      return new URL(`https://${raw}`).href;
    } catch {
      return searchUrl(raw);
    }
  }
  return searchUrl(raw);
}
