import { test, expect } from "@playwright/test";
import { HOST_EMAIL, HOST_PASSWORD, createGameViaApi, hostOpenFirstQuestion, loginAsHost, openBuzzer, userPb } from "./helpers";

test("a phone that drops offline mid-question catches up when it's back", async ({ page: host, browser }) => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, ["Team 1", "Team 2"]);
  await loginAsHost(host);
  await host.goto(`/game/${game.uniqueID}/host`);
  const phone1 = await openBuzzer(browser, game.uniqueID, "Team 1");
  const phone2 = await openBuzzer(browser, game.uniqueID, "Team 2");

  await hostOpenFirstQuestion(host);
  await host.getByRole("button", { name: "Open buzzers" }).click();
  await expect(phone1.page.getByRole("button", { name: "Buzz" })).toBeEnabled();
  await expect(phone2.page.getByRole("button", { name: "Buzz" })).toBeEnabled();

  // Phone 2 loses its connection.
  await phone2.ctx.setOffline(true);
  await expect(phone2.page.getByRole("status")).toHaveText("Reconnecting…");

  // Meanwhile Team 1 buzzes and the host locks the buzzers.
  await phone1.page.getByRole("button", { name: "Buzz" }).click({ force: true });
  await expect(host.getByText("Buzz #1")).toBeVisible();
  await host.getByRole("button", { name: "Lock buzzers" }).click();
  // (Playwright's offline mode doesn't cut an already-open event stream, so
  // phone 2 may or may not have seen that yet. Either way it must be right
  // once it's back.)

  // Back online: badge goes away and it shows what happened.
  await phone2.ctx.setOffline(false);
  await expect(phone2.page.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
  await expect(phone2.page.getByText("Locked. Someone else got in first.")).toBeVisible();
  await expect(phone2.page.getByRole("button", { name: "Locked" })).toBeDisabled();

  // And it's live again.
  await host.getByRole("button", { name: "Open buzzers" }).click();
  await expect(phone2.page.getByRole("button", { name: "Buzz" })).toBeEnabled();

  await Promise.all([phone1.ctx.close(), phone2.ctx.close()]);
});

test("a phone keeps its team after a reload and can switch teams", async ({ browser }) => {
  const api = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(api, ["Team 1", "Team 2"]);
  const phone = await openBuzzer(browser, game.uniqueID, "Team 2");
  await phone.page.reload();
  await expect(phone.page.getByText("Team: Team 2")).toBeVisible();

  await phone.page.getByRole("button", { name: "Switch team" }).click();
  await phone.page.getByRole("button", { name: "Team 1", exact: true }).click();
  await expect(phone.page.getByText("Team: Team 1")).toBeVisible();
  await phone.page.reload();
  await expect(phone.page.getByText("Team: Team 1")).toBeVisible();
  await phone.ctx.close();
});
