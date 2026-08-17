export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // HELPERS
    // =========================================================

    function json(data, status = 200) {
      return Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store"
        }
      });
    }

    function isAdmin(request) {
      const auth = request.headers.get("Authorization");

      if (!auth) return false;

      const token = auth.startsWith("Bearer ")
        ? auth.slice(7)
        : auth;

      return token === env.ADMIN_PASSWORD;
    }

    function unauthorized() {
      return json(
        {
          success: false,
          error: "Unauthorized"
        },
        401
      );
    }

    // =========================================================
    // ADMIN LOGIN
    // =========================================================

    if (
      url.pathname === "/api/login" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.json();

        if (
          !body.password ||
          body.password !== env.ADMIN_PASSWORD
        ) {
          return json(
            {
              success: false,
              error: "Invalid password"
            },
            401
          );
        }

        return json({
          success: true,
          token: env.ADMIN_PASSWORD
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: "Invalid request"
          },
          400
        );

      }
    }

    // =========================================================
    // TEST D1
    // =========================================================

    if (
      url.pathname === "/api/test" &&
      request.method === "GET"
    ) {
      try {

        const result =
          await env.DB
            .prepare(
              "SELECT COUNT(*) AS count FROM games"
            )
            .first();

        return json({
          success: true,
          games: result.count
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: error.message
          },
          500
        );

      }
    }

    // =========================================================
    // GET ALL GAMES
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "GET"
    ) {
      try {

        const result =
          await env.DB
            .prepare(`
              SELECT *
              FROM games
              ORDER BY tier_order ASC, position ASC
            `)
            .all();

        return json({
          success: true,
          games: result.results
        });

      } catch (error) {

        // Fallback for databases where tier_order
        // does not exist.

        try {

          const result =
            await env.DB
              .prepare(`
                SELECT *
                FROM games
                ORDER BY position ASC
              `)
              .all();

          return json({
            success: true,
            games: result.results
          });

        } catch (fallbackError) {

          return json(
            {
              success: false,
              error: fallbackError.message
            },
            500
          );

        }
      }
    }

    // =========================================================
    // ADD GAME
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "POST"
    ) {

      if (!isAdmin(request))
        return unauthorized();

      try {

        const body =
          await request.json();

        const id =
          body.id ||
          "g_" +
          Date.now().toString(36) +
          Math.random()
            .toString(36)
            .substring(2, 7);

        const maxPosition =
          await env.DB
            .prepare(`
              SELECT MAX(position) AS maxPosition
              FROM games
              WHERE tier = ?
            `)
            .bind(body.tier || "B")
            .first();

        const position =
          maxPosition?.maxPosition != null
            ? Number(maxPosition.maxPosition) + 1
            : 0;

        await env.DB
          .prepare(`
            INSERT INTO games (
              id,
              name,
              tier,
              gameplay,
              visuals,
              story,
              music,
              voice,
              sound,
              writing,
              commentary,
              position
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            body.name || "New Game",
            body.tier || "B",
            Number(body.gameplay) || 0,
            Number(body.visuals) || 0,
            Number(body.story) || 0,
            Number(body.music) || 0,
            Number(body.voice) || 0,
            Number(body.sound) || 0,
            Number(body.writing) || 0,
            body.commentary ?? "",
            position
          )
          .run();

        return json({
          success: true,
          id
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: error.message
          },
          500
        );

      }
    }

    // =========================================================
    // UPDATE GAME
    //
    // IMPORTANT:
    // Accepts partial updates.
    // This fixes the previous D1 undefined errors.
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "PUT"
    ) {

      if (!isAdmin(request))
        return unauthorized();

      try {

        const body =
          await request.json();

        if (!body.id) {
          return json(
            {
              success: false,
              error: "Game ID is required"
            },
            400
          );
        }

        const existing =
          await env.DB
            .prepare(
              "SELECT * FROM games WHERE id = ?"
            )
            .bind(body.id)
            .first();

        if (!existing) {
          return json(
            {
              success: false,
              error: "Game not found"
            },
            404
          );
        }

        const name =
          body.name !== undefined
            ? String(body.name)
            : existing.name;

        const tier =
          body.tier !== undefined
            ? String(body.tier)
            : existing.tier;

        const gameplay =
          body.gameplay !== undefined
            ? Number(body.gameplay) || 0
            : Number(existing.gameplay) || 0;

        const visuals =
          body.visuals !== undefined
            ? Number(body.visuals) || 0
            : Number(existing.visuals) || 0;

        const story =
          body.story !== undefined
            ? Number(body.story) || 0
            : Number(existing.story) || 0;

        const music =
          body.music !== undefined
            ? Number(body.music) || 0
            : Number(existing.music) || 0;

        const voice =
          body.voice !== undefined
            ? Number(body.voice) || 0
            : Number(existing.voice) || 0;

        const sound =
          body.sound !== undefined
            ? Number(body.sound) || 0
            : Number(existing.sound) || 0;

        const writing =
          body.writing !== undefined
            ? Number(body.writing) || 0
            : Number(existing.writing) || 0;

        const commentary =
          body.commentary !== undefined
            ? String(body.commentary)
            : (existing.commentary || "");

        const position =
          body.position !== undefined
            ? Number(body.position) || 0
            : Number(existing.position) || 0;

        await env.DB
          .prepare(`
            UPDATE games
            SET
              name = ?,
              tier = ?,
              gameplay = ?,
              visuals = ?,
              story = ?,
              music = ?,
              voice = ?,
              sound = ?,
              writing = ?,
              commentary = ?,
              position = ?
            WHERE id = ?
          `)
          .bind(
            name,
            tier,
            gameplay,
            visuals,
            story,
            music,
            voice,
            sound,
            writing,
            commentary,
            position,
            body.id
          )
          .run();

        return json({
          success: true,
          message: "Game updated"
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: error.message
          },
          500
        );

      }
    }

    // =========================================================
    // MOVE GAME
    // =========================================================

    if (
      url.pathname === "/api/games/move" &&
      request.method === "POST"
    ) {

      if (!isAdmin(request))
        return unauthorized();

      try {

        const body =
          await request.json();

        if (!body.id) {
          return json(
            {
              success: false,
              error: "Game ID is required"
            },
            400
          );
        }

        const game =
          await env.DB
            .prepare(
              "SELECT * FROM games WHERE id = ?"
            )
            .bind(body.id)
            .first();

        if (!game) {
          return json(
            {
              success: false,
              error: "Game not found"
            },
            404
          );
        }

        const targetTier =
          body.tier || game.tier;

        let position =
          Number(body.position);

        if (!Number.isFinite(position))
          position = 0;

        if (position < 0)
          position = 0;

        // Remove the game from its old position.
        await env.DB
          .prepare(`
            UPDATE games
            SET position = position + 1
            WHERE tier = ?
              AND position >= ?
          `)
          .bind(
            game.tier,
            game.position
          )
          .run();

        // Shift games in the target tier down
        // to make room for the moved game.

        await env.DB
          .prepare(`
            UPDATE games
            SET position = position + 1
            WHERE tier = ?
              AND position >= ?
          `)
          .bind(
            targetTier,
            position
          )
          .run();

        await env.DB
          .prepare(`
            UPDATE games
            SET tier = ?, position = ?
            WHERE id = ?
          `)
          .bind(
            targetTier,
            position,
            body.id
          )
          .run();

        // Normalize positions inside every tier.
        const tiers = [
          "S",
          "A",
          "B",
          "F",
          "X"
        ];

        for (const tier of tiers) {

          const result =
            await env.DB
              .prepare(`
                SELECT id
                FROM games
                WHERE tier = ?
                ORDER BY position ASC
              `)
              .bind(tier)
              .all();

          for (
            let i = 0;
            i < result.results.length;
            i++
          ) {

            await env.DB
              .prepare(`
                UPDATE games
                SET position = ?
                WHERE id = ?
              `)
              .bind(
                i,
                result.results[i].id
              )
              .run();

          }

        }

        return json({
          success: true,
          message: "Game moved"
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: error.message
          },
          500
        );

      }
    }

    // =========================================================
    // REORDER TIER
    // =========================================================

    if (
      url.pathname === "/api/games/reorder" &&
      request.method === "POST"
    ) {

      if (!isAdmin(request))
        return unauthorized();

      try {

        const body =
          await request.json();

        if (
          !body.tier ||
          !body.positions
        ) {
          return json(
            {
              success: false,
              error: "Tier and positions are required"
            },
            400
          );
        }

        const entries =
          Object.entries(
            body.positions
          );

        for (
          const [id, position]
          of entries
        ) {

          await env.DB
            .prepare(`
              UPDATE games
              SET tier = ?, position = ?
              WHERE id = ?
            `)
            .bind(
              body.tier,
              Number(position),
              id
            )
            .run();

        }

        return json({
          success: true,
          message: "Games reordered"
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: error.message
          },
          500
        );

      }
    }

    // =========================================================
    // DELETE GAME
    // =========================================================

    if (
      url.pathname.startsWith(
        "/api/games/"
      ) &&
      request.method === "DELETE"
    ) {

      if (!isAdmin(request))
        return unauthorized();

      try {

        const id =
          decodeURIComponent(
            url.pathname
              .split("/")
              .pop()
          );

        await env.DB
          .prepare(
            "DELETE FROM games WHERE id = ?"
          )
          .bind(id)
          .run();

        return json({
          success: true,
          message: "Game deleted"
        });

      } catch (error) {

        return json(
          {
            success: false,
            error: error.message
          },
          500
        );

      }
    }

    // =========================================================
    // WEBSITE
    // =========================================================

    return env.ASSETS.fetch(request);
  }
};
