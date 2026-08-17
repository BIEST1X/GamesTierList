export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // DATABASE SETUP
    // =========================================================

    async function ensureSchema() {
      try {
        const columns = await env.DB
          .prepare("PRAGMA table_info(games)")
          .all();

        const hasOverride = columns.results.some(
          column => column.name === "total_override"
        );

        if (!hasOverride) {
          await env.DB.prepare(
            "ALTER TABLE games ADD COLUMN total_override REAL"
          ).run();
        }
      } catch (error) {
        console.error("Schema check failed:", error);
      }
    }

    await ensureSchema();

    // =========================================================
    // AUTH
    // =========================================================

    function isAdmin(request) {
      const auth = request.headers.get("Authorization");

      if (!auth) return false;

      const token = auth.startsWith("Bearer ")
        ? auth.slice(7)
        : auth;

      return token === env.ADMIN_PASSWORD;
    }

    // =========================================================
    // LOGIN
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
          return Response.json(
            {
              success: false,
              error: "Invalid password"
            },
            { status: 401 }
          );
        }

        return Response.json({
          success: true,
          token: env.ADMIN_PASSWORD
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            error: "Invalid request"
          },
          { status: 400 }
        );
      }
    }

    // =========================================================
    // TEST D1
    // =========================================================

    if (url.pathname === "/api/test") {
      try {
        const result = await env.DB
          .prepare(
            "SELECT COUNT(*) AS count FROM games"
          )
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

    // =========================================================
    // MIGRATION
    // =========================================================

    if (
      url.pathname === "/api/migrate" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return Response.json(
          {
            success: false,
            error: "Unauthorized"
          },
          { status: 401 }
        );
      }

      return Response.json({
        success: true,
        message:
          "Migration is no longer needed. Existing database preserved."
      });
    }

    // =========================================================
    // GET ALL GAMES
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
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
              position,
              total_override
            FROM games
            ORDER BY
              CASE tier
                WHEN 'S' THEN 0
                WHEN 'A' THEN 1
                WHEN 'B' THEN 2
                WHEN 'F' THEN 3
                WHEN 'X' THEN 4
                ELSE 5
              END,
              position ASC
          `)
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

    // =========================================================
    // UPDATE GAME
    //
    // Frontend sends:
    // PUT /api/games
    // body contains id + only fields being changed
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "PUT"
    ) {
      if (!isAdmin(request)) {
        return Response.json(
          {
            success: false,
            error: "Unauthorized"
          },
          { status: 401 }
        );
      }

      try {
        const body = await request.json();

        if (!body.id) {
          return Response.json(
            {
              success: false,
              error: "Missing game id"
            },
            { status: 400 }
          );
        }

        const allowedFields = [
          "name",
          "tier",
          "gameplay",
          "visuals",
          "story",
          "music",
          "voice",
          "sound",
          "writing",
          "commentary",
          "position",
          "total_override"
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
          if (
            Object.prototype.hasOwnProperty.call(
              body,
              field
            )
          ) {
            updates.push(`${field} = ?`);

            if (field === "total_override") {
              if (
                body[field] === null ||
                body[field] === "" ||
                body[field] === undefined
              ) {
                values.push(null);
              } else {
                const num = Number(body[field]);

                if (
                  !Number.isFinite(num) ||
                  num < 0 ||
                  num > 10
                ) {
                  return Response.json(
                    {
                      success: false,
                      error:
                        "Manual rating must be between 0 and 10"
                    },
                    { status: 400 }
                  );
                }

                values.push(
                  Math.round(num * 10) / 10
                );
              }

            } else if (
              [
                "gameplay",
                "visuals",
                "story",
                "music",
                "voice",
                "sound",
                "writing"
              ].includes(field)
            ) {
              const num = Number(body[field]);

              values.push(
                Number.isFinite(num)
                  ? Math.max(0, Math.min(10, num))
                  : 0
              );

            } else if (field === "position") {
              const num = Number(body[field]);

              values.push(
                Number.isFinite(num) ? num : 0
              );

            } else {
              values.push(body[field] ?? "");
            }
          }
        }

        if (updates.length === 0) {
          return Response.json({
            success: true,
            message: "Nothing to update"
          });
        }

        values.push(body.id);

        await env.DB
          .prepare(`
            UPDATE games
            SET ${updates.join(", ")}
            WHERE id = ?
          `)
          .bind(...values)
          .run();

        return Response.json({
          success: true,
          message: "Game updated"
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

    // =========================================================
    // ADD GAME
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return Response.json(
          {
            success: false,
            error: "Unauthorized"
          },
          { status: 401 }
        );
      }

      try {
        const body = await request.json();

        const id =
          body.id ||
          "g_" +
            Date.now().toString(36) +
            Math.random()
              .toString(36)
              .substring(2, 7);

        const tier = body.tier || "B";

        const maxPosition = await env.DB
          .prepare(`
            SELECT MAX(position) AS maxPosition
            FROM games
            WHERE tier = ?
          `)
          .bind(tier)
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
              position,
              total_override
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            id,
            body.name || "New Game",
            tier,
            Number(body.gameplay) || 0,
            Number(body.visuals) || 0,
            Number(body.story) || 0,
            Number(body.music) || 0,
            Number(body.voice) || 0,
            Number(body.sound) || 0,
            Number(body.writing) || 0,
            body.commentary ?? "",
            position,
            body.total_override ?? null
          )
          .run();

        return Response.json({
          success: true,
          id
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

    // =========================================================
    // DELETE GAME
    // =========================================================

    if (
      url.pathname.startsWith("/api/games/") &&
      request.method === "DELETE"
    ) {
      if (!isAdmin(request)) {
        return Response.json(
          {
            success: false,
            error: "Unauthorized"
          },
          { status: 401 }
        );
      }

      try {
        const id =
          url.pathname
            .split("/")
            .pop();

        await env.DB
          .prepare(
            "DELETE FROM games WHERE id = ?"
          )
          .bind(id)
          .run();

        await normalizePositions();

        return Response.json({
          success: true,
          message: "Game deleted"
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

    // =========================================================
    // MOVE GAME
    //
    // Used both for:
    // - dragging within a tier
    // - changing tier
    // =========================================================

    if (
      url.pathname === "/api/games/move" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return Response.json(
          {
            success: false,
            error: "Unauthorized"
          },
          { status: 401 }
        );
      }

      try {
        const body = await request.json();

        const id = body.id;
        const targetTier = body.tier;

        if (!id || !targetTier) {
          return Response.json(
            {
              success: false,
              error: "Missing id or tier"
            },
            { status: 400 }
          );
        }

        const current = await env.DB
          .prepare(
            "SELECT id, tier, position FROM games WHERE id = ?"
          )
          .bind(id)
          .first();

        if (!current) {
          return Response.json(
            {
              success: false,
              error: "Game not found"
            },
            { status: 404 }
          );
        }

        const oldTier = current.tier;

        // Remove game from old tier's ordering
        await env.DB
          .prepare(`
            UPDATE games
            SET position = position - 1
            WHERE tier = ?
              AND position > ?
          `)
          .bind(
            oldTier,
            Number(current.position)
          )
          .run();

        // Get target tier games excluding moving game
        const targetGames = await env.DB
          .prepare(`
            SELECT id
            FROM games
            WHERE tier = ?
              AND id != ?
            ORDER BY position ASC
          `)
          .bind(targetTier, id)
          .all();

        let position = Number(body.position);

        if (!Number.isFinite(position)) {
          position = targetGames.results.length;
        }

        position = Math.max(
          0,
          Math.min(
            position,
            targetGames.results.length
          )
        );

        // Make space in target tier
        await env.DB
          .prepare(`
            UPDATE games
            SET position = position + 1
            WHERE tier = ?
              AND position >= ?
              AND id != ?
          `)
          .bind(
            targetTier,
            position,
            id
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
            id
          )
          .run();

        await normalizePositions();

        return Response.json({
          success: true,
          message: "Game moved"
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

    // =========================================================
    // REORDER TIER
    // =========================================================

    if (
      url.pathname === "/api/games/reorder" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return Response.json(
          {
            success: false,
            error: "Unauthorized"
          },
          { status: 401 }
        );
      }

      try {
        const body = await request.json();

        const tier = body.tier;
        const positions = body.positions || {};

        if (!tier) {
          return Response.json(
            {
              success: false,
              error: "Missing tier"
            },
            { status: 400 }
          );
        }

        for (const [id, position] of Object.entries(
          positions
        )) {
          await env.DB
            .prepare(`
              UPDATE games
              SET position = ?
              WHERE id = ?
                AND tier = ?
            `)
            .bind(
              Number(position),
              id,
              tier
            )
            .run();
        }

        await normalizePositions();

        return Response.json({
          success: true
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

    // =========================================================
    // NORMALIZE POSITIONS
    // =========================================================

    async function normalizePositions() {
      const tiers = ["S", "A", "B", "F", "X"];

      for (const tier of tiers) {
        const result = await env.DB
          .prepare(`
            SELECT id
            FROM games
            WHERE tier = ?
            ORDER BY position ASC, id ASC
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
    }

    // =========================================================
    // WEBSITE
    // =========================================================

    return env.ASSETS.fetch(request);
  }
};
