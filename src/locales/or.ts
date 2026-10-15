import type { en } from "./en";

/**
 * Odia (ଓଡ଼ିଆ) translations.
 *
 * Each entry is either the translated string or missing — in which case the
 * runtime falls back to the English string from `en.ts`.
 *
 * Coverage is the nav chrome only; page bodies are still English. Add keys to
 * `en.ts` and translate them here as more of the UI gets routed through i18n.
 *
 * TODO: have a native Odia speaker review these strings.
 */
export const or: Partial<Record<keyof typeof en, string>> = {
  "nav.home": "ମୂଳପୃଷ୍ଠା",
  "nav.tools": "ଉପକରଣ",
  "nav.models": "ମଡେଲ୍",
  "nav.datasets": "ଡାଟାସେଟ୍",
  "nav.playground": "ପରୀକ୍ଷାସ୍ଥଳ",
  "nav.tutorials": "ଟ୍ୟୁଟୋରିଆଲ୍",
  "nav.events": "କାର୍ଯ୍ୟକ୍ରମ",
  "nav.about": "ପରିଚୟ",
  "nav.contribute": "ପ୍ରକଳ୍ପ ଯୋଡ଼ନ୍ତୁ",
  "nav.search.aria": "ସନ୍ଧାନ ଖୋଲନ୍ତୁ (Cmd+K)",
  "nav.theme.aria": "ଥିମ୍ ବଦଳାନ୍ତୁ",
  "nav.locale.aria": "ଭାଷା ବଦଳାନ୍ତୁ",
  "nav.menu.aria": "ମେନୁ ବଦଳାନ୍ତୁ",
  "home.hero.eyebrow": "ଓଡ଼ିଶାରୁ। ସମସ୍ତ ସମ୍ଭାବନା ପାଇଁ।",
  "home.hero.line1": "ଆମ ଭାଷା।",
  "home.hero.line2": "ଆମ ଐତିହ୍ୟ।",
  "home.hero.line3": "ଆମ ପରବର୍ତ୍ତୀ ଅଧ୍ୟାୟ।",
  "home.hero.description":
    "ଗୋଟିଏ ଭାଷା ନିଜ ଭିତରେ ଏକ ଦୁନିଆ ଧାରଣ କରେ। ଡିଜିଟାଲ୍ ଯୁଗରେ ଓଡ଼ିଆକୁ ଆଗକୁ ନେଉଥିବା ଲୋକ, ମୁକ୍ତ ଉପକରଣ ଓ ଚିନ୍ତାଧାରା ସହ ପରିଚିତ ହୁଅନ୍ତୁ।",
  "home.hero.explore": "ସଂଗ୍ରହ ଦେଖନ୍ତୁ",
  "home.hero.learn": "ଶିଖିବା ଆରମ୍ଭ କରନ୍ତୁ",
  "home.hero.note": "ଆମ ଚେର ଗଭୀର। ଆମ ସମ୍ଭାବନା ଅସୀମ।",
  "home.opening.eyebrow": "ଆମ ସମସ୍ତଙ୍କ ଭାଷା। ଆମ ସମସ୍ତଙ୍କ ଦାୟିତ୍ୱ।",
  "home.opening.line1": "ଆମେ ଯାହା ଉତ୍ତରାଧିକାରରେ ପାଉ,",
  "home.opening.line2": "ତାହାକୁ ଆଗକୁ ନେଉ।",
  "home.opening.description":
    "ପିଲାଦିନରୁ ଶୁଣିଆସିଥିବା ଶବ୍ଦରୁ ଆରମ୍ଭ କରି ଆମେ ଆଗକୁ ଗଢ଼ିବାକୁ ଥିବା ଜିନିଷ ପର୍ଯ୍ୟନ୍ତ। ଆମ ଭାଷାରେ ନୂଆ ସମ୍ଭାବନା ସୃଷ୍ଟି କରୁଥିବା ସମ୍ବଳ ଓ ସମୁଦାୟକୁ ଖୋଜିବା ପାଇଁ OpenOdia ଏକ ପଥପ୍ରଦର୍ଶକ।",
  "home.stats.projects": "ତାଲିକାଭୁକ୍ତ ପ୍ରକଳ୍ପ",
  "home.stats.models": "ଓଡ଼ିଆ ମଡେଲ୍",
  "home.stats.datasets": "ଓଡ଼ିଆ ଡାଟାସେଟ୍",
  "home.stats.channels": "ସମୁଦାୟ ଚ୍ୟାନେଲ୍",
  "footer.description": "ଓଡ଼ିଆ ଭାଷା ପାଇଁ ମୁକ୍ତ ଉତ୍ସ ପଦକ୍ଷେପ — ସମୁଦାୟ ଦ୍ୱାରା ପରିଚାଳିତ।",
  "footer.explore": "ଦେଖନ୍ତୁ",
  "footer.tools": "ଉପକରଣ ଓ ପ୍ରକଳ୍ପ",
  "footer.transliteration": "ଲିପ୍ୟନ୍ତରଣ",
  "footer.communities": "ସମୁଦାୟ",
  "footer.research": "ଗବେଷଣା",
  "footer.papers": "ଗବେଷଣାପତ୍ର",
  "footer.treebank": "ଟ୍ରିବ୍ୟାଙ୍କରେ ସନ୍ଧାନ",
  "footer.develop": "ବିକାଶ କରନ୍ତୁ",
  "footer.add": "ଆପଣଙ୍କ ପ୍ରକଳ୍ପ ଯୋଡ଼ନ୍ତୁ",
  "footer.connect": "ଯୋଗାଯୋଗ କରନ୍ତୁ",
  "footer.rss": "କାର୍ଯ୍ୟକ୍ରମର RSS ଫିଡ୍ ପାଇଁ ଗ୍ରାହକ ହୁଅନ୍ତୁ",
  "footer.built": "ନିର୍ମିତ",
  "footer.love": "ଭଲପାଇବାରେ",
  "footer.odisha": "ଓଡ଼ିଶାରେ",
  "footer.art": "କଳା ଓ ପ୍ରେରଣା",
  "footer.translations": "ଅନୁବାଦରେ ସାହାଯ୍ୟ କରନ୍ତୁ",
};
