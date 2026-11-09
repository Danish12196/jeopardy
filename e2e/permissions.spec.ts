import { test, expect } from "@playwright/test";
import PocketBase from "pocketbase";
import { HOST_EMAIL, HOST_PASSWORD, PB_URL, TEAMS, createGameViaApi, expectRejected, guestPb, makeUser, userPb } from "./helpers";

// A second, ordinary account trying to touch the seeded host's things.
test.describe("a second user can't change the first user's content", () => {
  let host: PocketBase;
  let other: PocketBase;

  test.beforeAll(async () => {
    host = await userPb(HOST_EMAIL, HOST_PASSWORD);
    other = await makeUser("other@lockout.test");
  });

  test("games", async () => {
    const game = await createGameViaApi(host, TEAMS.slice(0, 2));
    await expectRejected(other.collection("games").update(game.id, { teamScores: [] }));
    await expectRejected(other.collection("games").update(game.id, { host: other.authStore.record!.id }));
    await expectRejected(other.collection("games").delete(game.id));
    // The host can, but can't hand the game to someone else.
    await expectRejected(host.collection("games").update(game.id, { host: other.authStore.record!.id }));
    await host.collection("games").update(game.id, { buzzerUnlocked: true });
    await host.collection("games").delete(game.id);
  });

  test("can't create a game hosted by someone else", async () => {
    const template = await host.collection("game_templates").getFirstListItem('title = "Test Board"');
    await expectRejected(
      other.collection("games").create({ uniqueID: "SPOOF1", template: template.id, host: host.authStore.record!.id })
    );
    await expectRejected(other.collection("games").create({ uniqueID: "SPOOF2", template: template.id }));
  });

  test("templates, categories, questions and teams", async () => {
    const template = await host.collection("game_templates").getFirstListItem('title = "Test Board"');
    const question = await host.collection("questions").getOne(template.questions[0]);
    const category = await host.collection("question_categories").getOne(template.categories[0]);
    const team = (await host.collection("teams").getFullList())[0];

    // Public content is readable, but not writable.
    expect((await other.collection("game_templates").getOne(template.id)).id).toBe(template.id);
    for (const [col, id, patch] of [
      ["game_templates", template.id, { title: "Hacked" }],
      ["questions", question.id, { answer: "Hacked" }],
      ["question_categories", category.id, { name: "Hacked" }],
      ["teams", team.id, { name: "Hacked" }],
    ] as const) {
      await expectRejected(other.collection(col).update(id, patch));
      await expectRejected(other.collection(col).update(id, { user: other.authStore.record!.id }));
      await expectRejected(other.collection(col).delete(id));
    }
    expect((await host.collection("questions").getOne(question.id)).answer).toBe(question.answer);
    // Other users can't see someone else's teams in a list.
    expect(await other.collection("teams").getFullList()).toHaveLength(0);
  });

  test("can't create content owned by someone else", async () => {
    const hostId = host.authStore.record!.id;
    await expectRejected(other.collection("teams").create({ name: "Spoof", user: hostId }));
    await expectRejected(other.collection("question_categories").create({ name: "Spoof", user: hostId }));
    await expectRejected(other.collection("game_templates").create({ title: "Spoof", user: hostId }));
    // Their own is fine.
    const own = await other.collection("teams").create({ name: "Mine", user: other.authStore.record!.id });
    await other.collection("teams").delete(own.id);
  });
});

test("nobody can make themselves a superuser through the old isSuperuser flag", async () => {
  const guest = guestPb();
  await expectRejected(
    guest.collection("users").create({ email: "sneaky@lockout.test", password: "sneaky-password", passwordConfirm: "sneaky-password", isSuperuser: true })
  );
  const other = await makeUser("other2@lockout.test");
  await expectRejected(other.collection("users").update(other.authStore.record!.id, { isSuperuser: true }));
  // And the flag no longer grants anything: users can't list other accounts.
  const users = await other.collection("users").getFullList();
  expect(users.map((u) => u.id)).toEqual([other.authStore.record!.id]);
});

test("guests can still read what the board and phones need", async () => {
  const host = await userPb(HOST_EMAIL, HOST_PASSWORD);
  const game = await createGameViaApi(host, TEAMS.slice(0, 2));
  const guest = new PocketBase(PB_URL);
  const g = await guest.collection("games").getFirstListItem(`uniqueID = "${game.uniqueID}"`);
  expect(g.id).toBe(game.id);
  expect((await guest.collection("teams").getOne(game.teams[0])).name).toMatch(/^Team /);
});
