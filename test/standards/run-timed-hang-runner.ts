import { runTimed } from "./run-timed";
import { HANG_CHILD_DEADLINE_MS, HANG_TIMEOUT_MS, hungChildArgs } from "./run-timed-test-util";

const mark = process.env.OWNED_TYPES_HANG_MARK;
if (!mark) throw new Error("OWNED_TYPES_HANG_MARK is required");
await runTimed("bun", hungChildArgs(mark, process.pid, HANG_CHILD_DEADLINE_MS), {
  timeoutMs: HANG_TIMEOUT_MS,
  label: "hung lint child",
});
