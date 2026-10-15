import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { systemPreferences } from "electron";

export type WebSearchProvider = {
  id: string;
  name: string;
  /** Where the provider was discovered. */
  source?: "browser" | "system" | "fallback";
};

type BrowserCandidate = {
  id: string;
  name: string;
  /** Match against default-browser bundle id / desktop file / exe path. */
  match: RegExp;
  userData: string;
};

function chromiumUserDataRoots(): BrowserCandidate[] {
  const home = homedir();
  if (process.platform === "darwin") {
    const support = join(home, "Library", "Application Support");
    return [
      {
        id: "chrome",
        name: "Chrome",
        match: /chrome/i,
        userData: join(support, "Google", "Chrome"),
      },
      {
        id: "chrome-beta",
        name: "Chrome Beta",
        match: /chrome\.beta|chromebeta/i,
        userData: join(support, "Google", "Chrome Beta"),
      },
      {
        id: "edge",
        name: "Edge",
        match: /edge|microsoft edge/i,
        userData: join(support, "Microsoft Edge"),
      },
      {
        id: "brave",
        name: "Brave",
        match: /brave/i,
        userData: join(support, "BraveSoftware", "Brave-Browser"),
      },
      {
        id: "arc",
        name: "Arc",
        match: /\barc\b/i,
        userData: join(support, "Arc", "User Data"),
      },
      {
        id: "chromium",
        name: "Chromium",
        match: /chromium/i,
        userData: join(support, "Chromium"),
      },
      {
        id: "vivaldi",
        name: "Vivaldi",
        match: /vivaldi/i,
        userData: join(support, "Vivaldi"),
      },
    ];
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    return [
      {
        id: "chrome",
        name: "Chrome",
        match: /chrome/i,
        userData: join(local, "Google", "Chrome", "User Data"),
      },
      {
        id: "edge",
        name: "Edge",
        match: /msedge|microsoft.?edge/i,
        userData: join(local, "Microsoft", "Edge", "User Data"),
      },
      {
        id: "brave",
        name: "Brave",
        match: /brave/i,
        userData: join(local, "BraveSoftware", "Brave-Browser", "User Data"),
      },
      {
        id: "vivaldi",
        name: "Vivaldi",
        match: /vivaldi/i,
        userData: join(local, "Vivaldi", "User Data"),
      },
    ];
  }
  const config = process.env.XDG_CONFIG_HOME || join(home, ".config");
  return [
    {
      id: "chrome",
      name: "Chrome",
      match: /google-chrome|chrome/i,
      userData: join(config, "google-chrome"),
    },
    {
      id: "edge",
      name: "Edge",
      match: /microsoft-edge|msedge/i,
      userData: join(config, "microsoft-edge"),
    },
    {
      id: "brave",
      name: "Brave",
      match: /brave/i,
      userData: join(config, "BraveSoftware", "Brave-Browser"),
    },
    {
      id: "chromium",
      name: "Chromium",
      match: /chromium/i,
      userData: join(config, "chromium"),
    },
    {
      id: "vivaldi",
      name: "Vivaldi",
      match: /vivaldi/i,
      userData: join(config, "vivaldi"),
    },
  ];
}

function readJsonFile(path: string): unknown {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function lastUsedProfile(userData: string): string {
  const localState = readJsonFile(join(userData, "Local State")) as {
    profile?: { last_used?: string };
  } | null;
  const last = localState?.profile?.last_used?.trim();
  return last || "Default";
}

type TemplateUrlData = {
  short_name?: string;
  keyword?: string;
  url?: string;
  search_url?: string;
  synced_guid?: string;
};

function templateFromPreferences(prefs: unknown): TemplateUrlData | null {
  if (!prefs || typeof prefs !== "object") return null;
  const root = prefs as {
    default_search_provider_data?: {
      template_url_data?: TemplateUrlData;
      mirrored_template_url_data?: TemplateUrlData;
    };
    default_search_provider?: TemplateUrlData & { name?: string; enabled?: boolean };
  };
  const fromData =
    root.default_search_provider_data?.template_url_data ||
    root.default_search_provider_data?.mirrored_template_url_data;
  if (fromData && (fromData.url || fromData.search_url)) return fromData;
  const legacy = root.default_search_provider;
  if (legacy && legacy.enabled !== false && (legacy.url || legacy.search_url || legacy.keyword)) {
    return {
      short_name: legacy.short_name || legacy.name,
      keyword: legacy.keyword,
      url: legacy.url || legacy.search_url,
      synced_guid: legacy.synced_guid,
    };
  }
  return null;
}

function applySearchTemplate(template: string, query: string): string {
  let url = template
    .replaceAll("{searchTerms}", encodeURIComponent(query))
    .replaceAll("{google:baseURL}", "https://www.google.com/")
    .replaceAll("{google:baseSuggestURL}", "https://www.google.com/complete/")
    .replaceAll("{inputEncoding}", "UTF-8");
  url = url.replace(/\{[^}]+\}/g, "");
  url = url
    .replace(/&&+/g, "&")
    .replace(/\?&/g, "?")
    .replace(/[?&]+$/g, "");
  try {
    return new URL(url).href;
  } catch {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
}

function readChromiumSearch(userData: string): {
  name: string;
  id: string;
  template: string;
} | null {
  if (!existsSync(userData)) return null;
  const profile = lastUsedProfile(userData);
  const prefs = readJsonFile(join(userData, profile, "Preferences"));
  const template = templateFromPreferences(prefs);
  const raw = template?.url || template?.search_url;
  if (!raw || !raw.includes("{searchTerms}")) return null;
  return {
    name: template?.short_name?.trim() || template?.keyword?.trim() || "Search",
    id: template?.synced_guid || template?.keyword || raw,
    template: raw,
  };
}

function defaultBrowserHint(): string {
  try {
    if (process.platform === "darwin") {
      const out = execFileSync(
        "defaults",
        ["read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers"],
        { encoding: "utf8", timeout: 2000 },
      );
      return out;
    }
    if (process.platform === "linux") {
      return execFileSync("xdg-settings", ["get", "default-web-browser"], {
        encoding: "utf8",
        timeout: 2000,
      });
    }
    if (process.platform === "win32") {
      // ProgId for https, e.g. ChromeHTML / MSEdgeHTM
      return execFileSync(
        "reg",
        [
          "query",
          "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
          "/v",
          "ProgId",
        ],
        { encoding: "utf8", timeout: 2000 },
      );
    }
  } catch {
    /* ignore */
  }
  return "";
}

function orderedBrowserCandidates(): BrowserCandidate[] {
  const all = chromiumUserDataRoots().filter((item) => existsSync(item.userData));
  if (!all.length) return [];
  const hint = defaultBrowserHint();
  if (!hint) return all;
  const preferred = all.filter((item) => item.match.test(hint));
  const rest = all.filter((item) => !item.match.test(hint));
  return [...preferred, ...rest];
}

function browserSearch(): {
  provider: WebSearchProvider;
  template: string;
} | null {
  for (const browser of orderedBrowserCandidates()) {
    const found = readChromiumSearch(browser.userData);
    if (!found) continue;
    return {
      provider: {
        id: found.id,
        name: found.name,
        source: "browser",
      },
      template: found.template,
    };
  }
  return null;
}

function macSystemSearchProvider(): WebSearchProvider | null {
  if (process.platform !== "darwin") return null;
  try {
    const prefs = systemPreferences.getUserDefault("NSPreferredWebServices", "dictionary") as
      | {
          NSWebServicesProviderWebSearch?: {
            NSProviderIdentifier?: string;
            NSDefaultDisplayName?: string;
          };
        }
      | undefined;
    const search = prefs?.NSWebServicesProviderWebSearch;
    const id = typeof search?.NSProviderIdentifier === "string" ? search.NSProviderIdentifier : "";
    const name =
      typeof search?.NSDefaultDisplayName === "string" ? search.NSDefaultDisplayName : "";
    if (id || name) return { id, name: name || id, source: "system" };
  } catch {
    /* ignore */
  }
  return null;
}

function providerSearchUrl(provider: WebSearchProvider, query: string): string {
  const key = `${provider.id} ${provider.name}`.toLowerCase();
  const q = encodeURIComponent(query);
  if (key.includes("bing")) return `https://www.bing.com/search?q=${q}`;
  if (key.includes("duckduckgo") || /\bduck\b/.test(key)) return `https://duckduckgo.com/?q=${q}`;
  if (key.includes("yahoo")) return `https://search.yahoo.com/search?p=${q}`;
  if (key.includes("baidu")) return `https://www.baidu.com/s?wd=${q}`;
  if (key.includes("sogou")) return `https://www.sogou.com/web?query=${q}`;
  if (key.includes("yandex")) return `https://yandex.com/search/?text=${q}`;
  if (key.includes("ecosia")) return `https://www.ecosia.org/search?q=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

let cached:
  | {
      provider: WebSearchProvider;
      template?: string;
    }
  | undefined;

function resolveSearchConfig() {
  if (cached) return cached;
  const fromBrowser = browserSearch();
  if (fromBrowser) {
    cached = fromBrowser;
    return cached;
  }
  const fromSystem = macSystemSearchProvider();
  if (fromSystem) {
    cached = { provider: fromSystem };
    return cached;
  }
  cached = {
    provider: { id: "com.google.www", name: "Google", source: "fallback" },
  };
  return cached;
}

/** Prefer the user's Chromium browser search engine; then macOS system search; else Google. */
export function systemSearchProvider(): WebSearchProvider {
  return resolveSearchConfig().provider;
}

export function systemSearchUrl(query: string): string {
  const { provider, template } = resolveSearchConfig();
  if (template) return applySearchTemplate(template, query);
  return providerSearchUrl(provider, query);
}
