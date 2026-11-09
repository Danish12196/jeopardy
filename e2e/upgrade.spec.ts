import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import PocketBase from "pocketbase";
// @ts-expect-error plain JS module without types
import { startTestPocketBase } from "../scripts/test-pb.mjs";

// Re-running init-db.mjs on a database made by the pre-v2 script must upgrade
// it in place without losing games, templates or questions.
test("init-db.mjs upgrades a pre-v2 database without losing data", async () => {
  const pbh = await startTestPocketBase({ seed: false, init: false });
  try {
    const run = (script: string, ...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], { env: pbh.env, encoding: "utf8" });

    expect(run("e2e/fixtures/init-db-v1.mjs").status).toBe(0);

    const admin = new PocketBase(pbh.url);
    await admin.collection("_superusers").authWithPassword(pbh.env.PB_SUPERUSER_EMAIL, pbh.env.PB_SUPERUSER_PASSWORD);
    const user = await admin.collection("users").create({ email: "old@lockout.test", password: "old-password-123", passwordConfirm: "old-password-123" });
    const cat = await admin.collection("question_categories").create({ name: "Old", user: user.id });
    const q = await admin.collection("questions").create({ question: "Q?", answer: "A", category: cat.id, user: user.id });
    const tpl = await admin.collection("game_templates").create({ title: "Old board", categories: [cat.id], questions: [q.id], user: user.id });
    const team = await admin.collection("teams").create({ name: "Old team", user: user.id });
    const game = await admin.collection("games").create({
      uniqueID: "OLD123", template: tpl.id, teams: [team.id], teamScores: [{ id: team.id, score: 300 }],
      buzzerQueue: [{ teamId: team.id, time: 1 }],
    });
    const orphan = await admin.collection("games").create({ uniqueID: "ORPHAN" });

    // Dry run changes nothing.
    const dry = run("scripts/init-db.mjs", "--dry-run", "--sync-rules");
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.stdout).toContain("+ create buzzes");
    expect(dry.stdout).toContain("set host on 1 existing game");
    expect((await admin.collections.getList(1, 50, { filter: 'name = "buzzes"' })).totalItems).toBe(0);

    const real = run("scripts/init-db.mjs", "--sync-rules");
    expect(real.status, real.stderr + real.stdout).toBe(0);

    const after = await admin.collection("games").getOne(game.id);
    expect(after.host).toBe(user.id);
    expect(after.teamScores).toEqual([{ id: team.id, score: 300 }]);
    expect(after.buzzerQueue).toEqual([{ teamId: team.id, time: 1 }]); // still readable
    expect(after.buzzRound).toBe(0);
    expect((await admin.collection("games").getOne(orphan.id)).host).toBe("");
    expect((await admin.collection("game_templates").getOne(tpl.id)).questions).toEqual([q.id]);
    expect((await admin.collection("questions").getOne(q.id)).answer).toBe("A");

    const games = await admin.collections.getOne("games");
    expect(games.updateRule).not.toContain("buzzerUnlocked");
    expect(games.updateRule).toContain("host");

    // A second run is a no-op.
    const again = run("scripts/init-db.mjs", "--sync-rules");
    expect(again.status).toBe(0);
    expect(again.stdout).not.toMatch(/^[~+] /m);
  } finally {
    await pbh.stop();
  }
});
