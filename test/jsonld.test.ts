import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "../src/lib/jsonld";

describe("serializeJsonLd", () => {
  it("escapes < so remote content can't close the script tag", () => {
    const out = serializeJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c");
  });

  it("round-trips back to the original data", () => {
    const data = { name: "a <b> c", nested: { list: ["</script>"] } };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
