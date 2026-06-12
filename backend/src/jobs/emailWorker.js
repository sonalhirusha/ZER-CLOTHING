// Email outbox worker. Polls the EmailQueue table, renders the template and
// sends via the mailer with retry/backoff. Runs in-process (start() on boot)
// and is also kicked immediately whenever a new email is enqueued.
import { prisma } from "../lib/prisma.js";
import { fromJSON } from "../lib/json.js";
import { sendMail } from "../services/mailer.js";
import { renderTemplate } from "../services/templates.js";

const MAX_ATTEMPTS = 5;
const BATCH = 20;
let draining = false;
let timer = null;

export async function processQueueOnce() {
  if (draining) return { processed: 0, skipped: true };
  draining = true;
  let processed = 0;
  try {
    const due = await prisma.emailQueue.findMany({
      where: { status: { in: ["queued", "failed"] }, attempts: { lt: MAX_ATTEMPTS }, scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: BATCH,
    });

    for (const job of due) {
      // Claim the job.
      const claim = await prisma.emailQueue.updateMany({
        where: { id: job.id, status: job.status },
        data: { status: "sending", attempts: { increment: 1 } },
      });
      if (claim.count === 0) continue; // someone else claimed it

      try {
        const { subject, html, text } = renderTemplate(job.template, fromJSON(job.payload, {}));
        const { previewPath } = await sendMail({ to: job.to, subject, html, text });
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: { status: "sent", sentAt: new Date(), error: null, previewPath: previewPath || null },
        });
        processed++;
      } catch (err) {
        const attempts = job.attempts + 1;
        const backoffMs = Math.min(60 * 60 * 1000, 1000 * 2 ** attempts);
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: {
            status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
            scheduledAt: new Date(Date.now() + backoffMs),
            error: String(err && err.message ? err.message : err).slice(0, 500),
          },
        });
      }
    }
  } finally {
    draining = false;
  }
  return { processed };
}

export function kick() {
  // Fire-and-forget immediate drain (used right after enqueue).
  setImmediate(() => processQueueOnce().catch(() => {}));
}

export function startEmailWorker(intervalMs = 15000) {
  if (timer) return;
  timer = setInterval(() => processQueueOnce().catch(() => {}), intervalMs);
  if (timer.unref) timer.unref();
  processQueueOnce().catch(() => {});
  console.log(`[emailWorker] started (poll ${intervalMs}ms)`);
}

export function stopEmailWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
