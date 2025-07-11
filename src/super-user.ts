import PocketBase from "pocketbase";

const superuserClient = new PocketBase(import.meta.env.VITE_PB_URL);
superuserClient.autoCancellation(false);

await superuserClient
  .collection("_superusers")
  .authWithPassword(
    import.meta.env.VITE_PB_SUPERUSER_EMAIL,
    import.meta.env.VITE_PB_SUPERUSER_PASSWORD
  );

export default superuserClient;
