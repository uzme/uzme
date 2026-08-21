import { writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "uzme";
const token = process.env.GITHUB_TOKEN;
const flagshipRepositories = [
  "bahromjon-portfolio",
  "biolab-interactive-guide",
  "developer-portfolio",
];

if (!token) {
  throw new Error("GITHUB_TOKEN is required to generate the automation report.");
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

const repositories = await Promise.all(flagshipRepositories.map(async (name) => {
  const [repository, runs] = await Promise.all([
    github(`/repos/${owner}/${name}`),
    github(`/repos/${owner}/${name}/actions/runs?per_page=1`),
  ]);
  const latestRun = runs.workflow_runs?.[0];
  return {
    name,
    updatedAt: repository.updated_at,
    visibility: repository.visibility,
    archived: repository.archived,
    defaultBranch: repository.default_branch,
    workflow: latestRun?.name || "Workflow hali ishga tushmagan",
    conclusion: latestRun?.conclusion || latestRun?.status || "Noma’lum",
    runUrl: latestRun?.html_url || `https://github.com/${owner}/${name}/actions`,
  };
}));

const statusIcon = (status) => status === "success" ? "PASS" : status === "failure" ? "CHECK" : "PENDING";
const report = [
  "# GitHub Automation Report",
  "",
  `> Oxirgi avtomatik yangilanish: ${new Date().toISOString()} (UTC).`,
  "",
  "Bu fayl GitHub Actions orqali haftalik yangilanadi. Unda faqat public loyiha holati jamlanadi; tokenlar, secretlar yoki shaxsiy ma’lumotlar yozilmaydi.",
  "",
  "| Repository | Visibility | So‘nggi workflow | Holat | Yangilangan vaqt |",
  "|---|---|---|---|---|",
  ...repositories.map((repository) => `| [${repository.name}](https://github.com/${owner}/${repository.name}) | ${repository.visibility} | [${repository.workflow}](${repository.runUrl}) | ${statusIcon(repository.conclusion)} — ${repository.conclusion} | ${repository.updatedAt} |`),
  "",
  "## Automation qamrovi",
  "",
  "Flagship repository’larda build/typecheck/test workflowlari, Dependabot yangilanishlari va CodeQL security scanlari ishga tushadi. Faqat `main` branch, pull request yoki rejalashtirilgan tekshiruvlarda ishlaydigan minimal permission qoidalari qo‘llanadi.",
  "",
  "## Tashqi bildirishnoma",
  "",
  "Agar `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` repository secretlari sozlansa, ushbu haftalik hisobot yakunida Telegram’ga qisqa status xabari yuboriladi. Secretlar hech qachon report yoki workflow logiga chiqarilmaydi.",
  "",
];

await writeFile("profile/automation-report.md", report.join("\n"), "utf8");
