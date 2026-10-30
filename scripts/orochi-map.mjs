#!/usr/bin/env node
// Draws a GitHub-style contribution map of the commits Orochi landed for one person.
// Usage: node scripts/orochi-map.mjs --repo <path to the monorepo checkout> [--out <dir>]
// Writes orochi-map-light.svg and orochi-map-dark.svg. Needs git and an authenticated gh.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOGIN = "Nu11ified";
const EMAILS = new Set(["86795298+Nu11ified@users.noreply.github.com", "member:manas@orochi"]);
const WEEKS = 53;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
if (!args.repo) throw new Error("--repo <path> is required");
const outDir = args.out ?? process.cwd();

const git = (...a) => execFileSync("git", ["-C", args.repo, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });

git("fetch", "-q", "origin", "main");
const nwo = execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { cwd: args.repo, encoding: "utf8" }).trim();
const [owner, name] = nwo.split("/");

// One record per landed commit: date, author email, and the PRs a batch rollup carried.
const SEP = "\u001e";
const commits = git("log", "origin/main", "--committer=orochi", `--format=${SEP}%ad%x09%ae%x09%B`, "--date=short")
  .split(SEP)
  .filter(Boolean)
  .map((rec) => {
    const [date, email, ...body] = rec.split("\t");
    const batched = [...body.join("\t").matchAll(/^Batched-from: #(\d+)$/gm)].map((m) => Number(m[1]));
    return { date, email, batched };
  });

// A rollup is authored by the bot, so its members are credited to their PRs' authors.
async function prAuthors(numbers) {
  const authors = new Map();
  for (let i = 0; i < numbers.length; i += 100) {
    const chunk = numbers.slice(i, i + 100);
    const fields = chunk.map((n) => `p${n}: pullRequest(number: ${n}) { author { login } }`).join(" ");
    const query = `query { repository(owner: "${owner}", name: "${name}") { ${fields} } }`;
    const out = JSON.parse(execFileSync("gh", ["api", "graphql", "-f", `query=${query}`], { encoding: "utf8" }));
    for (const n of chunk) authors.set(n, out.data.repository[`p${n}`]?.author?.login);
  }
  return authors;
}

const authors = await prAuthors([...new Set(commits.flatMap((c) => c.batched))]);
const perDay = new Map();
for (const { date, email, batched } of commits) {
  const mine = EMAILS.has(email) ? 1 : batched.filter((n) => authors.get(n) === LOGIN).length;
  if (mine) perDay.set(date, (perDay.get(date) ?? 0) + mine);
}

const THEMES = {
  light: { bg: "#ffffff", text: "#59636e", levels: ["#eff2f5", "#aceebb", "#4ac26b", "#2da44e", "#116329"] },
  dark: { bg: "#0d1117", text: "#9198a1", levels: ["#151b23", "#033a16", "#196c2e", "#2ea043", "#56d364"] },
};
const CELL = 10;
const GAP = 3;
const LEFT = 28;
const TOP = 20;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(`${iso(new Date())}T00:00:00Z`);
const start = new Date(today);
start.setUTCDate(start.getUTCDate() - today.getUTCDay() - (WEEKS - 1) * 7);

const days = [];
for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) days.push(new Date(d));
const counts = days.map((d) => perDay.get(iso(d)) ?? 0);
const max = Math.max(1, ...counts);
const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
const total = counts.reduce((a, b) => a + b, 0);

function svg(theme) {
  const t = THEMES[theme];
  const width = LEFT + WEEKS * (CELL + GAP) + 4;
  const height = TOP + 7 * (CELL + GAP) + 28;
  const cells = days.map((d, i) => {
    const x = LEFT + Math.floor(i / 7) * (CELL + GAP);
    const y = TOP + d.getUTCDay() * (CELL + GAP);
    const n = counts[i];
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${t.levels[level(n)]}"><title>${n} commit${n === 1 ? "" : "s"} on ${iso(d)}</title></rect>`;
  });
  const months = days
    .filter((d, i) => d.getUTCDate() <= 7 && d.getUTCDay() === 0 && i >= 7)
    .map((d) => `<text x="${LEFT + (days.indexOf(d) / 7) * (CELL + GAP)}" y="${TOP - 7}">${MONTHS[d.getUTCMonth()]}</text>`);
  const weekdays = [["Mon", 1], ["Wed", 3], ["Fri", 5]].map(([label, row]) => `<text x="0" y="${TOP + row * (CELL + GAP) + 9}">${label}</text>`);
  const legendX = width - 5 * (CELL + GAP) - 34;
  const legendY = TOP + 7 * (CELL + GAP) + 10;
  const legend = t.levels.map((c, i) => `<rect x="${legendX + i * (CELL + GAP)}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="9" fill="${t.text}">
<rect width="100%" height="100%" fill="${t.bg}"/>
${months.join("\n")}
${weekdays.join("\n")}
${cells.join("\n")}
<text x="${LEFT}" y="${legendY + 9}">${total} commits landed through Orochi in the last year</text>
<text x="${legendX - 26}" y="${legendY + 9}">Less</text>
${legend.join("\n")}
<text x="${legendX + 5 * (CELL + GAP) + 2}" y="${legendY + 9}">More</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
for (const theme of Object.keys(THEMES)) writeFileSync(join(outDir, `orochi-map-${theme}.svg`), svg(theme));
console.log(`${total} commits over ${perDay.size} days`);
