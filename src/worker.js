export default {

  async fetch(request, env) {

    const url =
      new URL(request.url);

    /* =======================================================
       HELPERS
    ======================================================= */

    function json(data, status = 200){

      return Response.json(
        data,
        {
          status,
          headers:{
            "Cache-Control":"no-store"
          }
        }
      );

    }

    function isAdmin(request){

      const auth =
        request.headers.get(
          "Authorization"
        );

      if(!auth)
        return false;

      const token =
        auth.startsWith("Bearer ")
          ? auth.slice(7)
          : auth;

      return (
        token ===
        env.ADMIN_PASSWORD
      );

    }

    async function requireAdmin(){

      return null;

    }

    /*
      Make sure the optional manual_score column exists.

      This is intentionally checked automatically so you don't
      have to manually edit the D1 database schema.
    */

    async function ensureManualScoreColumn(){

      try{

        const columns =
          await env.DB
            .prepare(
              "PRAGMA table_info(games)"
            )
            .all();

        const exists =
          (columns.results || [])
            .some(
              column =>
                column.name ===
                "manual_score"
            );

        if(!exists){

          await env.DB
            .prepare(
              "ALTER TABLE games ADD COLUMN manual_score REAL DEFAULT NULL"
            )
            .run();

        }

      }catch(error){

        /*
          If another request already added it,
          SQLite may complain. We can safely
          continue in that case.
        */

        if(
          !String(
            error.message || ''
          ).toLowerCase()
          .includes(
            'duplicate'
          )
        ){

          throw error;

        }

      }

    }

    /* =======================================================
       LOGIN
    ======================================================= */

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

          return json(
            {
              success:false,
              error:"Invalid password"
            },
            401
          );

        }

        return json({
          success:true,
          token:env.ADMIN_PASSWORD
        });

      }catch(error){

        return json(
          {
            success:false,
            error:"Invalid request"
          },
          400
        );

      }

    }

    /* =======================================================
       TEST D1
    ======================================================= */

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

        return json({
          success:true,
          games:result.count
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       MIGRATION
    ======================================================= */

    if(
      url.pathname ===
      "/api/migrate" &&
      request.method ===
      "POST"
    ){

      if(!isAdmin(request)){

        return json(
          {
            success:false,
            error:"Unauthorized"
          },
          401
        );

      }

      try{

        await ensureManualScoreColumn();

        /*
          IMPORTANT:

          Keep your existing migration array here if you still
          need the original migration.

          The database already contains your games, so this
          endpoint is mainly retained for compatibility.
        */

        const existing =
          await env.DB
            .prepare(
              "SELECT COUNT(*) AS count FROM games"
            )
            .first();

        return json({
          success:true,
          message:
            "Database schema checked",
          games:existing.count
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       GET ALL GAMES
    ======================================================= */

    if(
      url.pathname ===
      "/api/games" &&
      request.method ===
      "GET"
    ){

      try{

        await ensureManualScoreColumn();

        const result =
          await env.DB
            .prepare(`
              SELECT *
              FROM games
              ORDER BY tier, position ASC
            `)
            .all();

        /*
          The frontend itself determines tier order,
          so database tier ordering here doesn't affect
          the visual SS/S/A/B/X order.
        */

        return json({
          success:true,
          games:
            result.results || []
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       UPDATE GAME
    ======================================================= */

    if(
      url.pathname ===
      "/api/games" &&
      request.method ===
      "PUT"
    ){

      if(!isAdmin(request)){

        return json(
          {
            success:false,
            error:"Unauthorized"
          },
          401
        );

      }

      try{

        await ensureManualScoreColumn();

        const body =
          await request.json();

        if(!body.id){

          return json(
            {
              success:false,
              error:"Missing game id"
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

        if(!existing){

          return json(
            {
              success:false,
              error:"Game not found"
            },
            404
          );

        }

        /*
          IMPORTANT:

          Only fields actually supplied by the frontend
          are changed. This prevents undefined values from
          reaching D1.
        */

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
            ? Number(body.gameplay)
            : Number(existing.gameplay || 0);

        const visuals =
          body.visuals !== undefined
            ? Number(body.visuals)
            : Number(existing.visuals || 0);

        const story =
          body.story !== undefined
            ? Number(body.story)
            : Number(existing.story || 0);

        const music =
          body.music !== undefined
            ? Number(body.music)
            : Number(existing.music || 0);

        const voice =
          body.voice !== undefined
            ? Number(body.voice)
            : Number(existing.voice || 0);

        const sound =
          body.sound !== undefined
            ? Number(body.sound)
            : Number(existing.sound || 0);

        const writing =
          body.writing !== undefined
            ? Number(body.writing)
            : Number(existing.writing || 0);

        const commentary =
          body.commentary !== undefined
            ? String(body.commentary)
            : (existing.commentary || "");

        let manualScore;

        if(
          body.manual_score === null ||
          body.manual_score === ''
        ){

          manualScore = null;

        }else if(
          body.manual_score !== undefined
        ){

          manualScore =
            Number(body.manual_score);

          if(
            !Number.isFinite(
              manualScore
            )
          ){

            return json(
              {
                success:false,
                error:
                  "Invalid manual score"
              },
              400
            );

          }

          manualScore =
            Math.max(
              0,
              Math.min(
                10,
                Math.round(
                  manualScore * 10
                ) / 10
              )
            );

        }else{

          manualScore =
            existing.manual_score;

        }

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
              manual_score = ?
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
            manualScore,
            body.id
          )
          .run();

        return json({
          success:true,
          message:"Game updated"
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       ADD GAME
    ======================================================= */

    if(
      url.pathname ===
      "/api/games" &&
      request.method ===
      "POST"
    ){

      if(!isAdmin(request)){

        return json(
          {
            success:false,
            error:"Unauthorized"
          },
          401
        );

      }

      try{

        await ensureManualScoreColumn();

        const body =
          await request.json();

        const id =
          body.id ||
          "g_" +
          Date.now().toString(36) +
          Math.random()
            .toString(36)
            .substring(2,7);

        const tier =
          body.tier || "B";

        const maxPosition =
          await env.DB
            .prepare(`
              SELECT MAX(position) AS maxPosition
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
              manual_score
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?
            )
          `)
          .bind(
            id,
            body.name ||
              "New Game",
            tier,
            Number(body.gameplay) || 0,
            Number(body.visuals) || 0,
            Number(body.story) || 0,
            Number(body.music) || 0,
            Number(body.voice) || 0,
            Number(body.sound) || 0,
            Number(body.writing) || 0,
            body.commentary ??
              "",
            position,
            body.manual_score ??
              null
          )
          .run();

        return json({
          success:true,
          id
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       DELETE GAME
    ======================================================= */

    if(
      url.pathname.startsWith(
        "/api/games/"
      ) &&
      request.method ===
      "DELETE"
    ){

      if(!isAdmin(request)){

        return json(
          {
            success:false,
            error:"Unauthorized"
          },
          401
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
            "DELETE FROM games WHERE id = ?"
          )
          .bind(id)
          .run();

        return json({
          success:true,
          message:"Game deleted"
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       MOVE GAME
    ======================================================= */

    if(
      url.pathname ===
      "/api/games/move" &&
      request.method ===
      "POST"
    ){

      if(!isAdmin(request)){

        return json(
          {
            success:false,
            error:"Unauthorized"
          },
          401
        );

      }

      try{

        const body =
          await request.json();

        const id =
          body.id;

        const targetTier =
          body.tier;

        let targetPosition =
          Number(
            body.position
          );

        if(!id || !targetTier){

          return json(
            {
              success:false,
              error:
                "Missing id or tier"
            },
            400
          );

        }

        if(
          !Number.isFinite(
            targetPosition
          )
        ){

          targetPosition = 0;

        }

        const game =
          await env.DB
            .prepare(
              "SELECT * FROM games WHERE id = ?"
            )
            .bind(id)
            .first();

        if(!game){

          return json(
            {
              success:false,
              error:"Game not found"
            },
            404
          );

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
            .bind(
              targetTier,
              id
            )
            .all();

        const ids =
          (targetGames.results || [])
            .map(
              g => g.id
            );

        targetPosition =
          Math.max(
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

        const statements = [];

        for(
          let i = 0;
          i < ids.length;
          i++
        ){

          statements.push(
            env.DB
              .prepare(`
                UPDATE games
                SET tier = ?, position = ?
                WHERE id = ?
              `)
              .bind(
                targetTier,
                i,
                ids[i]
              )
          );

        }

        await env.DB.batch(
          statements
        );

        /*
          Re-number the old tier as well.
        */

        if(
          game.tier !== targetTier
        ){

          const oldGames =
            await env.DB
              .prepare(`
                SELECT id
                FROM games
                WHERE tier = ?
                ORDER BY position ASC
              `)
              .bind(
                game.tier
              )
              .all();

          const oldStatements =
            (oldGames.results || [])
              .map(
                (g,index) =>
                  env.DB
                    .prepare(`
                      UPDATE games
                      SET position = ?
                      WHERE id = ?
                    `)
                    .bind(
                      index,
                      g.id
                    )
              );

          if(oldStatements.length){

            await env.DB.batch(
              oldStatements
            );

          }

        }

        return json({
          success:true
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       REORDER TIER
    ======================================================= */

    if(
      url.pathname ===
      "/api/games/reorder" &&
      request.method ===
      "POST"
    ){

      if(!isAdmin(request)){

        return json(
          {
            success:false,
            error:"Unauthorized"
          },
          401
        );

      }

      try{

        const body =
          await request.json();

        const tier =
          body.tier;

        const positions =
          body.positions;

        if(
          !tier ||
          !positions
        ){

          return json(
            {
              success:false,
              error:
                "Missing tier or positions"
            },
            400
          );

        }

        const games =
          await env.DB
            .prepare(`
              SELECT id
              FROM games
              WHERE tier = ?
              ORDER BY position ASC
            `)
            .bind(tier)
            .all();

        const ordered =
          (games.results || [])
            .sort(
              (a,b) =>
                Number(
                  positions[a.id] ??
                  999999
                ) -
                Number(
                  positions[b.id] ??
                  999999
                )
            );

        const statements =
          ordered.map(
            (game,index) =>
              env.DB
                .prepare(`
                  UPDATE games
                  SET position = ?
                  WHERE id = ?
                `)
                .bind(
                  index,
                  game.id
                )
          );

        if(statements.length){

          await env.DB.batch(
            statements
          );

        }

        return json({
          success:true
        });

      }catch(error){

        return json(
          {
            success:false,
            error:error.message
          },
          500
        );

      }

    }

    /* =======================================================
       WEBSITE
    ======================================================= */

    return env.ASSETS.fetch(
      request
    );

  }

};
