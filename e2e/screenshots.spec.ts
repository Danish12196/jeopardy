import { test, expect, devices, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseBoardCsv } from "../src/lib/boardFile";
import { HOST_EMAIL, HOST_PASSWORD, seedPortfolioGame, userPb } from "./helpers";

// Re-takes every portfolio screenshot at the original sizes
// (desktop 1440x900 @2x, phone 393x660 @3x). Skipped unless SCREENSHOTS=1:
//   SCREENSHOTS=1 npm run e2e -- e2e/screenshots.spec.ts
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to re-take portfolio screenshots");

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const PHONE = { ...devices["Pixel 7"], viewport: { width: 393, height: 660 }, deviceScaleFactor: 3 };

const shot = async (page: Page, name: string, settle = 800) => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `portfolio/${name}.png` });
};

test("portfolio screenshots", async ({ browser }) => {
  test.setTimeout(180_000);
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const board = parseBoardCsv(readFileSync("samples/board.csv", "utf8"), "Friday Quiz").board!;
  const game = await seedPortfolioGame(api, "TRKT9N", board);
  const code = game.uniqueID;

  // Host: login, setup, dashboard.
  const hostCtx = await browser.newContext(DESKTOP);
  const host = await hostCtx.newPage();
  await host.goto("/login");
  await host.getByPlaceholder("Email").fill(HOST_EMAIL);
  await host.getByPlaceholder("Password").fill(HOST_PASSWORD);
  await shot(host, "00-login");
  await host.getByRole("button", { name: "Login" }).click();
  await expect(host.getByText("Lockout Game Setup")).toBeVisible();
  await host.getByRole("button", { name: "Team Pixel", exact: true }).click();
  await host.getByRole("button", { name: "Team Byte", exact: true }).click();
  await shot(host, "01-setup");

  await host.goto(`/game/${code}/host`);
  await expect(host.getByText("Host Dashboard")).toBeVisible();
  await shot(host, "02-host-board");

  // TV.
  const tvCtx = await browser.newContext(DESKTOP);
  const tv = await tvCtx.newPage();
  await tv.goto(`/game/${code}/board`);
  await expect(tv.getByTestId("tv-score-Team Pixel")).toBeVisible();
  await shot(tv, "03-tv-board", 1200);

  // Phone: join, pick team, locked.
  const phoneCtx = await browser.newContext(PHONE);
  const phone = await phoneCtx.newPage();
  await phone.goto("/game");
  await phone.getByPlaceholder("Enter Game Code").fill(code);
  await shot(phone, "mobile-01-join", 500);
  await phone.getByPlaceholder("Enter Game Code").press("Enter");
  await expect(phone.getByRole("button", { name: "Team Pixel", exact: true })).toBeVisible();
  await shot(phone, "mobile-02-pick-team", 600);
  await phone.getByRole("button", { name: "Team Pixel", exact: true }).click();
  await expect(phone.getByText("Locked. Waiting for the host.")).toBeVisible();
  await shot(phone, "mobile-03-buzzer-locked", 600);

  // A question: TV shows it, buzzers open, Team Pixel buzzes.
  await host.getByLabel("Auto-open on select").uncheck();
  await host.getByRole("button", { name: "300", exact: true }).first().click();
  await expect(tv.getByText("What do we call a rock from space")).toBeVisible();
  await shot(tv, "04-tv-question", 1500);
  await host.getByRole("button", { name: "Open buzzers" }).click();
  await expect(phone.getByRole("button", { name: "Buzz" })).toBeEnabled();
  await shot(phone, "mobile-04-buzzer-open", 1000);

  await phone.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByText("Buzz #1")).toBeVisible();
  await host.getByRole("button", { name: "Lock buzzers" }).click();
  await shot(host, "05-host-question-buzz");

  await host.getByRole("button", { name: "Correct: add points to Team Pixel" }).click();
  await host.getByRole("button", { name: "Reveal Answer on Board" }).click();
  await expect(tv.getByText("A meteorite")).toBeVisible();
  await shot(tv, "06-tv-answer", 1500);

  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await expect(host.getByTestId("host-score-Team Pixel")).toHaveText("300");
  await expect(tv.getByTestId("tv-score-Team Pixel")).toHaveText("300");
  await shot(tv, "07-tv-board-scored", 1500);
  await shot(host, "08-host-scored", 0);

  // Wildcard: Team Byte picks a hidden wager tile.
  await host.getByRole("button", { name: "Mark Wildcards" }).click();
  await host.getByRole("button", { name: "400", exact: true }).nth(2).click();
  await host.getByRole("button", { name: "Done marking Wildcards" }).click();
  await host.getByRole("button", { name: "400 Wildcard" }).click();
  await host.getByRole("group", { name: "Team playing the Wildcard" }).getByRole("button", { name: "Team Byte" }).click();
  await host.getByLabel("Wildcard wager").fill("500");
  await host.getByRole("button", { name: "Lock in wager" }).click();
  await expect(tv.getByText("Team Byte wagers 500")).toBeVisible();
  await shot(tv, "09-tv-wildcard", 1500);
  await host.getByRole("button", { name: "Right (+500)" }).click();
  await host.getByRole("button", { name: "Done (Back to Board)" }).click();
  await expect(host.getByTestId("host-score-Team Byte")).toHaveText("500");

  // All In: both teams wager, the TV reveals them lowest score first.
  const byteCtx = await browser.newContext(PHONE);
  const byte = await byteCtx.newPage();
  await byte.goto(`/game/${code}`);
  await byte.getByRole("button", { name: "Team Byte", exact: true }).click();

  await host.getByRole("button", { name: "All In", exact: true }).click();
  await host.getByLabel("All In category").fill("Famous Firsts");
  await host.getByLabel("All In question").fill("This was the first video ever uploaded to YouTube, in 2005.");
  await host.getByLabel("All In answer").fill("Me at the zoo");
  await host.getByRole("button", { name: "Open wagers" }).click();
  await expect(tv.getByTestId("tv-allin")).toContainText("Famous Firsts");

  await phone.getByLabel("Your wager (0 to 300)").fill("300");
  await shot(phone, "mobile-05-all-in-wager", 500);
  await phone.getByRole("button", { name: "Lock in wager" }).click();
  await expect(phone.getByTestId("phone-wager-locked")).toBeVisible();
  await byte.getByLabel("Your wager (0 to 500)").fill("200");
  await byte.getByRole("button", { name: "Lock in wager" }).click();
  await expect(host.getByTestId("allin-wager-count")).toHaveText("Wagers in: 2 of 2");

  await host.getByRole("button", { name: "Close wagers and show the question" }).click();
  await host.getByRole("button", { name: "Team Pixel right" }).click();
  await host.getByRole("button", { name: "Team Byte wrong" }).click();
  await host.getByRole("button", { name: "Start the reveal on the TV" }).click();
  await host.getByRole("button", { name: "Reveal Team Pixel" }).click();
  await host.getByRole("button", { name: "Reveal Team Byte" }).click();
  await expect(tv.getByTestId("allin-reveal-Team Byte")).toContainText("−200 → 300");
  await shot(tv, "10-tv-all-in-reveal", 1500);

  await host.getByRole("button", { name: "Show final standings" }).click();
  await expect(tv.getByTestId("tv-game-over")).toContainText("Team Pixel wins!");
  await shot(tv, "11-tv-game-over", 2000);
  await expect(phone.getByTestId("phone-game-over")).toBeVisible();
  await shot(phone, "mobile-06-game-over", 1000);

  await Promise.all([hostCtx.close(), tvCtx.close(), phoneCtx.close(), byteCtx.close()]);
});
