export default {

  async fetch(request, env) {

    const url =
      new URL(
        request.url
      );

    // =========================================================
    // DATABASE SETUP
    // =========================================================

    async function setupDatabase(){

      await env.DB
        .prepare(`
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
        `)
        .run();

      await env.DB
        .prepare(`
          CREATE TABLE IF NOT EXISTS tier_settings (
            tier_key TEXT PRIMARY KEY,
            letter TEXT NOT NULL,
            label TEXT NOT NULL,
            sub TEXT NOT NULL
          )
        `)
        .run();

      const defaults = [

        [
          "SS",
          "SS",
          "Masterpiece",
          "the most impact"
        ],

        [
          "S",
          "S",
          "Excellent",
          "Great games"
        ],

        [
          "A",
          "A",
          "Great",
          "Solid games"
        ],

        [
          "B",
          "B",
          "Good / Okay",
          "Nothing special / meh"
        ],

        [
          "C",
          "C",
          "Mixed / Meh",
          "Mixed experiences"
        ],

        [
          "X",
          "X",
          "Not for me",
          "Dropped / Disliked"
        ],

        [
          "G",
          "G",
          "Childhood legend",
          "Games that stayed with me"
        ]

      ];

      for(
        const row of defaults
      ){

        await env.DB
          .prepare(`
            INSERT OR IGNORE INTO tier_settings
            (tier_key, letter, label, sub)
            VALUES (?, ?, ?, ?)
          `)
          .bind(
            ...row
          )
          .run();

      }

      const oldGames =
        await env.DB
          .prepare(`
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
          `)
          .all();

      for(
        const game
        of oldGames.results || []
      ){

        const oldMusic =
          Number(
            game.music || 0
          );

        const oldSound =
          Number(
            game.sound || 0
          );

        await env.DB
          .prepare(`
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
          `)
          .bind(

            game.id,

            Number(
              game.gameplay || 0
            ),

            Number(
              game.visuals || 0
            ),

            Number(
              game.story || 0
            ),

            Number(
              game.writing || 0
            ),

            Number(
              game.voice || 0
            ),

            Math.round(
              (
                (
                  oldMusic +
                  oldSound
                ) / 2
              ) * 10
            ) / 10,

            0,

            0

          )
          .run();

      }

    }

    // =========================================================
    // AUTH
    // =========================================================

    function isAdmin(
      request
    ){

      const auth =
        request.headers.get(
          "Authorization"
        );

      if(!auth)
        return false;

      const token =
        auth.replace(
          /^Bearer\s+/i,
          ""
        );

      return (
        token ===
        env.ADMIN_PASSWORD
      );

    }

    // =========================================================
    // LOGIN
    // =========================================================

    if(
      url.pathname ===
        "/api/login" &&
      request.method ===
        "POST"
    ){

      try{

        const body =
          await request.json();

        if(
          !body.password ||
          body.password !==
            env.ADMIN_PASSWORD
        ){

          return Response.json(
            {
              success:false,
              error:"Invalid password"
            },
            {
              status:401
            }
          );

        }

        return Response.json({
          success:true,
          token:
            env.ADMIN_PASSWORD
        });

      }catch{

        return Response.json(
          {
            success:false,
            error:"Invalid request"
          },
          {
            status:400
          }
        );

      }

    }

    // =========================================================
    // SETUP
    // =========================================================

    if(
      url.pathname ===
        "/api/setup" &&
      request.method ===
        "POST"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        await setupDatabase();

        return Response.json({
          success:true,
          message:
            "Database setup completed safely."
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // TEST
    // =========================================================

    if(
      url.pathname ===
      "/api/test"
    ){

      try{

        const result =
          await env.DB
            .prepare(
              "SELECT COUNT(*) AS count FROM games"
            )
            .first();

        return Response.json({
          success:true,
          games:
            result.count
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // GET GAMES
    // =========================================================

    if(
      url.pathname ===
        "/api/games" &&
      request.method ===
        "GET"
    ){

      try{

        const gamesResult =
          await env.DB
            .prepare(`
              SELECT
                g.*,
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
              ORDER BY
                g.position ASC
            `)
            .all();

        const games =
          (
            gamesResult.results ||
            []
          )
          .map(
            game => {

              const tier =
                game.tier;

              const ratings = [

                Number(
                  game.gameplay || 0
                ),

                Number(
                  game.graphics || 0
                ),

                Number(
                  game.story_pacing || 0
                ),

                Number(
                  game.writing || 0
                ),

                Number(
                  game.voice_acting || 0
                ),

                Number(
                  game.music_audio || 0
                ),

                Number(
                  game.technical_performance || 0
                ),

                Number(
                  game.emotional_impact || 0
                )

              ];

              const calculated =
                Math.round(
                  (
                    ratings.reduce(
                      (a,b) =>
                        a+b,
                      0
                    ) /
                    ratings.length
                  ) * 10
                ) / 10;

              const overall =
                game.custom_overall !== null &&
                game.custom_overall !== undefined &&
                game.custom_overall !== ""
                  ? Number(
                      game.custom_overall
                    )
                  : calculated;

              return {

                id:
                  game.id,

                name:
                  game.name,

                tier,

                commentary:
                  game.commentary || "",

                position:
                  Number(
                    game.position || 0
                  ),

                gameplay:
                  Number(
                    game.gameplay || 0
                  ),

                graphics:
                  Number(
                    game.graphics || 0
                  ),

                story_pacing:
                  Number(
                    game.story_pacing || 0
                  ),

                writing:
                  Number(
                    game.writing || 0
                  ),

                voice_acting:
                  Number(
                    game.voice_acting || 0
                  ),

                music_audio:
                  Number(
                    game.music_audio || 0
                  ),

                technical_performance:
                  Number(
                    game.technical_performance || 0
                  ),

                emotional_impact:
                  Number(
                    game.emotional_impact || 0
                  ),

                custom_overall:
                  game.custom_overall === null ||
                  game.custom_overall === undefined ||
                  game.custom_overall === ""
                    ? null
                    : Number(
                        game.custom_overall
                      ),

                overall

              };

            }
          );

        return Response.json({
          success:true,
          games
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // UPDATE GAME
    // =========================================================

    if(
      url.pathname ===
        "/api/games" &&
      request.method ===
        "PUT"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const body =
          await request.json();

        if(!body.id){

          throw new Error(
            "Game ID is required"
          );

        }

        const current =
          await env.DB
            .prepare(
              "SELECT * FROM games WHERE id = ?"
            )
            .bind(
              body.id
            )
            .first();

        if(!current){

          throw new Error(
            "Game not found"
          );

        }

        const name =
          body.name !== undefined
            ? String(
                body.name
              )
            : current.name;

        const commentary =
          body.commentary !== undefined
            ? String(
                body.commentary
              )
            : current.commentary || "";

        const tier =
          body.tier !== undefined
            ? String(
                body.tier
              )
            : current.tier;

        await env.DB
          .prepare(`
            UPDATE games
            SET
              name = ?,
              tier = ?,
              commentary = ?
            WHERE id = ?
          `)
          .bind(
            name,
            tier,
            commentary,
            body.id
          )
          .run();

        const oldRatings =
          await env.DB
            .prepare(`
              SELECT *
              FROM game_ratings
              WHERE game_id = ?
            `)
            .bind(
              body.id
            )
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

        for(
          const field
          of fields
        ){

          values[field] =
            body[field] !== undefined
              ? Number(
                  body[field]
                ) || 0
              : Number(
                  oldRatings?.[field] || 0
                );

        }

        let customOverall;

        if(
          body.custom_overall !==
          undefined
        ){

          if(
            body.custom_overall === null ||
            body.custom_overall === ""
          ){

            customOverall =
              null;

          }else{

            customOverall =
              Number(
                body.custom_overall
              );

            if(
              !Number.isFinite(
                customOverall
              )
            ){

              customOverall =
                null;

            }

          }

        }else{

          customOverall =
            oldRatings?.custom_overall ===
              null ||
            oldRatings?.custom_overall ===
              undefined
              ? null
              : Number(
                  oldRatings.custom_overall
                );

        }

        await env.DB
          .prepare(`
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(game_id)
            DO UPDATE SET
              gameplay = excluded.gameplay,
              graphics = excluded.graphics,
              story_pacing = excluded.story_pacing,
              writing = excluded.writing,
              voice_acting = excluded.voice_acting,
              music_audio = excluded.music_audio,
              technical_performance =
                excluded.technical_performance,
              emotional_impact =
                excluded.emotional_impact,
              custom_overall =
                excluded.custom_overall
          `)
          .bind(

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

          )
          .run();

        return Response.json({
          success:true
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // ADD GAME
    // =========================================================

    if(
      url.pathname ===
        "/api/games" &&
      request.method ===
        "POST"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const body =
          await request.json();

        const id =
          body.id ||
          "g_" +
          Date.now()
            .toString(36) +
          Math.random()
            .toString(36)
            .substring(2,7);

        const maxPosition =
          await env.DB
            .prepare(`
              SELECT
                MAX(position)
                AS maxPosition
              FROM games
            `)
            .first();

        const position =
          maxPosition?.maxPosition != null
            ? Number(
                maxPosition.maxPosition
              ) + 1
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
          `)
          .bind(
            id,
            body.name ||
              "New Game",
            body.tier ||
              "A",
            body.commentary ||
              "",
            position
          )
          .run();

        await env.DB
          .prepare(`
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
          `)
          .bind(
            id
          )
          .run();

        return Response.json({
          success:true,
          id
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // DELETE GAME
    // =========================================================

    if(
      url.pathname.startsWith(
        "/api/games/"
      ) &&
      request.method ===
        "DELETE"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const id =
          decodeURIComponent(
            url.pathname
              .split("/")
              .pop()
          );

        await env.DB
          .prepare(
            "DELETE FROM game_ratings WHERE game_id = ?"
          )
          .bind(
            id
          )
          .run();

        await env.DB
          .prepare(
            "DELETE FROM games WHERE id = ?"
          )
          .bind(
            id
          )
          .run();

        return Response.json({
          success:true
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // MOVE GAME
    // =========================================================

    if(
      url.pathname ===
        "/api/games/move" &&
      request.method ===
        "POST"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const body =
          await request.json();

        if(
          !body.id ||
          !body.tier
        ){

          throw new Error(
            "Missing game ID or tier"
          );

        }

        const gameId =
          String(
            body.id
          );

        const targetTier =
          String(
            body.tier
          );

        let requestedPosition =
          Number(
            body.position
          );

        if(
          !Number.isFinite(
            requestedPosition
          )
        ){

          requestedPosition =
            0;

        }

        requestedPosition =
          Math.max(
            0,
            Math.floor(
              requestedPosition
            )
          );

        const movingGame =
          await env.DB
            .prepare(`
              SELECT id, tier
              FROM games
              WHERE id = ?
            `)
            .bind(
              gameId
            )
            .first();

        if(!movingGame){

          throw new Error(
            "Game not found"
          );

        }

        const sourceTier =
          String(
            movingGame.tier
          );

        const sourceResult =
          await env.DB
            .prepare(`
              SELECT id
              FROM games
              WHERE tier = ?
              AND id != ?
              ORDER BY
                position ASC,
                id ASC
            `)
            .bind(
              sourceTier,
              gameId
            )
            .all();

        const sourceIds =
          (
            sourceResult.results ||
            []
          )
          .map(
            row => row.id
          );

        let targetIds = [];

        if(
          sourceTier ===
          targetTier
        ){

          targetIds =
            [
              ...sourceIds
            ];

        }else{

          const targetResult =
            await env.DB
              .prepare(`
                SELECT id
                FROM games
                WHERE tier = ?
                ORDER BY
                  position ASC,
                  id ASC
              `)
              .bind(
                targetTier
              )
              .all();

          targetIds =
            (
              targetResult.results ||
              []
            )
            .map(
              row => row.id
            );

        }

        const insertPosition =
          Math.min(
            requestedPosition,
            targetIds.length
          );

        targetIds.splice(
          insertPosition,
          0,
          gameId
        );

        const statements = [];

        if(
          sourceTier !==
          targetTier
        ){

          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET tier = ?
                WHERE id = ?
              `)
              .bind(
                targetTier,
                gameId
              )
          );

        }

        for(
          let i = 0;
          i < sourceIds.length;
          i++
        ){

          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET position = ?
                WHERE id = ?
              `)
              .bind(
                i,
                sourceIds[i]
              )
          );

        }

        for(
          let i = 0;
          i < targetIds.length;
          i++
        ){

          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET position = ?
                WHERE id = ?
              `)
              .bind(
                i,
                targetIds[i]
              )
          );

        }

        if(
          statements.length
        ){

          await env.DB.batch(
            statements
          );

        }

        return Response.json({
          success:true,
          tier:
            targetTier,
          position:
            insertPosition
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // REORDER
    // =========================================================

    if(
      url.pathname ===
        "/api/games/reorder" &&
      request.method ===
        "POST"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const body =
          await request.json();

        const positions =
          body.positions || {};

        const statements = [];

        for(
          const [
            id,
            position
          ]
          of Object.entries(
            positions
          )
        ){

          const numericPosition =
            Number(
              position
            );

          if(
            !Number.isFinite(
              numericPosition
            )
          )
            continue;

          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET position = ?
                WHERE id = ?
              `)
              .bind(
                numericPosition,
                id
              )
          );

        }

        if(
          statements.length
        ){

          await env.DB.batch(
            statements
          );

        }

        return Response.json({
          success:true
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // TIER SETTINGS
    // =========================================================

    if(
      url.pathname ===
        "/api/tiers" &&
      request.method ===
        "GET"
    ){

      try{

        const result =
          await env.DB
            .prepare(`
              SELECT *
              FROM tier_settings
              ORDER BY
                CASE tier_key
                  WHEN 'SS' THEN 1
                  WHEN 'S' THEN 2
                  WHEN 'A' THEN 3
                  WHEN 'B' THEN 4
                  WHEN 'C' THEN 5
                  WHEN 'X' THEN 6
                  WHEN 'G' THEN 7
                  ELSE 99
                END
            `)
            .all();

        return Response.json({
          success:true,
          tiers:
            result.results || []
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // UPDATE TIER SETTINGS
    // =========================================================

    if(
      url.pathname ===
        "/api/tiers" &&
      request.method ===
        "PUT"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const body =
          await request.json();

        if(
          !body.tier_key
        ){

          throw new Error(
            "Tier key is required"
          );

        }

        await env.DB
          .prepare(`
            UPDATE tier_settings
            SET
              letter = ?,
              label = ?,
              sub = ?
            WHERE tier_key = ?
          `)
          .bind(

            String(
              body.letter ??
              ""
            ),

            String(
              body.label ??
              ""
            ),

            String(
              body.sub ??
              ""
            ),

            body.tier_key

          )
          .run();

        return Response.json({
          success:true
        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // BACKUP IMPORT
    // =========================================================

    if(
      url.pathname ===
        "/api/backup/import" &&
      request.method ===
        "POST"
    ){

      if(
        !isAdmin(request)
      ){

        return Response.json(
          {
            success:false,
            error:"Unauthorized"
          },
          {
            status:401
          }
        );

      }

      try{

        const body =
          await request.json();

        if(
          body?.format !==
            "played-tier-list-backup"
        ){

          throw new Error(
            "Invalid backup format"
          );

        }

        if(
          !Array.isArray(
            body.games
          ) ||
          !Array.isArray(
            body.tiers
          )
        ){

          throw new Error(
            "Backup is missing games or tier settings"
          );

        }

        const allowedTiers =
          new Set(
            body.tiers.map(
              t =>
                String(
                  t.tier_key
                )
            )
          );

        for(
          const game
          of body.games
        ){

          if(
            !game.id ||
            !game.name ||
            !allowedTiers.has(
              String(
                game.tier
              )
            )
          ){

            throw new Error(
              "Backup contains an invalid game entry"
            );

          }

        }

        /*
         * Clear current data.
         *
         * Ratings are removed first because
         * they reference game IDs.
         */

        await env.DB.batch([
          env.DB.prepare(
            "DELETE FROM game_ratings"
          ),
          env.DB.prepare(
            "DELETE FROM games"
          )
        ]);

        /*
         * Restore tier descriptions.
         */

        const tierStatements = [];

        for(
          const tier
          of body.tiers
        ){

          tierStatements.push(

            env.DB.prepare(`
              INSERT INTO tier_settings (
                tier_key,
                letter,
                label,
                sub
              )
              VALUES (?, ?, ?, ?)
              ON CONFLICT(tier_key)
              DO UPDATE SET
                letter =
                  excluded.letter,
                label =
                  excluded.label,
                sub =
                  excluded.sub
            `)
            .bind(

              String(
                tier.tier_key
              ),

              String(
                tier.letter ??
                ""
              ),

              String(
                tier.label ??
                ""
              ),

              String(
                tier.sub ??
                ""
              )

            )

          );

        }

        if(
          tierStatements.length
        ){

          await env.DB.batch(
            tierStatements
          );

        }

        /*
         * Keep batches comfortably below
         * D1 statement limits.
         */

        let batch = [];

        const flush =
          async () => {

            if(
              !batch.length
            )
              return;

            await env.DB.batch(
              batch
            );

            batch = [];

          };

        for(
          const game
          of body.games
        ){

          const ratings = {

            gameplay:
              Number(
                game.gameplay || 0
              ),

            graphics:
              Number(
                game.graphics || 0
              ),

            story_pacing:
              Number(
                game.story_pacing || 0
              ),

            writing:
              Number(
                game.writing || 0
              ),

            voice_acting:
              Number(
                game.voice_acting || 0
              ),

            music_audio:
              Number(
                game.music_audio || 0
              ),

            technical_performance:
              Number(
                game.technical_performance || 0
              ),

            emotional_impact:
              Number(
                game.emotional_impact || 0
              )

          };

          let customOverall =
            null;

          if(
            game.custom_overall !== null &&
            game.custom_overall !== undefined &&
            game.custom_overall !== ""
          ){

            customOverall =
              Number(
                game.custom_overall
              );

            if(
              !Number.isFinite(
                customOverall
              )
            ){

              customOverall =
                null;

            }

          }

          /*
           * Restore the legacy games columns too,
           * because the existing database still has them.
           */

          batch.push(

            env.DB.prepare(`
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
            `)
            .bind(

              String(
                game.id
              ),

              String(
                game.name
              ),

              String(
                game.tier
              ),

              ratings.gameplay,

              ratings.graphics,

              ratings.story_pacing,

              ratings.music_audio,

              ratings.voice_acting,

              ratings.music_audio,

              ratings.writing,

              String(
                game.commentary ??
                ""
              ),

              Number(
                game.position || 0
              )

            )

          );

          /*
           * Restore the actual current rating
           * system, including custom overall.
           */

          batch.push(

            env.DB.prepare(`
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
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(

              String(
                game.id
              ),

              ratings.gameplay,

              ratings.graphics,

              ratings.story_pacing,

              ratings.writing,

              ratings.voice_acting,

              ratings.music_audio,

              ratings.technical_performance,

              ratings.emotional_impact,

              customOverall

            )

          );

          if(
            batch.length >=
            88
          ){

            await flush();

          }

        }

        await flush();

        return Response.json({

          success:true,

          games:
            body.games.length,

          tiers:
            body.tiers.length

        });

      }catch(error){

        return Response.json(
          {
            success:false,
            error:error.message
          },
          {
            status:500
          }
        );

      }

    }

    // =========================================================
    // WEBSITE
    // =========================================================

    return env.ASSETS.fetch(
      request
    );

  }

};
