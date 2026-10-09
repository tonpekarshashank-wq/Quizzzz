import { sleep, RetryableError } from "workflow";
export async function wakeGame(jobId: string, dueAt: string) {
  "use workflow";
  await sleep(new Date(dueAt));
  await reconcileJob(jobId);
}
async function reconcileJob(jobId: string) {
  "use step";
  const { runScheduledJob, drainLive } = await import("../lib/live-delivery");
  const retryAt = await runScheduledJob(jobId);
  if (retryAt)
    throw new RetryableError("Scheduled job is not due yet.", {
      retryAfter: new Date(retryAt),
    });
  await drainLive();
}
