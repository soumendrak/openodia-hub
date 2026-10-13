import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamUnavailableError } from "../src/lib/sources/cache";
const fixture = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../src/lib/sources/videos", () => ({ loadVideos: fixture.load }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
import { Route } from "../src/routes/api/videos";
const get = (
  Route as unknown as { options: { server: { handlers: { GET: () => Promise<Response> } } } }
).options.server.handlers.GET;
afterEach(() => {
  vi.restoreAllMocks();
  fixture.load.mockReset();
});
describe("video API error classification", () => {
  it.each([
    [
      new UpstreamUnavailableError("YouTube is temporarily unavailable"),
      503,
      "YouTube is temporarily unavailable",
    ],
    [new Error("internal implementation details"), 500, "internal_error"],
  ])("classifies %s without exposing internal error details", async (error, status, message) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fixture.load.mockRejectedValueOnce(error);
    const response = await get();
    expect(response.status).toBe(status);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ channels: [], error: message });
    expect(log).toHaveBeenCalledWith("videos error", error);
  });
});
