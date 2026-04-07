import type { RegistryInfo, Maintainer } from "../types.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

interface NpmPackageResponse {
  repository?: { url?: string };
  deprecated?: string;
  time?: Record<string, string>;
  "dist-tags"?: { latest?: string };
  maintainers?: Array<{ name: string; email?: string }>;
}

function parseRepoUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  let url = raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "")
    .replace(/^ssh:\/\/git@github\.com/, "https://github.com");

  if (url.startsWith("github:")) {
    url = `https://github.com/${url.slice(7)}`;
  }

  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return `https://github.com/${match[1]}/${match[2]}`;
  }

  return null;
}

export async function fetchNpmRegistryInfo(
  packageName: string,
): Promise<RegistryInfo> {
  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`npm registry returned ${res.status} for ${packageName}`);
  }

  const data = (await res.json()) as NpmPackageResponse;

  const latestVersion = data["dist-tags"]?.latest;
  let lastPublishDate: Date | null = null;
  if (latestVersion && data.time?.[latestVersion]) {
    lastPublishDate = new Date(data.time[latestVersion]);
  }

  let deprecated: string | null = null;
  if (latestVersion) {
    const versionRes = await fetch(
      `${NPM_REGISTRY}/${encodeURIComponent(packageName)}/${latestVersion}`,
      { headers: { Accept: "application/json" } },
    );
    if (versionRes.ok) {
      const versionData = (await versionRes.json()) as { deprecated?: string };
      if (versionData.deprecated) {
        deprecated = versionData.deprecated;
      }
    }
  }

  const maintainers: Maintainer[] = (data.maintainers ?? []).map((m) => ({
    name: m.name,
    email: m.email,
  }));

  return {
    repoUrl: parseRepoUrl(data.repository?.url),
    deprecated,
    lastPublishDate,
    maintainers,
    weeklyDownloads: null,
  };
}
