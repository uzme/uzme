import { readFile, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "uzme";
const token = process.env.GITHUB_TOKEN;
const flagshipRepositories = [
  "bahromjon-portfolio",
  "biolab-interactive-guide",
  "developer-portfolio",
];
const reportUrl = `https://github.com/${owner}/${owner}/blob/main/profile/automation-report.md`;

if (!token) {
  throw new Error("GITHUB_TOKEN is required to generate the automation report.");
}

async function github(path, { optional = false } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (optional) return null;
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.json();
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

const now = new Date();
const previous = await readJson("profile/automation-metrics.json", {});
const previousGeneratedAt = previous.generatedAt ? new Date(previous.generatedAt) : null;
const since = previousGeneratedAt?.toISOString() || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

const profile = await github(`/users/${owner}`);
const repositories = await Promise.all(flagshipRepositories.map(async (name) => {
  const [repository, runs, pulls, openPulls, releases] = await Promise.all([
    github(`/repos/${owner}/${name}`),
    github(`/repos/${owner}/${name}/actions/runs?per_page=20`),
    github(`/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=30`),
    github(`/repos/${owner}/${name}/pulls?state=open&sort=updated&direction=desc&per_page=100`),
    github(`/repos/${owner}/${name}/releases?per_page=20`, { optional: true }),
  ]);

  const workflowRuns = runs.workflow_runs || [];
  const latestRun = workflowRuns.find((run) => run.conclusion !== "skipped") || workflowRuns[0];
  const mergedPulls = pulls.filter((pull) => pull.merged_at && pull.merged_at > since);
  const recentReleases = (releases || []).filter((release) => release.published_at && release.published_at > since);

  return {
    name,
    updatedAt: repository.updated_at,
    visibility: repository.visibility,
    archived: repository.archived,
    defaultBranch: repository.default_branch,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    workflow: latestRun?.name || "Workflow hali ishga tushmagan",
    conclusion: latestRun?.conclusion || latestRun?.status || "Noma’lum",
    runUrl: latestRun?.html_url || `https://github.com/${owner}/${name}/actions`,
    openPulls: openPulls.length,
    dependabotPulls: openPulls.filter((pull) => pull.user?.login?.startsWith("dependabot")).length,
    mergedPulls,
    recentReleases,
  };
}));

const metrics = {
  generatedAt: now.toISOString(),
  followers: profile.followers,
  totalStars: repositories.reduce((sum, repository) => sum + repository.stars, 0),
  totalDependabotPulls: repositories.reduce((sum, repository) => sum + repository.dependabotPulls, 0),
  repositories: Object.fromEntries(repositories.map((repository) => [repository.name, {
    stars: repository.stars,
    forks: repository.forks,
    dependabotPulls: repository.dependabotPulls,
  }])),
};

const delta = (current, prior) => Number.isFinite(prior) ? current - prior : null;
const formatDelta = (value) => value === null ? "yangi baseline" : value === 0 ? "o‘zgarmadi" : `${value > 0 ? "+" : ""}${value}`;
const followerDelta = delta(metrics.followers, previous.followers);
const starDelta = delta(metrics.totalStars, previous.totalStars);
const dependabotDelta = delta(metrics.totalDependabotPulls, previous.totalDependabotPulls);
const recentMergedPulls = repositories.flatMap((repository) => repository.mergedPulls.map((pull) => ({ repository: repository.name, ...pull })));
const recentReleases = repositories.flatMap((repository) => repository.recentReleases.map((release) => ({ repository: repository.name, ...release })));
const statusIcon = (status) => status === "success" ? "PASS" : status === "failure" ? "CHECK" : "PENDING";

const achievements = [
  ...recentReleases.map((release) => `- Release: [${release.repository} ${release.tag_name || release.name || "new release"}](${release.html_url})`),
  ...recentMergedPulls.map((pull) => `- PR merged: [${pull.repository} #${pull.number}](${pull.html_url}) — ${pull.title}`),
].slice(0, 12);
const achievementLogEntries = achievements.length ? achievements : ["- Hozircha yangi merge yoki release qayd etilmadi."];

const report = [
  "# GitHub Automation Report",
  "",
  `> Oxirgi avtomatik yangilanish: ${metrics.generatedAt} (UTC).`,
  "",
  "Bu fayl GitHub Actions orqali har kuni yangilanadi. Unda faqat public loyiha holati jamlanadi; tokenlar, secretlar yoki shaxsiy ma’lumotlar yozilmaydi.",
  "",
  "## Profil va community metrikalari",
  "",
  "| Metrika | Hozir | Oxirgi yangilanishdan farq |",
  "|---|---:|---:|",
  `| Followers | ${metrics.followers} | ${formatDelta(followerDelta)} |`,
  `| Flagship repository starlari | ${metrics.totalStars} | ${formatDelta(starDelta)} |`,
  `| Ochiq Dependabot update PR’lari | ${metrics.totalDependabotPulls} | ${formatDelta(dependabotDelta)} |`,
  "",
  "## Flagship repository holati",
  "",
  "| Repository | So‘nggi workflow | Holat | Stars | Dependabot PR |",
  "|---|---|---|---:|---:|",
  ...repositories.map((repository) => `| [${repository.name}](https://github.com/${owner}/${repository.name}) | [${repository.workflow}](${repository.runUrl}) | ${statusIcon(repository.conclusion)} — ${repository.conclusion} | ${repository.stars} | ${repository.dependabotPulls} |`),
  "",
  "## Oxirgi yutuqlar",
  "",
  ...achievementLogEntries,
  "",
  "## Automation qamrovi",
  "",
  "Flagship repository’larda build/typecheck/test workflowlari, Dependabot yangilanishlari va CodeQL security scanlari ishlaydi. Tezkor Telegram xabarlari CI xatosi yoki successful production deploy uchun, digest esa profil metrikalari, ochiq Dependabot update PR’lari va yutuqlar uchun ishlatiladi.",
  "",
  "## Tashqi bildirishnoma",
  "",
  "Agar `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` repository secretlari sozlansa, daily monitoring faqat o‘zgarish bo‘lganda yoki dushanba kungi jamlanmada Telegram’ga qisqa status yuboradi. Secretlar hech qachon report yoki workflow logiga chiqarilmaydi.",
  "",
];

const engineeringDashboard = [
  "# Engineering Dashboard",
  "",
  `> Oxirgi yangilanish: ${metrics.generatedAt} (UTC).`,
  "",
  "Bu dashboard faqat public flagship repository’larning real GitHub signalidan yaratiladi. Private loyiha tafsilotlari, tokenlar va secretlar ko‘rsatilmaydi.",
  "",
  "## Public flagship health",
  "",
  "| Repository | So‘nggi workflow | Holat | Ochiq PR | Dependabot PR |",
  "|---|---|---|---:|---:|",
  ...repositories.map((repository) => `| [${repository.name}](https://github.com/${owner}/${repository.name}) | [${repository.workflow}](${repository.runUrl}) | ${statusIcon(repository.conclusion)} — ${repository.conclusion} | ${repository.openPulls} | ${repository.dependabotPulls} |`),
  "",
  "## Delivery evidence",
  "",
  `- Recent public merges since the prior dashboard update: **${recentMergedPulls.length}**.`,
  `- Recent public releases since the prior dashboard update: **${recentReleases.length}**.`,
  "- Weekly delivery history: [Weekly Build Log](./weekly-build-log.md).",
  "- Product priorities and acceptance criteria: [Developer Roadmap](https://github.com/users/uzme/projects/1).",
  "",
  "## Quality system",
  "",
  "Public flagship repositories use CI, CodeQL, dependency review or audit where applicable, and scheduled repository health monitoring. Workflow links above remain the source of truth for the current state.",
  "",
];

const isMonday = now.getUTCDay() === 1;
const hasMetricChange = [followerDelta, starDelta, dependabotDelta].some((value) => value !== null && value !== 0);
const shouldNotify = isMonday || hasMetricChange || recentMergedPulls.length > 0 || recentReleases.length > 0;
const digest = shouldNotify
  ? `GitHub Digest: @${owner} — ${metrics.followers} followers, ${metrics.totalStars} stars, ${metrics.totalDependabotPulls} Dependabot PR, ${recentMergedPulls.length} yangi merge, ${recentReleases.length} yangi release. Batafsil: ${reportUrl}`
  : "";

await Promise.all([
  writeFile("profile/automation-report.md", report.join("\n"), "utf8"),
  writeFile("profile/engineering-dashboard.md", engineeringDashboard.join("\n"), "utf8"),
  writeFile("profile/achievement-log.md", `${["# GitHub Yutuqlar Jurnali", "", ...achievementLogEntries].join("\n")}\n`, "utf8"),
  writeFile("profile/automation-metrics.json", `${JSON.stringify(metrics, null, 2)}\n`, "utf8"),
  writeFile("profile/telegram-digest.txt", digest ? `${digest}\n` : "", "utf8"),
]);
