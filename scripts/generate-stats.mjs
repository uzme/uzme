import fs from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "uzme";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");

const query = `
query ProfileStats($login: String!) {
  user(login: $login) {
    name
    login
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      nodes {
        name
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
    pullRequests(first: 1) { totalCount }
    issues(first: 1) { totalCount }
    starredRepositories { totalCount }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "uzme-profile-stats"
  },
  body: JSON.stringify({ query, variables: { login: username } })
});
if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map((e) => e.message).join("; "));
const user = payload.data.user;
if (!user) throw new Error(`GitHub user not found: ${username}`);

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const color = (value, fallback = "#68e0c2") => /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
const font = "font-family='Inter,Arial,sans-serif'";
const out = "profile";
await fs.mkdir(out, { recursive: true });

const languages = new Map();
for (const repo of user.repositories.nodes) {
  for (const edge of repo.languages.edges) {
    const current = languages.get(edge.node.name) || { size: 0, color: color(edge.node.color, "#68e0c2") };
    current.size += edge.size;
    languages.set(edge.node.name, current);
  }
}
const languageRows = [...languages.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 6);
const totalBytes = languageRows.reduce((sum, [, item]) => sum + item.size, 0) || 1;

const days = user.contributionsCollection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);
const totalContributions = user.contributionsCollection.contributionCalendar.totalContributions;
let currentStreak = 0;
for (let i = days.length - 1; i >= 0; i -= 1) {
  if (days[i].contributionCount > 0) currentStreak += 1;
  else if (currentStreak > 0) break;
}
let longestStreak = 0;
let run = 0;
for (const day of days) {
  if (day.contributionCount > 0) { run += 1; longestStreak = Math.max(longestStreak, run); }
  else run = 0;
}
const repoCount = user.repositories.nodes.length;
const prCount = user.pullRequests.totalCount;
const issueCount = user.issues.totalCount;
const starCount = user.starredRepositories.totalCount;

const base = (title, subtitle, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#14212b"/><stop offset="1" stop-color="#0d151f"/></linearGradient></defs><rect width="520" height="220" rx="16" fill="url(#bg)" stroke="#243444"/><text x="28" y="36" fill="#68e0c2" font-size="12" letter-spacing="1.5" ${font}>${esc(subtitle).toUpperCase()}</text><text x="28" y="67" fill="#f2fffb" font-size="22" font-weight="700" ${font}>${esc(title)}</text>${body}</svg>`;

const statsBody = `<text x="28" y="108" fill="#8fb7ba" font-size="12" ${font}>PUBLIC PROFILE OVERVIEW</text><text x="28" y="142" fill="#f2fffb" font-size="26" font-weight="800" ${font}>${esc(totalContributions)}</text><text x="28" y="161" fill="#8fb7ba" font-size="11" ${font}>contributions this year</text><text x="180" y="142" fill="#f2fffb" font-size="22" font-weight="800" ${font}>${esc(repoCount)}</text><text x="180" y="161" fill="#8fb7ba" font-size="11" ${font}>public repositories</text><text x="328" y="142" fill="#f2fffb" font-size="22" font-weight="800" ${font}>${esc(prCount)}</text><text x="328" y="161" fill="#8fb7ba" font-size="11" ${font}>pull requests</text><text x="28" y="197" fill="#81cfff" font-size="11" ${font}>${esc(username)} · ${esc(starCount)} starred repositories · ${esc(issueCount)} issues</text>`;
await fs.writeFile(`${out}/stats.svg`, base("GitHub activity", "overview", statsBody));

let x = 28;
const barWidth = 464;
const bar = languageRows.map(([, item]) => Math.max(3, (item.size / totalBytes) * barWidth));
const rects = [];
for (let i = 0; i < bar.length; i += 1) {
  rects.push(`<rect x="${x.toFixed(1)}" y="105" width="${bar[i].toFixed(1)}" height="14" fill="${languageRows[i][1].color}"/>`);
  x += bar[i];
}
const legend = languageRows.map(([name, item], i) => {
  const pct = ((item.size / totalBytes) * 100).toFixed(1);
  const col = i % 2 === 0 ? 28 : 275;
  const row = 148 + Math.floor(i / 2) * 25;
  return `<circle cx="${col}" cy="${row - 4}" r="4" fill="${item.color}"/><text x="${col + 10}" y="${row}" fill="#d7fff5" font-size="12" ${font}>${esc(name)} ${pct}%</text>`;
}).join("");
await fs.writeFile(`${out}/languages.svg`, base("Most used languages", "languages", rects.join("") + legend));

const streakBody = `<text x="28" y="116" fill="#8fb7ba" font-size="12" ${font}>CURRENT STREAK</text><text x="28" y="151" fill="#f2fffb" font-size="34" font-weight="800" ${font}>${esc(currentStreak)} days</text><text x="270" y="116" fill="#8fb7ba" font-size="12" ${font}>LONGEST STREAK</text><text x="270" y="151" fill="#f2fffb" font-size="34" font-weight="800" ${font}>${esc(longestStreak)} days</text><text x="28" y="193" fill="#68e0c2" font-size="12" ${font}>${esc(totalContributions)} total contributions in the latest year</text>`;
await fs.writeFile(`${out}/streak.svg`, base("Contribution streak", "consistency", streakBody));

const recent = days.slice(-52);
const max = Math.max(...recent.map((d) => d.contributionCount), 1);
const points = recent.map((day, i) => `${(28 + i * (464 / Math.max(recent.length - 1, 1))).toFixed(1)},${(185 - (day.contributionCount / max) * 95).toFixed(1)}`).join(" ");
const dots = recent.map((day, i) => `<circle cx="${(28 + i * (464 / Math.max(recent.length - 1, 1))).toFixed(1)}" cy="${(185 - (day.contributionCount / max) * 95).toFixed(1)}" r="2.5" fill="#68e0c2"/>`).join("");
const activity = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="240" viewBox="0 0 1040 240"><rect width="1040" height="240" rx="16" fill="#0d151f" stroke="#243444"/><text x="30" y="38" fill="#68e0c2" font-size="12" letter-spacing="1.5" ${font}>TIMELINE</text><text x="30" y="70" fill="#f2fffb" font-size="22" font-weight="700" ${font}>Contribution activity</text><g stroke="#243444" stroke-width="1">${[90,115,140,165,190].map((y) => `<line x1="30" y1="${y}" x2="1010" y2="${y}"/>`).join("")}</g><polyline points="${points.replaceAll(/(\d+\.\d+),(\d+\.\d+)/g, (m, px, py) => `${px},${Number(py) - 30}`)}" fill="none" stroke="#68e0c2" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${dots.replaceAll(/cy="(\d+\.\d+)"/g, (m, py) => `cy="${Number(py) - 30}"`)}<text x="30" y="220" fill="#8fb7ba" font-size="11" ${font}>last 52 weeks · generated from GitHub contributions</text></svg>`;
await fs.writeFile(`${out}/activity.svg`, activity);
console.log(`Generated cards for ${username}: ${out}/stats.svg, ${out}/languages.svg, ${out}/streak.svg, ${out}/activity.svg`);
