import { smokeRoute } from "./smoke";

smokeRoute("/no-such-page", "404", { status: 404 });
