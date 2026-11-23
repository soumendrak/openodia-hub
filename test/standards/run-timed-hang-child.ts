const [mark, parentRaw, deadlineRaw] = process.argv.slice(2);
if (!mark || !parentRaw || !deadlineRaw) {
  throw new Error("usage: run-timed-hang-child.ts <mark> <parentPid> <deadlineMs>");
}
const parentPid = Number(parentRaw);
const deadlineMs = Number(deadlineRaw);
if (!Number.isFinite(parentPid) || !Number.isFinite(deadlineMs)) {
  throw new Error("parentPid and deadlineMs must be numbers");
}
process.on("SIGTERM", () => {});
process.on("SIGINT", () => {});
const deadline = Date.now() + deadlineMs;
const tick = () => {
  if (Date.now() >= deadline) process.exit(0);
  try {
    process.kill(parentPid, 0);
  } catch {
    process.exit(0);
  }
  setTimeout(tick, 50);
};
tick();
