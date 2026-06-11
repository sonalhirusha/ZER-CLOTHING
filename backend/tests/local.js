// Boots the API in-process, then runs the e2e suite against it. One process,
// so the server can't be reaped between steps. Used for CI + verification.
import app from "../src/server.js";
import { startEmailWorker } from "../src/jobs/emailWorker.js";

const server = app.listen(4000, () => {
  startEmailWorker(2000);
  console.log("[test] API booted on :4000");
  import("./e2e.js"); // runs immediately and calls process.exit when done
});

server.on("error", (e) => {
  console.error("[test] failed to boot:", e.message);
  process.exit(2);
});
