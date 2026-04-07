import type { GitHubClient } from "./client.js";

export interface FundingInfo {
  hasFunding: boolean;
  platforms: string[];
}

export function analyzeFunding(
  fundingLinks?: Array<{ platform: string; url: string }>,
): FundingInfo {
  if (!fundingLinks || fundingLinks.length === 0) {
    return { hasFunding: false, platforms: [] };
  }

  const platforms = fundingLinks.map((l) => l.platform.toLowerCase());
  return { hasFunding: true, platforms };
}

interface GitHubContentResponse {
  content?: string;
  encoding?: string;
}

export async function fetchFundingREST(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<FundingInfo> {
  try {
    const data = await client.request<GitHubContentResponse>(
      `/repos/${owner}/${repo}/contents/.github/FUNDING.yml`,
    );

    if (data.content && data.encoding === "base64") {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      const platforms = parseFundingYml(decoded);
      return { hasFunding: platforms.length > 0, platforms };
    }

    return { hasFunding: true, platforms: [] };
  } catch {
    return { hasFunding: false, platforms: [] };
  }
}

function parseFundingYml(content: string): string[] {
  const platforms: string[] = [];
  const knownKeys = [
    "github",
    "patreon",
    "open_collective",
    "ko_fi",
    "tidelift",
    "community_bridge",
    "liberapay",
    "issuehunt",
    "lfx_crowdfunding",
    "polar",
    "buy_me_a_coffee",
    "custom",
  ];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (knownKeys.includes(key) && value && value !== "# Replace") {
      platforms.push(key);
    }
  }

  return platforms;
}
