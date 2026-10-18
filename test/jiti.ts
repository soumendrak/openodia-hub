import plugin from "../scripts/standards/eslint-isolated-modules.ts";

export const createJiti = () => ({ import: async () => plugin });
