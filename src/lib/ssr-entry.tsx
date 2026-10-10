import {
  RouterServer,
  defineHandlerCallback,
  transformReadableStreamWithRouter,
} from "@tanstack/react-router/ssr/server";
import { isNotFound } from "@tanstack/react-router";
import { createStartHandler } from "@tanstack/react-start/server";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

type AppStream = Parameters<typeof transformReadableStreamWithRouter>[1];

/**
 * TanStack's defaultStreamHandler, but a render error answers 500.
 *
 * React SSR catches a component that throws into the nearest Suspense boundary
 * and leaves it for the client (where the root errorComponent shows "Something
 * broke"), so the shell still resolves and the default handler took its status
 * from the router alone: 200. Errors React reports before the shell is ready
 * (before allReady, for bots) now set 500; later ones can't, as the headers are sent.
 * A component throwing notFound() is a not-found signal, not a failure: 404.
 */
export const streamHandler = defineHandlerCallback(async ({ request, router, responseHeaders }) => {
  let status: number | undefined;
  const stream = await renderToReadableStream(<RouterServer router={router} />, {
    signal: request.signal,
    nonce: router.options.ssr?.nonce,
    progressiveChunkSize: Number.POSITIVE_INFINITY,
    onError(error) {
      if (isNotFound(error)) {
        status ??= 404;
        return;
      }
      status = 500;
      console.error(error);
    },
  });
  if (isbot(request.headers.get("User-Agent"))) await stream.allReady;
  // Same casts as TanStack's renderRouterToStream: Node's and the DOM's stream types differ.
  const body = transformReadableStreamWithRouter(router, stream as unknown as AppStream);
  return new Response(body as unknown as BodyInit, {
    status: status ?? router.stores.statusCode.get(),
    headers: responseHeaders,
  });
});

export default { fetch: createStartHandler(streamHandler) };
