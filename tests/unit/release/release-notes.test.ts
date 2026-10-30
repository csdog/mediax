import { afterEach, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateReleaseNotes, releaseNotesEntries } from "../../../scripts/release-notes.mjs";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "mediax-release-notes-"));
  directories.push(cwd);
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "--quiet");
  const commit = (message: string) => {
    git(
      "-c",
      "user.name=Release Test",
      "-c",
      "user.email=release@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      message,
    );
    return git("rev-parse", "HEAD");
  };
  return { cwd, git, commit };
}

it("extracts the dedicated section, preserves multiline entries, and stops at the next heading", () => {
  expect(
    releaseNotesEntries(
      "Fix\r\n\r\n## Release Notes:\r\n\r\n- Fixed avatar\r\n  on refresh.\r\n* N/A\r\n- Added presets\r\n\r\n## Tests\r\n- Not a release note",
    ),
  ).toEqual(["Fixed avatar\n  on refresh.", "Added presets"]);
  expect(
    releaseNotesEntries(
      "Fix\n\nRelease Notes:\n\n- Fixed refresh\n\nSigned-off-by: Someone\n- unrelated",
    ),
  ).toEqual(["Fixed refresh"]);
  expect(releaseNotesEntries("Fix without notes")).toBeNull();
});

it("uses commit notes between tags, skips N/A, deduplicates and links PRs or commits", () => {
  const { cwd, git, commit } = fixture();
  commit("Old feature\n\nRelease Notes:\n\n- Old entry");
  git("tag", "v0.7.0");
  const hash = commit("Fix account\n\nRelease Notes:\n\n- Fixed account avatar");
  commit(
    "Add presets (#42)\n\nRelease Notes:\n\n- Added publishing presets\n- Fixed account avatar",
  );
  commit("docs\n\nRelease Notes:\n\n- N/A");
  commit("chore without public notes");
  git("tag", "v0.8.0");
  commit("Future\n\nRelease Notes:\n\n- Future entry");
  const result = generateReleaseNotes({ tag: "v0.8.0", cwd });
  expect(result.previousTag).toBe("v0.7.0");
  expect(result.body).toContain(
    `[${hash.slice(0, 7)}](https://github.com/csdog/mediax/commit/${hash})`,
  );
  expect(result.body).toContain("[#42](https://github.com/csdog/mediax/pull/42)");
  expect(result.body.match(/Fixed account avatar/g)).toHaveLength(1);
  expect(result.body).not.toMatch(/Old entry|Future entry|N\/A|chore without/);
  expect(result.body).toContain("compare/v0.7.0...v0.8.0");
  expect(result.missing).toEqual([expect.stringContaining("chore without public notes")]);
});

it("supports the first release even when its tag is on the root commit", () => {
  const { cwd, git, commit } = fixture();
  commit("Initial\n\nRelease Notes:\n\n- Added MediaX");
  git("tag", "v0.1.0");
  const result = generateReleaseNotes({ tag: "v0.1.0", cwd });
  expect(result.previousTag).toBeUndefined();
  expect(result.body).toContain("Added MediaX");
  expect(result.body).toContain("/commits/v0.1.0");
});

it("uses an ancestor tag rather than a newer tag on a different branch", () => {
  const { cwd, git, commit } = fixture();
  commit("Initial");
  git("tag", "v0.1.0");
  git("branch", "unrelated");
  commit("Public change\n\nRelease Notes:\n\n- Added feature");
  git("tag", "v0.2.0");
  git("checkout", "--quiet", "unrelated");
  commit("Other branch");
  git("tag", "v9.0.0");
  expect(generateReleaseNotes({ cwd, tag: "v0.2.0" }).previousTag).toBe("v0.1.0");
  expect(() => generateReleaseNotes({ cwd, tag: "v0.2.0", previousTag: "v9.0.0" })).toThrow();
});

it("allows an explicit comparison base and explains missing legacy notes without copying subjects", () => {
  const { cwd, git, commit } = fixture();
  commit("Initial");
  git("tag", "v0.1.0");
  commit("chore: change internal implementation");
  git("tag", "v0.2.0");
  const result = generateReleaseNotes({ cwd, tag: "v0.2.0", previousTag: "v0.1.0" });
  expect(result.body).toContain("No release-note entries were provided");
  expect(result.body).not.toContain("internal implementation");
  expect(result.missing).toHaveLength(1);
  expect(() => generateReleaseNotes({ cwd, tag: "v0.2.0", previousTag: "v0.2.0" })).toThrow(
    "must differ",
  );
  expect(() => generateReleaseNotes({ cwd, tag: "--all" })).toThrow("Invalid release tag");
  expect(() => generateReleaseNotes({ cwd, tag: "v3.0.0" })).toThrow();
});

it("runs the CLI with clean Markdown on stdout and diagnostics on stderr", () => {
  const { cwd, git, commit } = fixture();
  commit("Legacy subject");
  git("tag", "v0.1.0");
  const script = resolve("scripts/release-notes.mjs");
  const result = spawnSync(process.execPath, [script, "v0.1.0"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/^## What's Changed/);
  expect(result.stdout).not.toContain("Missing Release Notes:");
  expect(result.stderr).toContain("Missing Release Notes:");
  expect(result.stdout).toContain("/commits/v0.1.0");
});
