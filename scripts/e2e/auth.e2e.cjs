// Full auth + app journey against a local Supabase Auth (GoTrue) + PostgREST
// stack. Run via scripts/test-e2e.sh, which starts everything it needs.
//   E2E_MAIL     JSON-lines file written by the SMTP sink
//   E2E_BASE     app URL (default http://localhost:3300)
//   CHROME_PATH  Chromium/Chrome executable
const { chromium } = require("playwright-core");
const fs = require("fs");
const MAIL = process.env.E2E_MAIL;
const BASE = process.env.E2E_BASE || "http://localhost:3300";
const email = `user${Date.now()}@example.com`;
const pw1 = "correct-horse-battery";
const pw2 = "new-password-staple-42";
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
function lastLink(to, type) {
  const msgs = fs.readFileSync(MAIL, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter((x) => x.to.join(" ").includes(to));
  for (const m of msgs.reverse()) {
    const body = decodeQP(m.body).replace(/&amp;/g, "&");
    const l = [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((x) => x[0]).find((u) => u.includes("verify") && u.includes(`type=${type}`));
    if (l) return l;
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const cspViolations = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(48)} ${detail ?? ""}`);
  if (!ok) failures++;
};
const text = async (p, sel) => (await p.locator(sel).allInnerTexts()).join(" | ");

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const device = async () => {
    const c = await b.newContext();
    const p = await c.newPage();
    p.on("pageerror", (e) => console.log("  pageerror:", String(e)));
    p.on("console", (m) => {
      if (/Content Security Policy/i.test(m.text())) cspViolations.push(m.text());
    });
    return p;
  };

  // 1. Sign up on a laptop
  const laptop = await device();
  await laptop.goto(BASE + "/signup");
  await laptop.fill("input[type=email]", email);
  await laptop.fill("input[type=password]", pw1);
  await laptop.click("button[type=submit]");
  await laptop.waitForSelector("[role=status]", { timeout: 10000 });
  check("signup shows 'confirmation link sent'", /sent a confirmation link/.test(await text(laptop, "[role=status]")));
  await sleep(500);
  const confirmLink = lastLink(email, "signup");
  check("confirmation email delivered", !!confirmLink);

  // 2. Open the link on a different device (phone)
  const phone = await device();
  await phone.goto(confirmLink);
  await phone.waitForURL(/\/welcome/, { timeout: 15000 }).catch(() => {});
  check("link on another device signs in -> /welcome", phone.url().endsWith("/welcome"), phone.url().replace(BASE, ""));

  // 3. Reusing the same link
  const tablet = await device();
  await tablet.goto(confirmLink);
  await tablet.waitForSelector("h1", { timeout: 10000 });
  check("reused link explains it expired", /expired or was already used/.test(await text(tablet, "h1")), await text(tablet, "h1"));

  // 4. Repeat sign-up with the same email
  const other = await device();
  await other.goto(BASE + "/signup");
  await other.fill("input[type=email]", email);
  await other.fill("input[type=password]", pw1);
  await other.click("button[type=submit]");
  await other.waitForSelector("[role=status]", { timeout: 10000 });
  check("repeat signup says account exists", /already exists/.test(await text(other, "[role=status]")));

  // 5. Wrong password
  await other.goto(BASE + "/login");
  await other.fill("input[type=email]", email);
  await other.fill("input[type=password]", "wrong-password-123");
  await other.click("button[type=submit]");
  await other.waitForSelector("text=Incorrect email or password", { timeout: 10000 }).catch(() => {});
  check("wrong password -> clear error", /Incorrect email or password/.test(await text(other, "[role=alert]")));

  // 6. Password reset requested on one device, completed on another
  await other.goto(BASE + "/forgot-password");
  await other.fill("input[type=email]", email);
  await other.click("button[type=submit]");
  await other.waitForSelector("[role=status]", { timeout: 10000 });
  await sleep(500);
  const resetLink = lastLink(email, "recovery");
  check("reset email delivered", !!resetLink);
  const phone2 = await device();
  await phone2.goto(resetLink);
  await phone2.waitForURL(/\/reset-password/, { timeout: 15000 }).catch(() => {});
  check("reset link on another device -> /reset-password", phone2.url().endsWith("/reset-password"), phone2.url().replace(BASE, ""));
  await phone2.fill("input[type=password]", pw2);
  await phone2.click("button[type=submit]");
  await phone2.waitForURL((u) => !u.pathname.startsWith("/reset-password"), { timeout: 15000 }).catch(() => {});
  check("new password saved, still signed in", /^\/(welcome)?$/.test(new URL(phone2.url()).pathname), phone2.url().replace(BASE, ""));

  // 7. Sign in with the new password on a fresh device, load demo, use the app
  const desk = await device();
  await desk.goto(BASE + "/login");
  await desk.fill("input[type=email]", email);
  await desk.fill("input[type=password]", pw2);
  await desk.click("button[type=submit]");
  await desk.waitForURL(/\/welcome/, { timeout: 15000 }).catch(() => {});
  check("login with new password -> /welcome", desk.url().endsWith("/welcome"), desk.url().replace(BASE, ""));
  await desk.click("text=Load demo workspace");
  await desk.waitForURL((u) => u.pathname === "/", { timeout: 60000 }).catch(() => {});
  await desk.waitForSelector("text=Overall progress", { timeout: 30000 }).catch(() => {});
  check("demo loaded, overview renders", /Overall progress/i.test(await desk.content()), desk.url().replace(BASE, ""));
  await desk.keyboard.press("n");
  await desk.fill('input[placeholder^="e.g. Built"]', "E2E logged activity");
  await desk.locator("dialog[open] button[type=submit]").click();
  await desk.waitForSelector("text=Activity logged", { timeout: 15000 }).catch(() => {});
  check("quick-add activity saved", /Activity logged/.test(await desk.content()));
  for (const path of ["/evolution", "/skills", "/goals", "/projects", "/activity", "/insights", "/settings"]) {
    const r = await desk.goto(BASE + path);
    const bad = /This page couldn.t load|Application error/.test(await desk.content());
    check(`page ${path} renders`, r.status() === 200 && !bad, String(r.status()));
  }
  // 8. Old password must no longer work
  const old = await device();
  await old.goto(BASE + "/login");
  await old.fill("input[type=email]", email);
  await old.fill("input[type=password]", pw1);
  await old.click("button[type=submit]");
  await old.waitForSelector("text=Incorrect email or password", { timeout: 10000 }).catch(() => {});
  check("old password rejected after reset", /Incorrect email or password/.test(await text(old, "[role=alert]")));

  check("no Content-Security-Policy violations", cspViolations.length === 0, cspViolations[0]);
  await b.close();
  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("E2E crashed:", e.message);
  process.exit(2);
});
