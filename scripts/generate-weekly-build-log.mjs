import { writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "uzme";
const token = process.env.GITHUB_TOKEN;
const flagshipRepositories = [
  { name: "bahromjon-portfolio", label: "Bahromjon Portfolio" },
  { name: "biolab-interactive-guide", label: "BioLab Interactive Guide" },
  { name: "developer-portfolio", label: "Developer Portfolio" },
];

if (!token) {
  throw new Error("GITHUB_TOKEN is required to generate the weekly build log.");
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.json();
}

const now = new Date();
const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const formatDate = (date) => new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeZone: "UTC",
}).format(new Date(date));
const statusLabel = (status) => {
  if (status === "success") return "PASS";
  if (status === "failure") return "ATTENTION";
  return "PENDING";
};

const repositories = await Promise.all(flagshipRepositories.map(async ({ name, label }) => {
  const [runs, pulls, releases] = await Promise.all([
    github(`/repos/${owner}/${name}/actions/runs?per_page=20`),
    github(`/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=100`),
    github(`/repos/${owner}/${name}/releases?per_page=30`),
  ]);

  const workflowRuns = runs.workflow_runs || [];
  const latestRun = workflowRuns.find((run) => run.conclusion !== "skipped") || workflowRuns[0];
  const mergedPulls = pulls
    .filter((pull) => pull.merged_at && new Date(pull.merged_at) >= since)
    .map((pull) => ({
      type: "Merged PR",
      date: pull.merged_at,
      title: `#${pull.number} ${pull.title}`,
      url: pull.html_url,
    }));
  const recentReleases = releases
    .filter((release) => release.published_at && new Date(release.published_at) >= since)
    .map((release) => ({
      type: "Release",
      date: release.published_at,
      title: release.tag_name || release.name || "New release",
      url: release.html_url,
    }));

  return {
    name,
    label,
    runName: latestRun?.name || "Workflow hali ishga tushmagan",
    conclusion: latestRun?.conclusion || latestRun?.status || "unknown",
    runUrl: latestRun?.html_url || `https://github.com/${owner}/${name}/actions`,
    events: [...mergedPulls, ...recentReleases],
  };
}));

const highlights = repositories
  .flatMap((repository) => repository.events.map((event) => ({ repository: repository.label, ...event })))
  .sort((left, right) => new Date(right.date) - new Date(left.date))
  .slice(0, 12);

const shipped = highlights.length
  ? highlights.map((event) => `- **${event.type}** · ${event.repository} · [${event.title}](${event.url}) · ${formatDate(event.date)}`)
  : ["- Bu yetti kun ichida public flagship repository’larda yangi merge yoki release qayd etilmadi."];

const report = [
  "# Weekly Build Log",
  "",
  `> Reporting window: ${formatDate(since)} — ${formatDate(now)} (UTC).`,
  `> Generated: ${now.toISOString()}.`,
  "",
  "Bu jurnal faqat public flagship repository’lardagi real merge, release va workflow holatlaridan avtomatik yaratiladi. Private loyiha ma’lumotlari, tokenlar va secretlar kiritilmaydi.",
  "",
  "## Shipped this week",
  "",
  ...shipped,
  "",
  "## Engineering pulse",
  "",
  "| Repository | So‘nggi workflow | Holat |",
  "|---|---|---|",
  ...repositories.map((repository) => `| [${repository.label}](https://github.com/${owner}/${repository.name}) | [${repository.runName}](${repository.runUrl}) | ${statusLabel(repository.conclusion)} — ${repository.conclusion} |`),
  "",
  "## Next product direction",
  "",
  "Active public priorities are kept in the [Developer Roadmap](https://github.com/users/uzme/projects/1). The roadmap holds the delivery criteria; this log records only evidence that has already shipped.",
  "",
];

const metadata = {
  generatedAt: now.toISOString(),
  windowStart: since.toISOString(),
  windowEnd: now.toISOString(),
  publicRepositories: flagshipRepositories.map((repository) => repository.name),
};

await Promise.all([
  writeFile("profile/weekly-build-log.md", report.join("\n"), "utf8"),
  writeFile("profile/weekly-build-log-metrics.json", `${JSON.stringify(metadata, null, 2)}\n`, "utf8"),
]);
