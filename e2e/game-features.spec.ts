import { test, expect } from "@playwright/test";
import { HOST_EMAIL, HOST_PASSWORD, TEAMS, createGameViaApi, expectRejected, guestPb, loginAsHost, openBuzzer, openTv, userPb } from "./helpers";

async function setup(page: import("@playwright/test").Page, teams = TEAMS.slice(0, 2)) {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, teams);
  await loginAsHost(page);
  await page.goto(`/game/${game.uniqueID}/host`);
  await expect(page.getByText("Host Dashboard")).toBeVisible();
  return { api, game };
}

test("undo and manual score adjust", async ({ page: host }) => {
  await setup(host);
  const score = host.getByTestId("host-score-Team 1");
  const undo = host.getByRole("button", { name: "Undo last score change" });
  await expect(undo).toBeDisabled();

  await host.getByRole("button", { name: "Correct: add points to Team 1" }).click();
  await expect(score).toHaveText("100");
  await host.getByLabel("Adjust Team 1's score by").fill("-250");
  await host.getByRole("button", { name: "Apply adjustment to Team 1" }).click();
  await expect(score).toHaveText("-150");

  await undo.click();
  await expect(score).toHaveText("100");
  // History survives a reload.
  await host.reload();
  await host.getByRole("button", { name: "Undo last score change" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("0");
  await expect(host.getByRole("button", { name: "Undo last score change" })).toBeDisabled();
});

test("Wildcard: only the choosing team plays, wager capped", async ({ page: host, browser }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { teamScores: [{ id: game.teams[0], score: 200 }, { id: game.teams[1], score: 0 }] });
  const tv = await openTv(browser, game.uniqueID);
  const phone = await openBuzzer(browser, game.uniqueID, "Team 2");

  await host.getByRole("button", { name: "Mark Wildcards" }).click();
  await host.getByRole("button", { name: "200", exact: true }).first().click();
  await expect(host.getByRole("button", { name: "200 Wildcard" })).toBeVisible();
  await host.getByRole("button", { name: "Done marking Wildcards" }).click();
  // The TV doesn't give it away.
  await expect(tv.page.getByText("Wildcard")).toHaveCount(0);

  await host.getByRole("button", { name: "200 Wildcard" }).click();
  await expect(tv.page.getByTestId("tv-wildcard")).toBeVisible();
  await expect(phone.page.getByRole("button", { name: "Locked" })).toBeVisible();

  const group = host.getByRole("group", { name: "Team playing the Wildcard" });
  await group.getByRole("button", { name: "Team 1" }).click();
  // Team 1 has 200, the board's top value is 300, so the cap is 300.
  await host.getByLabel("Wildcard wager").fill("5000");
  await host.getByRole("button", { name: "Lock in wager" }).click();
  await expect(tv.page.getByText("Team 1 wagers 300")).toBeVisible();
  await host.getByRole("button", { name: "Right (+300)" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("500");
  await expect(tv.page.getByTestId("tv-score-Team 1")).toHaveText("500");

  // Undo puts the score back and reopens Right/Wrong, so the host can correct it.
  await host.getByRole("button", { name: "Undo last score change" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("200");
  await host.getByRole("button", { name: "Wrong (−300)" }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("-100");

  await Promise.all([tv.ctx.close(), phone.ctx.close()]);
});

test("All In: hidden wagers, right/wrong, one-by-one reveal, game over", async ({ page: host, browser }) => {
  const { api, game } = await setup(host);
  await api.collection("games").update(game.id, { teamScores: [{ id: game.teams[0], score: 400 }, { id: game.teams[1], score: 600 }] });
  const tv = await openTv(browser, game.uniqueID);
  const p1 = await openBuzzer(browser, game.uniqueID, "Team 1");
  const p2 = await openBuzzer(browser, game.uniqueID, "Team 2");

  await host.getByRole("button", { name: "All In", exact: true }).click();
  await host.getByLabel("All In category").fill("Capitals");
  await host.getByLabel("All In question").fill("What is the capital of Australia?");
  await host.getByLabel("All In answer").fill("Canberra");
  await host.getByRole("button", { name: "Open wagers" }).click();
  await expect(tv.page.getByTestId("tv-allin")).toContainText("Capitals");
  await expect(tv.page.getByTestId("tv-allin")).not.toContainText("Australia");

  await p1.page.getByLabel("Your wager (0 to 400)").fill("9999");
  await p1.page.getByRole("button", { name: "Lock in wager" }).click();
  await expect(p1.page.getByTestId("phone-wager-locked")).toHaveText("Wager locked in: 400");
  await p2.page.getByLabel("Your wager (0 to 600)").fill("250");
  await p2.page.getByRole("button", { name: "Lock in wager" }).click();
  await expect(host.getByTestId("allin-wager-count")).toHaveText("Wagers in: 2 of 2");

  // Wagers are hidden from guests until the reveal.
  expect(await guestPb().collection("wagers").getFullList({ filter: `game = "${game.id}"` })).toHaveLength(0);
  await expectRejected(guestPb().collection("wagers").create({ game: game.id, team: game.teams[0], amount: 1 }));

  await host.getByRole("button", { name: "Close wagers and show the question" }).click();
  await expect(tv.page.getByText("What is the capital of Australia?")).toBeVisible();
  // Wagers are closed now.
  await expectRejected(guestPb().collection("wagers").create({ game: game.id, team: game.teams[1], amount: 1 }));

  await host.getByRole("button", { name: "Team 1 right" }).click();
  await host.getByRole("button", { name: "Team 2 wrong" }).click();
  await host.getByRole("button", { name: "Start the reveal on the TV" }).click();

  // Lowest score first.
  await host.getByRole("button", { name: "Reveal Team 1" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 1")).toContainText("+400 → 800");
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toHaveCount(0);
  await host.getByRole("button", { name: "Reveal Team 2" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toContainText("−250 → 350");

  // Undo takes the last reveal back off the TV as well as the score.
  await host.getByRole("button", { name: "Undo last score change" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toHaveCount(0);
  await host.getByRole("button", { name: "Reveal Team 2" }).click();
  await expect(tv.page.getByTestId("allin-reveal-Team 2")).toContainText("−250 → 350");

  await host.getByRole("button", { name: "Show final standings" }).click();
  const over = tv.page.getByTestId("tv-game-over");
  await expect(over).toContainText("Team 1 wins!");
  await expect(over.locator("li").first()).toContainText("Team 1");
  await expect(p2.page.getByTestId("phone-game-over")).toContainText("You finished #2 with 350");

  await Promise.all([tv.ctx.close(), p1.ctx.close(), p2.ctx.close()]);
});

test("Game rules settings: 2x multiplier, half wrong penalty, and steal/pass", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");
  await host.getByRole("button", { name: "Team 1" }).click();
  await host.getByRole("button", { name: "Team 2" }).click();

  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();

  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByLabel("Wrong Answer Penalty").click();
  await host.getByRole("option", { name: "Half value (−50%)" }).click();
  await host.getByLabel("Point Multiplier").click();
  await host.getByRole("option", { name: "2× (Double)" }).click();
  await host.getByRole("switch", { name: "Steal / Pass on Wrong" }).click();

  await host.getByRole("button", { name: "Start Game" }).click();
  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  // 100-point row is now 200 because of 2x multiplier.
  await expect(host.getByRole("button", { name: "200", exact: true }).first()).toBeVisible();

  const tv = await openTv(browser, uniqueID);
  const p1 = await openBuzzer(browser, uniqueID, "Team 1");
  const p2 = await openBuzzer(browser, uniqueID, "Team 2");

  await host.getByRole("button", { name: "200", exact: true }).first().click();
  await p1.page.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByTestId("host-buzz-queue")).toContainText("Team 1");
  await p2.page.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByTestId("host-buzz-queue")).toContainText("Team 2");

  // Team 1 answers wrong -> half penalty (-100) and passed to Team 2 (#1 in queue).
  await host.getByRole("button", { name: /Wrong: take points from Team 1/ }).click();
  await expect(host.getByTestId("host-score-Team 1")).toHaveText("-100");
  await expect(host.getByTestId("host-buzz-queue").locator("li").first()).toContainText("Team 2");

  // Team 2 answers right -> +200.
  await host.getByRole("button", { name: "Correct: add points to Team 2" }).click();
  await expect(host.getByTestId("host-score-Team 2")).toHaveText("200");
  await expect(tv.page.getByTestId("tv-score-Team 2")).toHaveText("200");

  await Promise.all([tv.ctx.close(), p1.ctx.close(), p2.ctx.close()]);
});

test("Question timers: buzz timer auto-starts on TV and phone, host can pause, resume, and clear", async ({ page: host, browser }) => {
  await loginAsHost(host);
  await host.goto("/");
  await host.getByRole("button", { name: "Team 1" }).click();
  await host.getByRole("combobox").click();
  await host.getByRole("option", { name: /Test Board/ }).click();

  await host.getByRole("button", { name: /Game Rules & Settings/ }).click();
  await host.getByLabel("Buzz Window Timer (seconds, 0 = off)").fill("15");

  await host.getByRole("button", { name: "Start Game" }).click();
  await expect(host).toHaveURL(/\/game\/[A-Z0-9]+\/host/);
  const uniqueID = host.url().match(/\/game\/([A-Z0-9]+)\/host/)![1];

  const tv = await openTv(browser, uniqueID);
  const phone = await openBuzzer(browser, uniqueID, "Team 1");

  await host.getByRole("button", { name: "100", exact: true }).first().click();

  // Timer is visible on host, TV, and phone.
  await expect(host.getByTestId("game-timer")).toContainText("Buzz");
  await expect(tv.page.getByTestId("game-timer")).toContainText("Buzz");
  await expect(phone.page.getByTestId("game-timer")).toContainText("Buzz");

  // Host can pause and resume.
  await host.getByRole("button", { name: "Pause Timer" }).click();
  await expect(host.getByTestId("game-timer")).toContainText("(Paused)");
  await expect(tv.page.getByTestId("game-timer")).toContainText("(Paused)");

  await host.getByRole("button", { name: "Resume Timer" }).click();
  await expect(host.getByTestId("game-timer")).not.toContainText("(Paused)");

  await host.getByRole("button", { name: "Clear Timer" }).click();
  await expect(host.getByTestId("game-timer")).toHaveCount(0);
  await expect(tv.page.getByTestId("game-timer")).toHaveCount(0);

  await Promise.all([tv.ctx.close(), phone.ctx.close()]);
});
