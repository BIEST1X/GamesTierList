export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // DATABASE SETUP
    // =========================================================

    async function ensureSchema() {
      try {
        await env.DB.prepare(
          "ALTER TABLE games ADD COLUMN custom_score REAL"
        ).run();
      } catch (error) {
        // Column already exists — nothing to do.
      }
    }

    // =========================================================
    // ADMIN AUTH
    // =========================================================

    function isAdmin(request) {
      const auth = request.headers.get("Authorization");

      if (!auth) return false;

      const token = auth.replace(/^Bearer\s+/i, "");

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
    // TEST
    // =========================================================

    if (url.pathname === "/api/test") {
      try {
        await ensureSchema();

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
    // GET GAMES
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "GET"
    ) {
      try {
        await ensureSchema();

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
              custom_score
            FROM games
            ORDER BY tier_sort(tier), position ASC
          `)
          .all()
          .catch(async () => {
            // SQLite/D1 does not necessarily have the helper
            // function above, so use explicit CASE ordering.
            return await env.DB
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
                  custom_score
                FROM games
                ORDER BY
                  CASE tier
                    WHEN 'S' THEN 1
                    WHEN 'A' THEN 2
                    WHEN 'B' THEN 3
                    WHEN 'F' THEN 4
                    WHEN 'X' THEN 5
                    ELSE 6
                  END,
                  position ASC
              `)
              .all();
          });

        return Response.json({
          success: true,
          games: result.results || []
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
        await ensureSchema();

        const body = await request.json();

        if (!body.id) {
          throw new Error("Missing game id");
        }

        const allowed = [
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
          "custom_score"
        ];

        const updates = [];
        const values = [];

        for (const field of allowed) {
          if (!Object.prototype.hasOwnProperty.call(body, field)) {
            continue;
          }

          if (field === "custom_score") {
            const value =
              body.custom_score === null ||
              body.custom_score === "" ||
              body.custom_score === undefined
                ? null
                : Number(body.custom_score);

            updates.push("custom_score = ?");
            values.push(
              Number.isNaN(value) ? null : value
            );

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
            updates.push(`${field} = ?`);

            const value = Number(body[field]);

            values.push(
              Number.isFinite(value) ? value : 0
            );

          } else {
            updates.push(`${field} = ?`);
            values.push(body[field] ?? "");
          }
        }

        if (!updates.length) {
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
        await ensureSchema();

        const body = await request.json();

        const id =
          body.id ||
          "g_" +
            Date.now().toString(36) +
            Math.random()
              .toString(36)
              .substring(2, 7);

        const maxPosition =
          await env.DB
            .prepare(
              "SELECT MAX(position) AS maxPosition FROM games"
            )
            .first();

        const position =
          maxPosition &&
          maxPosition.maxPosition != null
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
              custom_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            position,
            body.custom_score ?? null
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
          decodeURIComponent(
            url.pathname.substring(
              "/api/games/".length
            )
          );

        await env.DB
          .prepare(
            "DELETE FROM games WHERE id = ?"
          )
          .bind(id)
          .run();

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
        let targetPosition = Number(body.position);

        if (!id || !targetTier) {
          throw new Error(
            "Missing id or tier"
          );
        }

        if (!Number.isFinite(targetPosition)) {
          targetPosition = 0;
        }

        const targetGames =
          await env.DB
            .prepare(`
              SELECT id
              FROM games
              WHERE tier = ?
              AND id != ?
              ORDER BY position ASC
            `)
            .bind(targetTier, id)
            .all();

        const ids =
          targetGames.results.map(
            game => game.id
          );

        targetPosition = Math.max(
          0,
          Math.min(
            targetPosition,
            ids.length
          )
        );

        ids.splice(
          targetPosition,
          0,
          id
        );

        // First move the game to target tier.
        await env.DB
          .prepare(`
            UPDATE games
            SET tier = ?
            WHERE id = ?
          `)
          .bind(targetTier, id)
          .run();

        // Re-number only affected tier.
        const statements = [];

        for (
          let i = 0;
          i < ids.length;
          i++
        ) {
          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET position = ?
                WHERE id = ?
              `)
              .bind(i, ids[i])
          );
        }

        if (statements.length) {
          await env.DB.batch(statements);
        }

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
    // REORDER WITHIN TIER
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

        if (
          !body.tier ||
          !body.positions
        ) {
          throw new Error(
            "Missing tier or positions"
          );
        }

        const statements = [];

        for (
          const [id, position]
          of Object.entries(body.positions)
        ) {
          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET position = ?
                WHERE id = ?
                AND tier = ?
              `)
              .bind(
                Number(position),
                id,
                body.tier
              )
          );
        }

        if (statements.length) {
          await env.DB.batch(statements);
        }

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
    // WEBSITE
    // =========================================================

    return env.ASSETS.fetch(request);
  }
};
