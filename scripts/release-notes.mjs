import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function releaseNotesEntries(message) {
  const lines = message.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => /^(?:#{1,6}\s+)?Release Notes:\s*$/i.test(line));
  if (start < 0) return null;
  const entries = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s+|^[A-Za-z][\w-]*:\s/.test(line)) break;
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) entries.push(bullet[1].trim());
    else if (/^\s+\S/.test(line) && entries.length) entries[entries.length - 1] += `\n${line}`;
  }
  return entries.filter((entry) => !/^N\/A[.!]?$/i.test(entry));
}

export function generateReleaseNotes({
  tag,
  previousTag,
  cwd = process.cwd(),
  repository = "csdog/mediax",
}) {
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const validateTag = (value) => {
    if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value))
      throw new Error(`Invalid release tag: ${value}`);
    git("rev-parse", "--verify", `refs/tags/${value}^{commit}`);
  };
  validateTag(tag);
  if (git("rev-parse", "--is-shallow-repository") === "true")
    throw new Error("Release notes require full Git history; fetch with fetch-depth: 0.");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid GitHub repository");
  if (previousTag) {
    validateTag(previousTag);
    if (previousTag === tag) throw new Error("Previous tag must differ from release tag");
    git("merge-base", "--is-ancestor", `refs/tags/${previousTag}`, `refs/tags/${tag}`);
  } else {
    const parents = git("rev-list", "--parents", "-n", "1", `refs/tags/${tag}`).split(" ");
    if (parents.length > 1) {
      try {
        previousTag = git("describe", "--tags", "--match", "v[0-9]*", "--abbrev=0", `${tag}^`);
      } catch (error) {
        if (error.status !== 128) throw error;
        // No preceding release tag: include the complete history for the first release.
      }
    }
  }
  const range = previousTag ? `${previousTag}..${tag}` : tag;
  const commits = git("log", "--reverse", "--format=%H%x00%B%x00", range).split("\0");
  const notes = [];
  const missing = [];
  const seen = new Set();
  const base = `https://github.com/${repository}`;
  for (let index = 0; index + 1 < commits.length; index += 2) {
    const hash = commits[index].trim();
    const message = commits[index + 1];
    const subject = message.split("\n")[0];
    const entries = releaseNotesEntries(message);
    if (entries === null) missing.push(`${hash.slice(0, 7)} ${subject}`);
    const pr =
      subject.match(/\(#(\d+)\)$/)?.[1] ?? subject.match(/^Merge pull request #(\d+)\b/)?.[1];
    const link = pr
      ? `[#${pr}](${base}/pull/${pr})`
      : `[${hash.slice(0, 7)}](${base}/commit/${hash})`;
    for (const entry of entries ?? []) {
      const key = entry.replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      notes.push(`- ${entry} (${link})`);
    }
  }
  const changelog = previousTag
    ? `${base}/compare/${previousTag}...${tag}`
    : `${base}/commits/${tag}`;
  const body = `## What's Changed\n\n${notes.length ? notes.join("\n") : "No release-note entries were provided; see the full changelog."}\n\n**Full Changelog**: ${changelog}\n`;
  return { body, previousTag, missing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [tag, previousTag, ...extra] = process.argv.slice(2);
    if (!tag || extra.length)
      throw new Error("Usage: node scripts/release-notes.mjs <tag> [previous-tag]");
    const result = generateReleaseNotes({
      tag,
      previousTag,
      repository: process.env.GITHUB_REPOSITORY || "csdog/mediax",
    });
    for (const commit of result.missing) console.error(`Missing Release Notes: ${commit}`);
    process.stdout.write(result.body);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
