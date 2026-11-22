import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import config from "../../eslint.config.js";

const [root, module, ...files] = process.argv.slice(2);
const isolated = config.find((block) => block.plugins?.["isolated"])?.plugins?.["isolated"];
if (!root || !module || !isolated)
  throw new Error("usage: owned-types-lint-file <root> <module> <file>...");
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { project: "./tsconfig.json", tsconfigRootDir: root },
      },
      plugins: { isolated },
      rules: { "isolated/owned-types": ["error", { modules: [module] }] },
    },
  ],
});
const results = await eslint.lintFiles(files);
console.log(JSON.stringify(results.map((result) => result.messages.map((m) => m.ruleId))));
