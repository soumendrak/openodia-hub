import { runTimed } from "./run-timed";

const mark = process.env.OWNED_TYPES_INTR_MARK;
if (!mark) throw new Error("OWNED_TYPES_INTR_MARK is required");
await runTimed("bun", ["-e", `void ${JSON.stringify(mark)}; while (true) {}`], {
  timeoutMs: 60_000,
  label: "interrupt-child",
});
