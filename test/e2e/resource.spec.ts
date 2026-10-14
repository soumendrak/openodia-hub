import { smokeRoute } from "./smoke";
smokeRoute("/r/model/FacebookAI/xlm-roberta-base", "xlm-roberta-base");
smokeRoute("/r/invalid/nope", "404", { status: 404 });
