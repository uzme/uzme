import { writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "uzme";
const token = process.env.GITHUB_TOKEN;
const flagshipRepositories = [
  { name: "bahromjon-portfolio", label: "Bahromjon Portfolio" },
  { name: "biolab-interactive-guide", label: "BioLab Interactive Guide" },
  { name: "developer-portfolio", label: "Developer Portfolio" },
];
const attentionConclusions = new Set(["failure", "cancelled", "timed_out"]);

if (!token) {
  throw new Error("GITHUB_TOKEN is required to generate the workflow health rollup.");
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

const repositories = await Promise.all(flagshipRepositories.map(async ({ name, label }) => {
  const payload = await github(`/repos/${owner}/${name}/actions/runs?per_page=100`);
  const runs = payload.workflow_runs || [];
  const meaningfulRuns = runs.filter((run) => run.conclusion !== "skipped");
  const latest = meaningfulRuns[0];
  const attention = meaningfulRuns.filter((run) =>
    attentionConclusions.has(run.conclusion) && new Date(run.updated_at) >= since,
  );

  return { name, label, latest, attention };
}));

const attentionRuns = repositories.flatMap((repository) => repository.attention.map((run) => ({
  ...run,
  repositoryLabel: repository.label,
}))).sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at));
const overallStatus = attentionRuns.length ? "ATTENTION" : "PASS";
const status = (conclusion) => conclusion === "success" ? "PASS" : conclusion || "PENDING";

const report = [
  "# Workflow Health Rollup",
  "",
  `> Window: ${formatDate(since)} — ${formatDate(now)} (UTC).`,
  `> Status: **${overallStatus}** — ${attentionRuns.length} meaningful failure/cancelled/timed-out run in the last 7 days.`,
  "",
  "Bu rollup faqat public flagship repository’lardagi GitHub Actions runlarini o‘qiydi. Notification event filteri sabab `skipped` bo‘lgan runlar health signal hisoblanmaydi.",
  "",
  "Joriy health jadvali har repository’ning eng so‘nggi mazmunli workflow holatini ko‘rsatadi. Attention detail esa oxirgi 7 kundagi tarixiy failure/cancelled/timed-out runlarni saqlaydi; keyingi successful run bunday oldingi hodisani avtomatik o‘chirib yubormaydi.",
  "",
  "## Current public workflow health",
  "",
  "| Repository | Latest meaningful workflow | Current status | Recent attention |",
  "|---|---|---|---:|",
  ...repositories.map((repository) => `| [${repository.label}](https://github.com/${owner}/${repository.name}) | [${repository.latest?.name || "No workflow run"}](${repository.latest?.html_url || `https://github.com/${owner}/${repository.name}/actions`}) | ${status(repository.latest?.conclusion)} | ${repository.attention.length} |`),
  "",
  "## Attention detail",
  "",
  ...(attentionRuns.length
    ? attentionRuns.map((run) => `- **${run.repositoryLabel}** · [${run.name}](${run.html_url}) · ${run.conclusion} · ${formatDate(run.updated_at)}`)
    : ["- So‘nggi 7 kunda meaningful workflow failure, cancelled yoki timed-out run qayd etilmadi."]),
  "",
];

const metrics = {
  generatedAt: now.toISOString(),
  windowStart: since.toISOString(),
  windowEnd: now.toISOString(),
  attentionCount: attentionRuns.length,
  repositories: Object.fromEntries(repositories.map((repository) => [repository.name, {
    latestConclusion: repository.latest?.conclusion || null,
    recentAttention: repository.attention.length,
  }])),
};

await Promise.all([
  writeFile("profile/workflow-health-rollup.md", report.join("\n"), "utf8"),
  writeFile("profile/workflow-health-metrics.json", `${JSON.stringify(metrics, null, 2)}\n`, "utf8"),
]);
