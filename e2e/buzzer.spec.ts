import { test, expect } from "@playwright/test";
import {
  HOST_EMAIL, HOST_PASSWORD, TEAMS,
  createGameViaApi, expectRejected, guestPb, hostOpenFirstQuestion, loginAsHost, openBuzzer, openTv, userPb,
} from "./helpers";

test("four teams buzzing within ~50 ms all land, in the same order everywhere", async ({ page: host, browser }) => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, TEAMS);
  await loginAsHost(host);
  await host.goto(`/game/${game.uniqueID}/host`);
  const tv = await openTv(browser, game.uniqueID);
  const phones = await Promise.all(TEAMS.map((t) => openBuzzer(browser, game.uniqueID, t)));

  await hostOpenFirstQuestion(host);
  await host.getByRole("button", { name: "Open buzzers" }).click();
  for (const p of phones) await expect(p.page.getByRole("button", { name: "Buzz" })).toBeEnabled();

  // All four tap within about 50 ms of each other.
  await Promise.all(
    phones.map(async (p, i) => {
      await new Promise((r) => setTimeout(r, i * 15));
      await p.page.getByRole("button", { name: "Buzz" }).click({ force: true });
    })
  );

  const queue = host.getByTestId("host-buzz-queue").locator("li");
  await expect(queue).toHaveCount(4);

  // Server order (created, then id) from the API.
  const g = await api.collection("games").getOne(game.id);
  const buzzes = await api.collection("buzzes").getFullList({
    filter: api.filter("game = {:g} && round = {:r}", { g: game.id, r: g.buzzRound }),
    sort: "created,id",
  });
  expect(buzzes).toHaveLength(4);
  const teams = await api.collection("teams").getFullList();
  const expected = buzzes.map((b) => teams.find((t) => t.id === b.team)!.name);

  const hostOrder = (await queue.allInnerTexts()).map((s) => s.replace(/\s*\(.*\)$/, "").trim());
  expect(hostOrder).toEqual(expected);

  // TV shows the same first team.
  await expect(tv.page.getByText(`${expected[0]} buzzed in!`)).toBeVisible();

  // Each phone sees its confirmed position.
  for (const [i, p] of phones.entries()) {
    const pos = expected.indexOf(TEAMS[i]) + 1;
    await expect(p.page.getByRole("button", { name: `Buzzed #${pos}` })).toBeVisible();
  }

  // A reload gives the same order (it's stable, not arrival order on this client).
  await host.reload();
  await expect(queue).toHaveCount(4);
  await expect(queue.first()).toContainText(expected[0]); // team names loaded
  expect((await queue.allInnerTexts()).map((s) => s.replace(/\s*\(.*\)$/, "").trim())).toEqual(expected);

  await Promise.all([tv.ctx.close(), ...phones.map((p) => p.ctx.close())]);
});

test("a buzz while locked is rejected", async () => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, TEAMS.slice(0, 2));
  const guest = guestPb();
  await expectRejected(guest.collection("buzzes").create({ game: game.id, team: game.teams[0], round: 0 }));

  // Once open, the same buzz goes through.
  await api.collection("games").update(game.id, { buzzerUnlocked: true });
  const ok = await guest.collection("buzzes").create({ game: game.id, team: game.teams[0], round: 0 });
  expect(ok.id).toBeTruthy();
  // A second buzz from the same team in the same round is refused.
  await expectRejected(guest.collection("buzzes").create({ game: game.id, team: game.teams[0], round: 0 }));
});

test("a buzz from a stale round is rejected", async () => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, TEAMS.slice(0, 2));
  await api.collection("games").update(game.id, { buzzerUnlocked: true, "buzzRound+": 1 });
  const guest = guestPb();
  await expectRejected(guest.collection("buzzes").create({ game: game.id, team: game.teams[0], round: 0 }));
  const ok = await guest.collection("buzzes").create({ game: game.id, team: game.teams[0], round: 1 });
  expect(ok.round).toBe(1);
});

test("a buzz for a team that isn't in the game is rejected", async () => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, TEAMS.slice(0, 2));
  await api.collection("games").update(game.id, { buzzerUnlocked: true });
  const outsider = (await api.collection("teams").getFullList()).find((t) => t.name === "Team 4")!;
  await expectRejected(guestPb().collection("buzzes").create({ game: game.id, team: outsider.id, round: 0 }));
});

test("a guest can't update the game record or change buzzes", async () => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, TEAMS.slice(0, 2));
  await api.collection("games").update(game.id, { buzzerUnlocked: true });
  const guest = guestPb();
  await expectRejected(guest.collection("games").update(game.id, { buzzerQueue: [{ teamId: game.teams[0], time: 0 }] }));
  await expectRejected(guest.collection("games").update(game.id, { teamScores: [] }));
  await expectRejected(guest.collection("games").delete(game.id));

  const buzz = await guest.collection("buzzes").create({ game: game.id, team: game.teams[0], round: 0 });
  await expectRejected(guest.collection("buzzes").update(buzz.id, { round: 5 }));
  await expectRejected(guest.collection("buzzes").delete(buzz.id));

  const after = await api.collection("games").getOne(game.id);
  expect(after.buzzerQueue ?? []).toEqual([]);
});
