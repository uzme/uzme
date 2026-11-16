import { readFile, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "uzme";
const token = process.env.GITHUB_TOKEN;
const flagshipRepositories = [
  // Public-only scope: private projects are intentionally excluded.
  "bahromjon-portfolio",
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
  const [repository, runs, pulls, openPulls, releases, workflows, readme] = await Promise.all([
    github(`/repos/${owner}/${name}`),
    github(`/repos/${owner}/${name}/actions/runs?per_page=20`),
    github(`/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=30`),
    github(`/repos/${owner}/${name}/pulls?state=open&sort=updated&direction=desc&per_page=100`),
    github(`/repos/${owner}/${name}/releases?per_page=20`, { optional: true }),
    github(`/repos/${owner}/${name}/actions/workflows?per_page=100`, { optional: true }),
    github(`/repos/${owner}/${name}/contents/README.md`, { optional: true }),
  ]);

  const workflowRuns = runs.workflow_runs || [];
  const latestRun = workflowRuns.find((run) => run.conclusion !== "skipped") || workflowRuns[0];
  const recentAttention = workflowRuns.filter((run) =>
    ["failure", "cancelled", "timed_out"].includes(run.conclusion)
    && new Date(run.updated_at) >= new Date(since),
  );
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
    recentAttention,
    openPulls: openPulls.length,
    dependabotPulls: openPulls.filter((pull) => pull.user?.login?.startsWith("dependabot")).length,
    mergedPulls,
    recentReleases,
    allReleases: releases || [],
    workflows: (workflows?.workflows || []).map((workflow) => workflow.name),
    hasReadme: Boolean(readme),
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
const recentWorkflowAttention = repositories.flatMap((repository) => repository.recentAttention.map((run) => ({ repository: repository.name, ...run })));
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
  `| So‘nggi 7 kundagi workflow attention | ${recentWorkflowAttention.length} | real-time public signal |`,
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
  `- Workflow attention in the last 7 days: **${recentWorkflowAttention.length}**. [Detailed rollup](./workflow-health-rollup.md).`,
  "- Weekly delivery history: [Weekly Build Log](./weekly-build-log.md).",
  "- Link reliability: [Link Health Report](./link-health-report.md).",
  "- Monthly delivery history: [Monthly Engineering Snapshot](./monthly-engineering-snapshot.md).",
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

const statusLabel = (conclusion) => conclusion === "success" ? "PASS" : conclusion === "failure" ? "ATTENTION" : (conclusion || "PENDING").toUpperCase();
const publicUrl = (name) => `https://github.com/${owner}/${name}`;
const latestRelease = repositories
  .flatMap((repository) => repository.allReleases.map((release) => ({ repository: repository.name, ...release })))
  .sort((left, right) => new Date(right.published_at) - new Date(left.published_at));
const deliveryEvents = [
  ...recentReleases.map((release) => ({ type: "Release", date: release.published_at, repository: release.repository, title: release.name || release.tag_name, url: release.html_url })),
  ...recentMergedPulls.map((pull) => ({ type: "Merged PR", date: pull.merged_at, repository: pull.repository, title: `#${pull.number} ${pull.title}`, url: pull.html_url })),
].sort((left, right) => new Date(right.date) - new Date(left.date));
const pulseStatus = repositories.every((repository) => repository.conclusion === "success") ? "ALL PUBLIC SYSTEMS HEALTHY" : "REVIEW REQUIRED";
const scoreFor = (repository) => {
  const workflowNames = repository.workflows.join(" ").toLowerCase();
  const checks = [
    ["CI / build", /ci|build|test|validate/.test(workflowNames)],
    ["Security", /codeql|security|dependabot|audit/.test(workflowNames)],
    ["Documentation", repository.hasReadme],
    ["Release signal", repository.allReleases.length > 0],
    ["Monitoring", /health|monitor/.test(workflowNames)],
  ];
  return { checks, passed: checks.filter(([, passed]) => passed).length, total: checks.length };
};
const pulse = [
  "# Live Engineering Pulse",
  "",
  `> Yangilangan: ${metrics.generatedAt} (UTC). Faqat public repository’lar kuzatiladi.`,
  "",
  `## ${pulseStatus}`,
  "",
  "| Repository | Workflow | CI signal | Security signal | Open PR | Release |",
  "|---|---|---|---|---:|---|",
  ...repositories.map((repository) => `| [${repository.name}](${publicUrl(repository.name)}) | [${repository.workflow}](${repository.runUrl}) | ${statusLabel(repository.conclusion)} | ${repository.workflows.some((name) => /codeql|security|dependabot|audit/i.test(name)) ? "ENABLED" : "NOT DETECTED"} | ${repository.openPulls} | ${repository.allReleases[0]?.tag_name || "No release"} |`),
  "",
  "Source of truth: GitHub Actions, GitHub Releases va GitHub pull request API javoblari.",
  "",
];
const timelineEvents = deliveryEvents.slice(0, 12);
const timeline = [
  "# Building in Public Timeline",
  "",
  "> Real merge va release dalillari asosida avtomatik yaratiladi.",
  "",
  ...(timelineEvents.length ? timelineEvents.map((event) => `- **${new Date(event.date).toISOString().slice(0, 10)}** · **${event.type}** · ${event.repository} · [${event.title}](${event.url})`) : ["- Hozircha public merge yoki release dalili mavjud emas."]),
  "",
  "Private loyihalar va ularga tegishli ichki activity bu timeline’ga kiritilmaydi.",
  "",
];
const projectCards = [
  "# Public Project Health Cards",
  "",
  "> Scorecard mavjud fayl, workflow va release signallaridan hisoblanadi; bu umumiy sifat kafolati emas.",
  "",
  ...repositories.map((repository) => {
    const score = scoreFor(repository);
    return [
      `## [${repository.name}](${publicUrl(repository.name)}) — ${score.passed}/${score.total}`,
      "",
      ...score.checks.map(([label, passed]) => `- ${passed ? "[x]" : "[ ]"} ${label}`),
      `- So‘nggi workflow: **${statusLabel(repository.conclusion)}**`,
      `- Ochiq PR: **${repository.openPulls}** · Dependabot PR: **${repository.dependabotPulls}**`,
      "",
    ].join("\n");
  }),
  "",
];
const releaseRadar = [
  "# Release Radar",
  "",
  "> Public repository’larning GitHub Releases API’dan olingan eng so‘nggi release’lari.",
  "",
  "| Repository | Release | Sana | Havola |",
  "|---|---|---|---|",
  ...(latestRelease.length ? latestRelease.slice(0, 12).map((release) => `| ${release.repository} | ${release.name || release.tag_name || "Untitled release"} | ${release.published_at?.slice(0, 10) || "—"} | [Open](${release.html_url}) |`) : ["| — | Hozircha release yo‘q | — | — |"]),
  "",
];
const weeklyHighlight = [
  "# Weekly Highlight",
  "",
  `> Yangilangan: ${metrics.generatedAt} (UTC).`,
  "",
  deliveryEvents[0]
    ? `## ${deliveryEvents[0].type}: ${deliveryEvents[0].repository}

[${deliveryEvents[0].title}](${deliveryEvents[0].url})

Bu tanlov oxirgi public delivery daliliga asoslangan; u fake contribution yoki star hisoblamaydi.`
    : `## Public delivery signal

Hozircha yangi merge yoki release qayd etilmadi. Eng so‘nggi holatni [Live Engineering Pulse](./engineering-pulse.md) orqali ko‘ring.`,
  "",
];
const architecture = [
  "# Architecture Showcase",
  "",
  "> Quyidagi oqim public loyihalar uchun reference architecture sifatida berilgan. U private tizimlarning ichki tafsilotlarini ochmaydi.",
  "",
  "```mermaid",
  "flowchart LR",
  "  U[User] --> UI[React / Web UI]",
  "  UI --> CI[CI: typecheck, test, build]",
  "  UI --> API[Public integration / API boundary]",
  "  CI --> SEC[CodeQL / dependency checks]",
  "  SEC --> REL[Reviewed release]",
  "  REL --> OBS[Health and activity reports]",
  "```",
  "",
  "## Engineering boundaries",
  "",
  "- **Delivery:** CI va release workflowlari public repository holatini ko‘rsatadi.",
  "- **Security:** CodeQL, Dependabot va audit workflowlari kuzatiladi.",
  "- **Observability:** Live Pulse, Weekly Highlight va health reportlar faqat real GitHub signallaridan foydalanadi.",
  "- **Privacy:** private repository nomlari, ichki branchlar, tokenlar va secretlar public reportlarga chiqarilmaydi.",
  "",
];

await Promise.all([
  writeFile("profile/automation-report.md", report.join("\n"), "utf8"),
  writeFile("profile/engineering-dashboard.md", engineeringDashboard.join("\n"), "utf8"),
  writeFile("profile/achievement-log.md", `${["# GitHub Yutuqlar Jurnali", "", ...achievementLogEntries].join("\n")}\n`, "utf8"),
  writeFile("profile/automation-metrics.json", `${JSON.stringify(metrics, null, 2)}\n`, "utf8"),
  writeFile("profile/telegram-digest.txt", digest ? `${digest}\n` : "", "utf8"),
  writeFile("profile/engineering-pulse.md", pulse.join("\n"), "utf8"),
  writeFile("profile/building-in-public.md", timeline.join("\n"), "utf8"),
  writeFile("profile/project-health-cards.md", projectCards.join("\n"), "utf8"),
  writeFile("profile/release-radar.md", releaseRadar.join("\n"), "utf8"),
  writeFile("profile/weekly-highlight.md", weeklyHighlight.join("\n"), "utf8"),
  writeFile("profile/architecture-showcase.md", architecture.join("\n"), "utf8"),
]);
