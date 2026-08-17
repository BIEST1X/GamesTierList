export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/test") {
      try {
        const result = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM games")
          .first();

        return Response.json({
          success: true,
          games: result.count
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error.message
          },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
