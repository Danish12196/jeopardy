// src/superuser.js
import PocketBase from "pocketbase";

const superuserClient = new PocketBase("http://127.0.0.1:8090");
superuserClient.autoCancellation(false);

superuserClient.authStore.save(import.meta.env.VITE_PB_SUPERUSER_TOKEN);

export default superuserClient;
