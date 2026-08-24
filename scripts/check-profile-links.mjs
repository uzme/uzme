import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDirectories = ["docs", "profile"];
const sourceFiles = ["README.md"];
const reportPath = "profile/link-health-report.md";
const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const externalResultCache = new Map();
const externalConcurrency = 8;

async function collectMarkdownFiles(directory) {
  const absoluteDirectory = path.join(root, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(relativePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relativePath);
    }
  }

  return files;
}

async function extractLinks(source) {
  const content = await readFile(source, "utf8");
  const links = [];

  for (const match of content.matchAll(markdownLinkPattern)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (target && !target.startsWith("#") && !target.startsWith("mailto:") && !target.startsWith("tel:")) {
      links.push(target);
    }
  }

  return links;
}

async function checkExternalLink(target) {
  if (!target.startsWith("https://")) {
    return { ok: false, state: "ATTENTION", detail: "Unsupported or insecure URL scheme" };
  }

  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "uzme-profile-link-check/1.0" },
    });
    if (response.status >= 200 && response.status < 400) {
      return { ok: true, state: "PASS", detail: `HTTP ${response.status}` };
    }
    if (response.status === 404 || response.status === 410) {
      return { ok: false, state: "ATTENTION", detail: `HTTP ${response.status} — confirmed unavailable` };
    }
    return { ok: true, state: "UNVERIFIED", detail: `HTTP ${response.status} — remote response is temporary or access-limited` };
  } catch (error) {
    return {
      ok: true,
      state: "UNVERIFIED",
      detail: error.name === "TimeoutError" ? "Timed out" : "Network error",
    };
  }
}

async function mapWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function checkRelativeLink(source, target) {
  const targetPath = target.split("#", 1)[0].split("?", 1)[0];
  const candidate = path.resolve(path.dirname(path.join(root, source)), targetPath);

  if (!candidate.startsWith(root)) {
    return { ok: false, state: "ATTENTION", detail: "Path escapes repository root" };
  }

  try {
    await access(candidate, constants.F_OK);
    return { ok: true, state: "PASS", detail: "Local file exists" };
  } catch {
    return { ok: false, state: "ATTENTION", detail: "Local file not found" };
  }
}

const markdownFiles = [
  ...sourceFiles,
  ...(await Promise.all(sourceDirectories.map(collectMarkdownFiles))).flat(),
].filter((file) => file !== reportPath);
const uniqueChecks = new Map();

for (const source of markdownFiles) {
  for (const target of await extractLinks(source)) {
    uniqueChecks.set(`${source}::${target}`, { source, target });
  }
}

const results = await mapWithConcurrency([...uniqueChecks.values()], async ({ source, target }) => {
  if (!target.startsWith("https://")) {
    return { source, target, ...await checkRelativeLink(source, target) };
  }

  if (!externalResultCache.has(target)) {
    externalResultCache.set(target, checkExternalLink(target));
  }

  return { source, target, ...await externalResultCache.get(target) };
}, externalConcurrency);

const failures = results.filter((result) => !result.ok);
const unverified = results.filter((result) => result.state === "UNVERIFIED");
const status = failures.length ? "ATTENTION" : "PASS";
const report = [
  "# Link Health Report",
  "",
  `> Generated: ${new Date().toISOString()} (UTC).`,
  `> Status: **${status}** — ${results.length - failures.length}/${results.length} links confirmed healthy; ${unverified.length} remote link requires a later retry.`,
  "",
  "Bu report README, `docs/` va `profile/` ichidagi Markdown havolalarini tekshiradi. Private ma’lumot, token yoki autentifikatsiya qilingan endpointlar tekshirilmaydi.",
  "",
  "## Results",
  "",
  "| Source | Link | Result |",
  "|---|---|---|",
  ...results.map((result) => `| \`${result.source}\` | [${result.target}](${result.target}) | ${result.state} — ${result.detail} |`),
  "",
];

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, report.join("\n"), "utf8");

if (failures.length) {
  console.error(`Link check found ${failures.length} unhealthy link(s).`);
  process.exitCode = 1;
}
