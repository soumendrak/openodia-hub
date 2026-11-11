import { AsyncLocalStorage } from "node:async_hooks";
import type { D1Like } from "./events-store";

// nodejs_compat supports AsyncLocalStorage in the Worker and in local SSR.
// An overlapping request must never borrow another request's reviewed database.
const databases = new AsyncLocalStorage<D1Like | undefined>();
export function withEventDatabase<T>(db: D1Like | undefined, callback: () => T): T {
  return databases.run(db, callback);
}
export function getEventDatabase(): D1Like | undefined {
  return databases.getStore();
}
