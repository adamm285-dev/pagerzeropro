import { DurableObject } from "cloudflare:workers";

/** Kept so the earlier container Durable Object class still exists. */
export class PagerZeroContainer extends DurableObject {}

const ORIGIN = "https://pagerzero-309629300922.us-east1.run.app";

export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const origin = new URL(incoming.pathname + incoming.search, ORIGIN);
    return fetch(
      new Request(origin.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "manual",
      }),
    );
  },
};
