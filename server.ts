export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return new Response("Server is running", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  },
};

