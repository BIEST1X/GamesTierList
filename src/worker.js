export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test D1 connection
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

    // Get all games
    if (url.pathname === "/api/games" && request.method === "GET") {
      try {
        const result = await env.DB
          .prepare("SELECT * FROM games")
          .all();

        return Response.json({
          success: true,
          games: result.results
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

    // Everything else = website
    return env.ASSETS.fetch(request);
  }
};
