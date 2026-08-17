export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    function json(data, status = 200) {
      return Response.json(data, { status });
    }

    function isAdmin(request) {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
      return !!env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD;
    }

    // =========================================================
    // ONE-TIME DATABASE SETUP / MIGRATION
    // =========================================================

    async function setupDatabase() {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS game_ratings (
          game_id TEXT PRIMARY KEY,
          gameplay REAL DEFAULT 0,
          graphics REAL DEFAULT 0,
          story_pacing REAL DEFAULT 0,
          writing REAL DEFAULT 0,
          voice_acting REAL DEFAULT 0,
          music_audio REAL DEFAULT 0,
          technical_performance REAL DEFAULT 0,
          emotional_impact REAL DEFAULT 0,
          custom_overall REAL
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS tier_settings (
          tier_key TEXT PRIMARY KEY,
          letter TEXT NOT NULL,
          label TEXT NOT NULL,
          sub TEXT NOT NULL
        )
      `).run();

      const defaults = [
        ["SS", "SS", "Masterpiece", "the most impact"],
        ["S", "S", "Excellent", "Great games"],
        ["A", "A", "Great", "Solid games"],
        ["B", "B", "Good / Okay", "Nothing special / meh"],
        ["C", "C", "Mixed / Meh", "Mixed experiences"],
        ["X", "X", "Not for me", "Dropped / Disliked"],
        ["G", "G", "Childhood legend", "Games that stayed with me"]
      ];

      for (const row of defaults) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO tier_settings
            (tier_key, letter, label, sub)
          VALUES (?, ?, ?, ?)
        `).bind(...row).run();
      }

      // The original database used S/A/B/F/X for the old five-tier list.
      // Only perform this conversion when it is clearly an old database:
      // there are F-tier games and none of the new-only SS/C/G tiers yet.
      const legacyCheck = await env.DB.prepare(`
        SELECT
          SUM(CASE WHEN tier = 'F' THEN 1 ELSE 0 END) AS f_count,
          SUM(CASE WHEN tier IN ('SS','C','G') THEN 1 ELSE 0 END) AS new_count
        FROM games
      `).first();

      if (
        Number(legacyCheck?.f_count || 0) > 0 &&
        Number(legacyCheck?.new_count || 0) === 0
      ) {
        // Temporary names prevent collisions during conversion.

        await env.DB.prepare(
          "UPDATE games SET tier = '__LEGACY_SS' WHERE tier = 'S'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = '__LEGACY_S' WHERE tier = 'A'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = '__LEGACY_A' WHERE tier = 'B'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = '__LEGACY_B' WHERE tier = 'F'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = 'SS' WHERE tier = '__LEGACY_SS'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = 'S' WHERE tier = '__LEGACY_S'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = 'A' WHERE tier = '__LEGACY_A'"
        ).run();

        await env.DB.prepare(
          "UPDATE games SET tier = 'B' WHERE tier = '__LEGACY_B'"
        ).run();
      }

      // Copy the old seven ratings into the new eight-category table
      // only for games that do not already have a rating row.

      const oldGames = await env.DB.prepare(`
        SELECT
          id,
          gameplay,
          visuals,
          story,
          music,
          voice,
          sound,
          writing
        FROM games
      `).all();

      for (const game of oldGames.results || []) {
        const oldMusic = Number(game.music || 0);
        const oldSound = Number(game.sound || 0);

        await env.DB.prepare(`
          INSERT OR IGNORE INTO game_ratings (
            game_id,
            gameplay,
            graphics,
            story_pacing,
            writing,
            voice_acting,
            music_audio,
            technical_performance,
            emotional_impact
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          game.id,
          Number(game.gameplay || 0),
          Number(game.visuals || 0),
          Number(game.story || 0),
          Number(game.writing || 0),
          Number(game.voice || 0),
          Math.round(((oldMusic + oldSound) / 2) * 10) / 10,
          0,
          0
        ).run();
      }
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

      } catch {
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
    // SETUP / MIGRATION
    //
    // This is NOT run automatically on every request.
    // Run once manually if the database has not already been
    // prepared by the previous worker.
    // =========================================================

    if (
      (
        url.pathname === "/api/setup" ||
        url.pathname === "/api/migrate"
      ) &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {
        await setupDatabase();

        return json({
          success: true,
          message: "Database setup / migration completed."
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
    // TEST D1
    // =========================================================

    if (url.pathname === "/api/test") {
      try {
        const result = await env.DB
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
    // GET GAMES
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "GET"
    ) {
      try {
        const result = await env.DB.prepare(`
          SELECT
            g.id,
            g.name,
            g.tier,
            g.commentary,
            g.position,

            r.gameplay,
            r.graphics,
            r.story_pacing,
            r.writing,
            r.voice_acting,
            r.music_audio,
            r.technical_performance,
            r.emotional_impact,
            r.custom_overall

          FROM games g

          LEFT JOIN game_ratings r
            ON g.id = r.game_id

          ORDER BY g.position ASC
        `).all();

        // Compatibility with databases that still contain the
        // original five-tier values.
        const legacyMap = {
          S: "SS",
          A: "S",
          B: "A",
          F: "B"
        };

        const games =
          (result.results || []).map(game => {

            const ratings = [
              Number(game.gameplay || 0),
              Number(game.graphics || 0),
              Number(game.story_pacing || 0),
              Number(game.writing || 0),
              Number(game.voice_acting || 0),
              Number(game.music_audio || 0),
              Number(game.technical_performance || 0),
              Number(game.emotional_impact || 0)
            ];

            const calculated =
              Math.round(
                (
                  ratings.reduce(
                    (a, b) => a + b,
                    0
                  ) /
                  ratings.length
                ) * 10
              ) / 10;

            const custom =
              game.custom_overall !== null &&
              game.custom_overall !== undefined &&
              game.custom_overall !== ""
                ? Number(game.custom_overall)
                : null;

            return {
              id: game.id,

              name: game.name,

              tier:
                legacyMap[game.tier] ||
                game.tier,

              commentary:
                game.commentary || "",

              position:
                Number(game.position || 0),

              gameplay:
                Number(game.gameplay || 0),

              graphics:
                Number(game.graphics || 0),

              story_pacing:
                Number(game.story_pacing || 0),

              writing:
                Number(game.writing || 0),

              voice_acting:
                Number(game.voice_acting || 0),

              music_audio:
                Number(game.music_audio || 0),

              technical_performance:
                Number(
                  game.technical_performance || 0
                ),

              emotional_impact:
                Number(
                  game.emotional_impact || 0
                ),

              custom_overall:
                custom,

              overall:
                custom !== null &&
                Number.isFinite(custom)
                  ? custom
                  : calculated
            };
          });

        return json({
          success: true,
          games
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
    // Partial update.
    // Missing fields are preserved.
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "PUT"
    ) {
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {
        const body = await request.json();

        if (!body.id) {
          return json(
            {
              success: false,
              error: "Game ID is required"
            },
            400
          );
        }

        const current =
          await env.DB
            .prepare(`
              SELECT
                id,
                name,
                tier,
                commentary
              FROM games
              WHERE id = ?
            `)
            .bind(body.id)
            .first();

        if (!current) {
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
            : String(current.name || "");

        const tier =
          body.tier !== undefined
            ? String(body.tier)
            : String(current.tier || "B");

        const commentary =
          body.commentary !== undefined
            ? String(body.commentary)
            : String(current.commentary || "");

        await env.DB.prepare(`
          UPDATE games
          SET
            name = ?,
            tier = ?,
            commentary = ?
          WHERE id = ?
        `).bind(
          name,
          tier,
          commentary,
          body.id
        ).run();

        const old =
          await env.DB
            .prepare(`
              SELECT *
              FROM game_ratings
              WHERE game_id = ?
            `)
            .bind(body.id)
            .first();

        const fields = [
          "gameplay",
          "graphics",
          "story_pacing",
          "writing",
          "voice_acting",
          "music_audio",
          "technical_performance",
          "emotional_impact"
        ];

        const values = {};

        for (const field of fields) {

          if (
            Object.prototype.hasOwnProperty.call(
              body,
              field
            )
          ) {
            const n = Number(body[field]);

            values[field] =
              Number.isFinite(n)
                ? n
                : 0;

          } else {

            values[field] =
              Number(old?.[field] || 0);
          }
        }

        let customOverall;

        if (
          Object.prototype.hasOwnProperty.call(
            body,
            "custom_overall"
          )
        ) {

          if (
            body.custom_overall === null ||
            body.custom_overall === ""
          ) {

            customOverall = null;

          } else {

            const n =
              Number(body.custom_overall);

            customOverall =
              Number.isFinite(n)
                ? n
                : null;
          }

        } else {

          customOverall =
            old?.custom_overall == null
              ? null
              : Number(old.custom_overall);
        }

        await env.DB.prepare(`
          INSERT INTO game_ratings (
            game_id,
            gameplay,
            graphics,
            story_pacing,
            writing,
            voice_acting,
            music_audio,
            technical_performance,
            emotional_impact,
            custom_overall
          )

          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )

          ON CONFLICT(game_id)
          DO UPDATE SET
            gameplay =
              excluded.gameplay,

            graphics =
              excluded.graphics,

            story_pacing =
              excluded.story_pacing,

            writing =
              excluded.writing,

            voice_acting =
              excluded.voice_acting,

            music_audio =
              excluded.music_audio,

            technical_performance =
              excluded.technical_performance,

            emotional_impact =
              excluded.emotional_impact,

            custom_overall =
              excluded.custom_overall
        `).bind(
          body.id,
          values.gameplay,
          values.graphics,
          values.story_pacing,
          values.writing,
          values.voice_acting,
          values.music_audio,
          values.technical_performance,
          values.emotional_impact,
          customOverall
        ).run();

        return json({
          success: true
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
    // ADD GAME
    // =========================================================

    if (
      url.pathname === "/api/games" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {

        const body =
          await request.json();

        const id =
          body.id ||
          (
            "g_" +
            Date.now().toString(36) +
            Math.random()
              .toString(36)
              .substring(2, 7)
          );

        const tier =
          String(body.tier || "A");

        const maxPosition =
          await env.DB
            .prepare(`
              SELECT
                MAX(position)
                AS maxPosition

              FROM games

              WHERE tier = ?
            `)
            .bind(tier)
            .first();

        const position =
          maxPosition?.maxPosition != null
            ? Number(
                maxPosition.maxPosition
              ) + 1
            : 0;

        await env.DB.prepare(`
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

          VALUES (
            ?,
            ?,
            ?,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            ?,
            ?
          )
        `).bind(
          id,
          body.name || "New Game",
          tier,
          body.commentary || "",
          position
        ).run();

        await env.DB.prepare(`
          INSERT INTO game_ratings (
            game_id,
            gameplay,
            graphics,
            story_pacing,
            writing,
            voice_acting,
            music_audio,
            technical_performance,
            emotional_impact,
            custom_overall
          )

          VALUES (
            ?,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            NULL
          )
        `).bind(id).run();

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
    // MOVE / REORDER GAME
    // =========================================================

    if (
      url.pathname === "/api/games/move" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {

        const body =
          await request.json();

        if (
          !body.id ||
          !body.tier
        ) {
          return json(
            {
              success: false,
              error:
                "Missing game ID or tier"
            },
            400
          );
        }

        const targetTier =
          String(body.tier);

        const moving =
          await env.DB
            .prepare(`
              SELECT
                id,
                tier
              FROM games
              WHERE id = ?
            `)
            .bind(body.id)
            .first();

        if (!moving) {
          return json(
            {
              success: false,
              error: "Game not found"
            },
            404
          );
        }

        const sourceTier =
          String(
            moving.tier || ""
          );

        let targetPosition =
          Number(body.position);

        if (
          !Number.isFinite(
            targetPosition
          )
        ) {
          targetPosition = 0;
        }

        targetPosition =
          Math.max(
            0,
            Math.floor(
              targetPosition
            )
          );

        const targetRows =
          await env.DB.prepare(`
            SELECT id
            FROM games
            WHERE tier = ?
              AND id != ?
            ORDER BY position ASC
          `).bind(
            targetTier,
            body.id
          ).all();

        const targetIds =
          (
            targetRows.results || []
          ).map(row => row.id);

        targetPosition =
          Math.min(
            targetPosition,
            targetIds.length
          );

        targetIds.splice(
          targetPosition,
          0,
          body.id
        );

        // Compact old tier if necessary.

        if (
          sourceTier !==
          targetTier
        ) {

          const sourceRows =
            await env.DB.prepare(`
              SELECT id
              FROM games
              WHERE tier = ?
                AND id != ?
              ORDER BY position ASC
            `).bind(
              sourceTier,
              body.id
            ).all();

          const sourceIds =
            (
              sourceRows.results || []
            ).map(row => row.id);

          for (
            let i = 0;
            i < sourceIds.length;
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
                sourceIds[i]
              )
              .run();
          }
        }

        // Rewrite only the destination tier.

        for (
          let i = 0;
          i < targetIds.length;
          i++
        ) {

          await env.DB
            .prepare(`
              UPDATE games
              SET
                tier = ?,
                position = ?
              WHERE id = ?
            `)
            .bind(
              targetTier,
              i,
              targetIds[i]
            )
            .run();
        }

        return json({
          success: true
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
    // REORDER POSITIONS
    // =========================================================

    if (
      url.pathname === "/api/games/reorder" &&
      request.method === "POST"
    ) {
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {

        const body =
          await request.json();

        const positions =
          body.positions || {};

        for (
          const [id, position]
          of Object.entries(
            positions
          )
        ) {

          const n =
            Number(position);

          if (
            !Number.isFinite(n)
          ) {
            continue;
          }

          await env.DB
            .prepare(`
              UPDATE games
              SET position = ?
              WHERE id = ?
            `)
            .bind(
              n,
              id
            )
            .run();
        }

        return json({
          success: true
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
    // GET TIER SETTINGS
    // =========================================================

    if (
      url.pathname === "/api/tiers" &&
      request.method === "GET"
    ) {
      try {

        const result =
          await env.DB.prepare(`
            SELECT
              tier_key,
              letter,
              label,
              sub

            FROM tier_settings

            ORDER BY CASE tier_key
              WHEN 'SS' THEN 1
              WHEN 'S' THEN 2
              WHEN 'A' THEN 3
              WHEN 'B' THEN 4
              WHEN 'C' THEN 5
              WHEN 'X' THEN 6
              WHEN 'G' THEN 7
              ELSE 99
            END
          `).all();

        return json({
          success: true,
          tiers:
            result.results || []
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
    // UPDATE TIER SETTINGS
    // =========================================================

    if (
      url.pathname === "/api/tiers" &&
      request.method === "PUT"
    ) {
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {

        const body =
          await request.json();

        if (!body.tier_key) {
          return json(
            {
              success: false,
              error:
                "Tier key is required"
            },
            400
          );
        }

        await env.DB.prepare(`
          UPDATE tier_settings

          SET
            letter = ?,
            label = ?,
            sub = ?

          WHERE tier_key = ?
        `).bind(
          String(
            body.letter ?? ""
          ),
          String(
            body.label ?? ""
          ),
          String(
            body.sub ?? ""
          ),
          String(
            body.tier_key
          )
        ).run();

        return json({
          success: true
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
      if (!isAdmin(request)) {
        return json(
          {
            success: false,
            error: "Unauthorized"
          },
          401
        );
      }

      try {

        const id =
          decodeURIComponent(
            url.pathname
              .split("/")
              .pop()
          );

        const game =
          await env.DB
            .prepare(`
              SELECT tier
              FROM games
              WHERE id = ?
            `)
            .bind(id)
            .first();

        await env.DB
          .prepare(`
            DELETE FROM game_ratings
            WHERE game_id = ?
          `)
          .bind(id)
          .run();

        await env.DB
          .prepare(`
            DELETE FROM games
            WHERE id = ?
          `)
          .bind(id)
          .run();

        if (game?.tier) {

          const rows =
            await env.DB.prepare(`
              SELECT id
              FROM games
              WHERE tier = ?
              ORDER BY position ASC
            `).bind(
              game.tier
            ).all();

          for (
            let i = 0;
            i < (
              rows.results || []
            ).length;
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
                rows.results[i].id
              )
              .run();
          }
        }

        return json({
          success: true
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
