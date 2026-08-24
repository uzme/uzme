import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "uzme";
const token = process.env.GITHUB_TOKEN;
const flagshipRepositories = [
  { name: "bahromjon-portfolio", label: "Bahromjon Portfolio" },
  { name: "biolab-interactive-guide", label: "BioLab Interactive Guide" },
  { name: "developer-portfolio", label: "Developer Portfolio" },
];
const attentionConclusions = new Set(["failure", "cancelled", "timed_out"]);

if (!token) {
  throw new Error("GITHUB_TOKEN is required to generate the monthly engineering snapshot.");
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

function resolvePeriod(now) {
  if (process.env.SNAPSHOT_MONTH && /^\d{4}-\d{2}$/.test(process.env.SNAPSHOT_MONTH)) {
    const [year, month] = process.env.SNAPSHOT_MONTH.split("-").map(Number);
    return {
      key: process.env.SNAPSHOT_MONTH,
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  }

  const scheduledMonth = now.getUTCDate() === 1;
  const year = scheduledMonth && now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const month = scheduledMonth ? (now.getUTCMonth() + 11) % 12 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const calendarEnd = new Date(Date.UTC(year, month + 1, 1));

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    start,
    end: calendarEnd > now ? now : calendarEnd,
  };
}

const now = new Date();
const period = resolvePeriod(now);
const formatDate = (date) => new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeZone: "UTC",
}).format(new Date(date));
const inPeriod = (date) => date && new Date(date) >= period.start && new Date(date) < period.end;

const repositories = await Promise.all(flagshipRepositories.map(async ({ name, label }) => {
  const [pulls, releases, runs, openPulls] = await Promise.all([
    github(`/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=100`),
    github(`/repos/${owner}/${name}/releases?per_page=100`),
    github(`/repos/${owner}/${name}/actions/runs?per_page=100`),
    github(`/repos/${owner}/${name}/pulls?state=open&sort=updated&direction=desc&per_page=100`),
  ]);

  const mergedPulls = pulls.filter((pull) => inPeriod(pull.merged_at));
  const publishedReleases = releases.filter((release) => inPeriod(release.published_at));
  const meaningfulRuns = (runs.workflow_runs || []).filter((run) => run.conclusion !== "skipped" && inPeriod(run.updated_at));
  const attentionRuns = meaningfulRuns.filter((run) => attentionConclusions.has(run.conclusion));

  return {
    name,
    label,
    mergedPulls,
    publishedReleases,
    successfulRuns: meaningfulRuns.filter((run) => run.conclusion === "success").length,
    attentionRuns,
    openPulls: openPulls.length,
    dependabotPulls: openPulls.filter((pull) => pull.user?.login?.startsWith("dependabot")).length,
  };
}));

const totalMerged = repositories.reduce((sum, repository) => sum + repository.mergedPulls.length, 0);
const totalReleases = repositories.reduce((sum, repository) => sum + repository.publishedReleases.length, 0);
const totalSuccessfulRuns = repositories.reduce((sum, repository) => sum + repository.successfulRuns, 0);
const attentionRuns = repositories.flatMap((repository) => repository.attentionRuns.map((run) => ({
  ...run,
  repositoryLabel: repository.label,
})));
const snapshotLabel = period.end < now ? "Completed month" : "Month to date";
const archivePath = `profile/monthly-snapshots/${period.key}.md`;

const renderReport = (relativePrefix) => [
  `# Monthly Engineering Snapshot — ${period.key}`,
  "",
  `> ${snapshotLabel}: ${formatDate(period.start)} — ${formatDate(period.end)} (UTC).`,
  `> Generated: ${now.toISOString()}.`,
  "",
  "Bu snapshot faqat public flagship repository’larning real GitHub merge, release va workflow signalini jamlaydi. Private loyiha ma’lumotlari, tokenlar va secretlar kiritilmaydi.",
  "",
  "## Delivery summary",
  "",
  "| Metric | Value |",
  "|---|---:|",
  `| Public merged PR | ${totalMerged} |`,
  `| Published release | ${totalReleases} |`,
  `| Successful meaningful workflow run | ${totalSuccessfulRuns} |`,
  `| Failure/cancelled/timed-out workflow run | ${attentionRuns.length} |`,
  "",
  "## Repository breakdown",
  "",
  "| Repository | Merged PR | Release | Successful workflow | Attention run | Open PR | Dependabot PR |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...repositories.map((repository) => `| [${repository.label}](https://github.com/${owner}/${repository.name}) | ${repository.mergedPulls.length} | ${repository.publishedReleases.length} | ${repository.successfulRuns} | ${repository.attentionRuns.length} | ${repository.openPulls} | ${repository.dependabotPulls} |`),
  "",
  "## Shipped evidence",
  "",
  ...(repositories.flatMap((repository) => [
    ...repository.publishedReleases.map((release) => `- **Release** · ${repository.label} · [${release.tag_name || release.name || "New release"}](${release.html_url})`),
    ...repository.mergedPulls.map((pull) => `- **Merged PR** · ${repository.label} · [#${pull.number} ${pull.title}](${pull.html_url})`),
  ]).slice(0, 25) || ["- Bu davrda public merge yoki release qayd etilmadi."]),
  "",
  "## Workflow attention",
  "",
  ...(attentionRuns.length
    ? attentionRuns.map((run) => `- **${run.repositoryLabel}** · [${run.name}](${run.html_url}) · ${run.conclusion}`)
    : ["- Bu davrda meaningful failure, cancelled yoki timed-out workflow run qayd etilmadi."]),
  "",
  "## Related evidence",
  "",
  `- Current reliability view: [Workflow Health Rollup](${relativePrefix}/workflow-health-rollup.md).`,
  `- Current delivery view: [Weekly Build Log](${relativePrefix}/weekly-build-log.md).`,
  "- Product priorities: [Developer Roadmap](https://github.com/users/uzme/projects/1).",
  "",
];

const currentReport = renderReport(".");
const archiveReport = renderReport("..");

const metadata = {
  generatedAt: now.toISOString(),
  period: period.key,
  start: period.start.toISOString(),
  end: period.end.toISOString(),
  totals: {
    mergedPulls: totalMerged,
    releases: totalReleases,
    successfulRuns: totalSuccessfulRuns,
    attentionRuns: attentionRuns.length,
  },
};

await mkdir("profile/monthly-snapshots", { recursive: true });
await Promise.all([
  writeFile("profile/monthly-engineering-snapshot.md", currentReport.join("\n"), "utf8"),
  writeFile(archivePath, archiveReport.join("\n"), "utf8"),
  writeFile("profile/monthly-snapshot-metrics.json", `${JSON.stringify(metadata, null, 2)}\n`, "utf8"),
]);
