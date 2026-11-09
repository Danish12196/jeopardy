import { test, expect, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseBoardCsv } from "../src/lib/boardFile";
import { HOST_EMAIL, HOST_PASSWORD, loginAsHost, userPb } from "./helpers";

// Re-takes the portfolio screenshots that v2 changed, at the original sizes
// (desktop 1440x900 @2x, phone 393x660 @3x). Skipped unless SCREENSHOTS=1:
//   SCREENSHOTS=1 npm run e2e -- e2e/screenshots.spec.ts
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to re-take portfolio screenshots");

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const PHONE = { ...devices["Pixel 7"], viewport: { width: 393, height: 660 }, deviceScaleFactor: 3 };

test("portfolio screenshots", async ({ browser }) => {
  test.setTimeout(120_000);
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const me = api.authStore.record!.id;

  // A 6x5 board from the sample and two named teams.
  const board = parseBoardCsv(readFileSync("samples/board.csv", "utf8"), "Friday Quiz").board!;
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
  const game = await api.collection("games").create({
    uniqueID: "TRKT9N", title: "Game: Friday Quiz", template: tpl.id, host: me, teams: [pixel.id, byte.id],
    teamScores: [{ id: pixel.id, score: 0 }, { id: byte.id, score: 0 }], answeredQuestions: [], buzzRound: 0,
  });

  const hostCtx = await browser.newContext(DESKTOP);
  const host = await hostCtx.newPage();
  await loginAsHost(host);
  await host.getByRole("button", { name: "Team Pixel", exact: true }).click();
  await host.getByRole("button", { name: "Team Byte", exact: true }).click();
  await host.waitForTimeout(800);
  await host.screenshot({ path: "portfolio/01-setup.png" });

  await host.goto(`/game/${game.uniqueID}/host`);
  await expect(host.getByText("Host Dashboard")).toBeVisible();
  await host.waitForTimeout(800);
  await host.screenshot({ path: "portfolio/02-host-board.png" });

  const phoneCtx = await browser.newContext(PHONE);
  const phone = await phoneCtx.newPage();
  await phone.goto(`/game/${game.uniqueID}`);
  await phone.getByRole("button", { name: "Team Pixel", exact: true }).click();
  await expect(phone.getByText("Locked. Waiting for the host.")).toBeVisible();
  await phone.waitForTimeout(600);
  await phone.screenshot({ path: "portfolio/mobile-03-buzzer-locked.png" });

  await host.getByLabel("Auto-open on select").uncheck();
  await host.getByRole("button", { name: "300", exact: true }).first().click();
  await host.getByRole("button", { name: "Open buzzers" }).click();
  await expect(phone.getByRole("button", { name: "Buzz" })).toBeEnabled();
  await phone.waitForTimeout(1000);
  await phone.screenshot({ path: "portfolio/mobile-04-buzzer-open.png" });

  await phone.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByText("Buzz #1")).toBeVisible();
  await host.getByRole("button", { name: "Lock buzzers" }).click();
  await host.waitForTimeout(800);
  await host.screenshot({ path: "portfolio/05-host-question-buzz.png" });

  await host.getByRole("button", { name: "Correct: add points to Team Pixel" }).click();
  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await expect(host.getByTestId("host-score-Team Pixel")).toHaveText("300");
  await host.waitForTimeout(800);
  await host.screenshot({ path: "portfolio/08-host-scored.png" });

  await Promise.all([hostCtx.close(), phoneCtx.close()]);
});
