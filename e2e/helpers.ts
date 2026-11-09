import { expect, devices, type Browser, type BrowserContext, type Page } from "@playwright/test";
import PocketBase from "pocketbase";

// Seeded by scripts/seed-test.mjs.
export const HOST_EMAIL = process.env.SEED_USER_EMAIL || "host@lockout.test";
export const HOST_PASSWORD = process.env.SEED_USER_PASSWORD || "lockout-host-password";
export const TEMPLATE_TITLE = "Test Board";
export const TEAMS = ["Team 1", "Team 2", "Team 3", "Team 4"];

export const PB_URL = process.env.PB_URL!;

/** A PocketBase client logged in as the test superuser. */
export async function adminPb() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(process.env.PB_SUPERUSER_EMAIL!, process.env.PB_SUPERUSER_PASSWORD!);
  return pb;
}

/** A PocketBase client with no login, like a phone buzzer. */
export function guestPb() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  return pb;
}

/** A PocketBase client logged in as a regular user. */
export async function userPb(email: string, password: string) {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection("users").authWithPassword(email, password);
  return pb;
}

/** Creates (or reuses) a regular user account and returns a logged-in client. */
export async function makeUser(email: string, password = "lockout-other-password") {
  const admin = await adminPb();
  try {
    await admin.collection("users").getFirstListItem(`email = "${email}"`);
  } catch {
    await admin.collection("users").create({ email, password, passwordConfirm: password, verified: true });
  }
  return userPb(email, password);
}

export async function loginAsHost(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(HOST_EMAIL);
  await page.getByPlaceholder("Password").fill(HOST_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("Lockout Game Setup")).toBeVisible();
}

/** Picks teams and the seeded template on the setup page, starts a game, returns its code. */
export async function createGameViaUI(page: Page, teams: string[] = TEAMS.slice(0, 2), template = TEMPLATE_TITLE) {
  for (const t of teams) await page.getByRole("button", { name: t, exact: true }).click();
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: new RegExp(`^${template}`) }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.waitForURL(/\/game\/[A-Z0-9]+\/host$/);
  const code = page.url().match(/\/game\/([A-Z0-9]+)\/host$/)![1];
  await expect(page.getByText("Host Dashboard")).toBeVisible();
  return code;
}

export async function openTv(browser: Browser, code: string) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`/game/${code}/board`);
  return { ctx, page };
}

/** Opens a phone buzzer in its own browser context and picks a team. */
export async function openBuzzer(browser: Browser, code: string, team: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  await page.goto(`/game/${code}`);
  await page.getByRole("button", { name: team, exact: true }).click();
  await expect(page.getByText(`Team: ${team}`)).toBeVisible();
  return { ctx, page };
}

/** Host opens the first unused tile with auto-open switched off. */
export async function hostOpenFirstQuestion(host: Page) {
  const auto = host.getByLabel("Auto-open on select");
  if (await auto.isChecked()) await auto.uncheck();
  await host.getByRole("button", { name: "100", exact: true }).first().click();
  await expect(host.getByText("Answer", { exact: true })).toBeVisible();
}

/** Creates a game straight through the API as the given user, returns the record. */
export async function createGameViaApi(pb: PocketBase, teamNames: string[] = TEAMS) {
  const teams = await pb.collection("teams").getFullList({ filter: pb.filter("user = {:u}", { u: pb.authStore.record!.id }) });
  const ids = teamNames.map((n) => teams.find((t) => t.name === n)!.id);
  const template = await pb.collection("game_templates").getFirstListItem(pb.filter("title = {:t}", { t: TEMPLATE_TITLE }));
  const code = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  return pb.collection("games").create({
    title: `Game: ${TEMPLATE_TITLE}`,
    uniqueID: code,
    template: template.id,
    host: pb.authStore.record!.id,
    teams: ids,
    teamScores: ids.map((id) => ({ id, score: 0 })),
    answeredQuestions: [],
    buzzRound: 0,
    buzzerUnlocked: false,
  });
}

/** Expects a PocketBase call to be refused (any 4xx). */
export async function expectRejected(p: Promise<unknown>) {
  let status = 0;
  try {
    await p;
  } catch (err: any) {
    status = err?.status ?? -1;
  }
  expect(status, "request should have been rejected").toBeGreaterThanOrEqual(400);
  expect(status).toBeLessThan(500);
}

/**
 * Seeds the portfolio game: the 6x5 "Friday Quiz" board from samples/board.csv
 * and two teams, Team Pixel and Team Byte. Used by the screenshot and demo
 * video specs. Returns the game record.
 */
export async function seedPortfolioGame(api: PocketBase, code: string, board: { categories: { name: string; questions: Record<string, unknown>[] }[] }) {
  const me = api.authStore.record!.id;
  const catIds: string[] = [];
  const qIds: string[] = [];
  for (const c of board.categories) {
    const cat = await api.collection("question_categories").create({ name: c.name, user: me, isPublic: true });
    catIds.push(cat.id);
    for (const [i, q] of c.questions.entries()) {
      qIds.push((await api.collection("questions").create({ ...q, difficulty: i + 1, category: cat.id, user: me, isPublic: true })).id);
    }
  }
  const tpl = await api.collection("game_templates").create({ title: "Friday Quiz", categories: catIds, questions: qIds, user: me, isPublic: true });
  const pixel = await api.collection("teams").create({ name: "Team Pixel", user: me });
  const byte = await api.collection("teams").create({ name: "Team Byte", user: me });
  return api.collection("games").create({
    uniqueID: code, title: "Game: Friday Quiz", template: tpl.id, host: me, teams: [pixel.id, byte.id],
    teamScores: [{ id: pixel.id, score: 0 }, { id: byte.id, score: 0 }], answeredQuestions: [], buzzRound: 0,
  });
}
