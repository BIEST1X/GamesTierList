export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================================================
    // ADMIN LOGIN
    // =========================================================

    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const body = await request.json();

        if (!body.password || body.password !== env.ADMIN_PASSWORD) {
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
    // ADMIN AUTH CHECK
    // =========================================================

    function isAdmin(request) {
      const auth = request.headers.get("Authorization");

      if (!auth) return false;

      const token = auth.replace("Bearer ", "");

      return token === env.ADMIN_PASSWORD;
    }

    // =========================================================
    // TEST D1
    // =========================================================

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

    // =========================================================
    // ONE-TIME MIGRATION
    // =========================================================

    if (url.pathname === "/api/migrate" && request.method === "POST") {
      try {
        const games = [
          // S TIER
          {
            id: "g_mswe0tllezoio",
            name: "The Last of Us Part 1 & Part 2",
            tier: "S",
            gameplay: 10, visuals: 10, story: 10, music: 10,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tllwo5ff",
            name: "Clair Obscur: Expedition 33",
            tier: "S",
            gameplay: 9, visuals: 10, story: 10, music: 10,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tlliumlp",
            name: "Cyberpunk 2077 & DLC",
            tier: "S",
            gameplay: 9, visuals: 10, story: 9, music: 10,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tllxtpah",
            name: "Alan Wake 2",
            tier: "S",
            gameplay: 7, visuals: 10, story: 10, music: 10,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tllpx2kv",
            name: "Red Dead Redemption 2",
            tier: "S",
            gameplay: 10, visuals: 10, story: 9, music: 8,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tll2lds4",
            name: "007 First Light",
            tier: "S",
            gameplay: 9, visuals: 9, story: 9, music: 9,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tllu73ky",
            name: "God of War 2018 & Ragnarok",
            tier: "S",
            gameplay: 9, visuals: 9, story: 9, music: 10,
            voice: 10, sound: 10, writing: 9
          },
          {
            id: "g_mswe0tllxkp1c",
            name: "Uncharted 4",
            tier: "S",
            gameplay: 8, visuals: 10, story: 10, music: 10,
            voice: 10, sound: 8, writing: 10
          },
          {
            id: "g_mswe0tllvrwhd",
            name: "Resident Evil Requiem",
            tier: "S",
            gameplay: 9, visuals: 10, story: 8, music: 9,
            voice: 9, sound: 9, writing: 10
          },
          {
            id: "g_mswe0tllfd1ld",
            name: "Quantum Break",
            tier: "S",
            gameplay: 7, visuals: 8, story: 10, music: 8,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tllc0gss",
            name: "SOMA",
            tier: "S",
            gameplay: 6, visuals: 8, story: 10, music: 9,
            voice: 10, sound: 10, writing: 10
          },
          {
            id: "g_mswe0tllq27ty",
            name: "Detroit: Become Human",
            tier: "S",
            gameplay: 6, visuals: 10, story: 9, music: 9,
            voice: 10, sound: 9, writing: 9
          },
          {
            id: "g_mswe0tllrxy7g",
            name: "Max Payne 3",
            tier: "S",
            gameplay: 10, visuals: 8, story: 8, music: 9,
            voice: 10, sound: 9, writing: 8
          },
          {
            id: "g_mswe0tllrg3mq",
            name: "Dispatch",
            tier: "S",
            gameplay: 6, visuals: 10, story: 10, music: 8,
            voice: 10, sound: 7, writing: 9
          },
          {
            id: "g_mswe0tll6xd87",
            name: "Resident Evil 4 Remake",
            tier: "S",
            gameplay: 9, visuals: 9, story: 7, music: 7,
            voice: 10, sound: 9, writing: 8
          },
          {
            id: "g_mswe0tlllp2n8",
            name: "Metal Gear Solid",
            tier: "S",
            gameplay: 8, visuals: 8, story: 8, music: 8,
            voice: 8, sound: 8, writing: 10
          },
          {
            id: "g_mswe0tllz52i4",
            name: "The Witcher 3: Wild Hunt",
            tier: "S",
            gameplay: 5, visuals: 7, story: 9, music: 9,
            voice: 8, sound: 8, writing: 10
          },
          {
            id: "g_mswe0tllym47t",
            name: "Grand Theft Auto: San Andreas",
            tier: "S",
            gameplay: 0, visuals: 0, story: 0, music: 0,
            voice: 0, sound: 0, writing: 0
          },

          // A TIER
          {
            id: "g_mswe0tllqm942",
            name: "Alan Wake",
            tier: "A"
          },
          {
            id: "g_mswe0tll13lxm",
            name: "Red Dead Redemption + DLC",
            tier: "A"
          },
          {
            id: "g_mswe0tllgyp8f",
            name: "Grand Theft Auto V",
            tier: "A"
          },
          {
            id: "g_mswe0tllsdmra",
            name: "Call of Duty: Modern Warfare 2019",
            tier: "A"
          },
          {
            id: "g_mswe0tlllwraz",
            name: "Call of Duty: Black Ops",
            tier: "A"
          },
          {
            id: "g_mswe0tllbi914",
            name: "Control",
            tier: "A"
          },
          {
            id: "g_mswe0tlljlfe7",
            name: "Grand Theft Auto IV",
            tier: "A"
          },
          {
            id: "g_mswe0tllkcjvn",
            name: "Far Cry 3",
            tier: "A"
          },
          {
            id: "g_mswe0tlloufyy",
            name: "Fallout 4",
            tier: "A"
          },
          {
            id: "g_mswe0tll31uf0",
            name: "Portal 1 & 2",
            tier: "A"
          },
          {
            id: "g_mswe0tll6ol36",
            name: "Little Nightmares 1 & 2",
            tier: "A"
          },
          {
            id: "g_mswe0tllxb7io",
            name: "Wolfenstein II",
            tier: "A"
          },
          {
            id: "g_mswe0tllahm0h",
            name: "Wolfenstein: New Order",
            tier: "A"
          },
          {
            id: "g_mswe0tll77zbj",
            name: "Metro 2033 / Last Light / Exodus",
            tier: "A"
          },
          {
            id: "g_mswe0tll5q03q",
            name: "It Takes Two",
            tier: "A"
          },
          {
            id: "g_mswe0tllmuys9",
            name: "God of War 3",
            tier: "A"
          },
          {
            id: "g_mswe0tll56rlx",
            name: "Mafia: Definitive Edition",
            tier: "A"
          },
          {
            id: "g_mswe0tllf11k8",
            name: "Mafia II",
            tier: "A"
          },
          {
            id: "g_mswe0tllrzrfd",
            name: "Sleeping Dogs",
            tier: "A"
          },
          {
            id: "g_mswe0tllhtq4l",
            name: "South Park 1 / 2",
            tier: "A"
          },
          {
            id: "g_mswe0tllr040n",
            name: "Ratchet & Clank: Rift Apart",
            tier: "A"
          },
          {
            id: "g_mswe0tllpib4b",
            name: "Horizon: Zero Dawn",
            tier: "A"
          },
          {
            id: "g_mswe0tllgvw1k",
            name: "Marvel's Spider-Man 1 / 2",
            tier: "A"
          },
          {
            id: "g_mswe0tll13p7z",
            name: "Devil May Cry 1-5",
            tier: "A"
          },
          {
            id: "g_mswe0tllbwtdn",
            name: "Mafia: The Old Country",
            tier: "A"
          },
          {
            id: "g_mswe0tllaah6r",
            name: "Silent Hill f",
            tier: "A"
          },
          {
            id: "g_mswe0tllko8r6",
            name: "Silent Hill 2 Remake",
            tier: "A"
          },
          {
            id: "g_mswe0tlld4cfc",
            name: "Grand Theft Auto IV: TBOGT DLC",
            tier: "A"
          },
          {
            id: "g_mswe0tllg4aqs",
            name: "Hades 2",
            tier: "A"
          },
          {
            id: "g_mswe0tllh1t23",
            name: "RE2 & RE3 Remakes",
            tier: "A"
          },
          {
            id: "g_mswe0tll3hx49",
            name: "PRAGMATA",
            tier: "A"
          },
          {
            id: "g_mswe0tll9cr69",
            name: "Hollow Knight",
            tier: "A"
          },
          {
            id: "g_mswe0tllkxxb7",
            name: "Hollow Knight: Silksong",
            tier: "A"
          },
          {
            id: "g_mswe0tll63t4a",
            name: "FINAL FANTASY 7 Remake & Rebirth",
            tier: "A"
          },
          {
            id: "g_mswe0tll1zmvg",
            name: "Astro Bot",
            tier: "A"
          },
          {
            id: "g_mswe0tllgxe91",
            name: "FINAL FANTASY XVI",
            tier: "A"
          },
          {
            id: "g_mswe0tllp5vha",
            name: "Horizon: Forbidden West",
            tier: "A"
          },

          // B TIER
          {
            id: "g_mswe0tlln2xdv",
            name: "Resident Evil 7",
            tier: "B"
          },
          {
            id: "g_mswe0tlle6wha",
            name: "Resident Evil Village",
            tier: "B"
          },
          {
            id: "g_mswe0tll9ag06",
            name: "Dying Light 1 & 2",
            tier: "B"
          },
          {
            id: "g_mswe0tllpsgva",
            name: "Mirror's Edge",
            tier: "B"
          },
          {
            id: "g_mswe0tlljqp0q",
            name: "Outlast",
            tier: "B"
          },
          {
            id: "g_mswe0tllbw5cx",
            name: "Dead Island 1 & 2",
            tier: "B"
          },
          {
            id: "g_mswe0tllxffij",
            name: "Deathloop",
            tier: "B"
          },
          {
            id: "g_mswe0tllscdre",
            name: "Outlast 2",
            tier: "B"
          },
          {
            id: "g_mswe0tlljezn0",
            name: "Dishonored 1 & 2",
            tier: "B"
          },
          {
            id: "g_mswe0tllfrvdk",
            name: "Until Dawn",
            tier: "B"
          },
          {
            id: "g_mswe0tllx722v",
            name: "Marvel's Guardians of the Galaxy",
            tier: "B"
          },
          {
            id: "g_mswe0tllovsmn",
            name: "Darksiders 3",
            tier: "B"
          },
          {
            id: "g_mswe0tllk5wxu",
            name: "Far Cry 4",
            tier: "B"
          },
          {
            id: "g_mswe0tllzin8l",
            name: "Far Cry 5",
            tier: "B"
          },
          {
            id: "g_mswe0tllwn2vk",
            name: "Far Cry 6",
            tier: "B"
          },
          {
            id: "g_mswe0tllepjdj",
            name: "Call of Duty: Black Ops Cold War",
            tier: "B"
          },
          {
            id: "g_mswe0tllwifdx",
            name: "RAGE 2",
            tier: "B"
          },
          {
            id: "g_mswe0tllcb0sq",
            name: "Doom 2016",
            tier: "B"
          },
          {
            id: "g_mswe0tlmvbjzg",
            name: "Prototype 1 / 2",
            tier: "B"
          },
          {
            id: "g_mswe0tlmu4jay",
            name: "Mad Max",
            tier: "B"
          },
          {
            id: "g_mswe0tlm88z2j",
            name: "Trepang2",
            tier: "B"
          },
          {
            id: "g_mswe0tlma3cug",
            name: "Dead Space Remake",
            tier: "B"
          },
          {
            id: "g_mswe0tlmwy40h",
            name: "Superliminal",
            tier: "B"
          },
          {
            id: "g_mswe0tlmhwsq3",
            name: "Tomb Raider Trilogy",
            tier: "B"
          },
          {
            id: "g_mswe0tllmqp57d",
            name: "Resident Evil 5",
            tier: "B"
          },
          {
            id: "g_mswe0tlm0jty5",
            name: "Stanley Parable",
            tier: "B"
          },
          {
            id: "g_mswe0tlmnlo7e",
            name: "REANIMAL",
            tier: "B"
          },
          {
            id: "g_mswe0tlm51kfw",
            name: "Batman Arkham Games",
            tier: "B"
          },
          {
            id: "g_mswe0tlm31400",
            name: "Cronos: The New Dawn",
            tier: "B"
          },
          {
            id: "g_mswe0tlmm45xi",
            name: "Prince of Persia: The Lost Crown",
            tier: "B"
          },
          {
            id: "g_mswe0tlmfu13m",
            name: "Mouse: P.I. for Hire",
            tier: "B"
          },

          // F TIER
          {
            id: "g_mswe0tlmgsu8f",
            name: "Still Wakes The Deep",
            tier: "F"
          },
          {
            id: "g_mswe0tlmfyw6m",
            name: "Scorn",
            tier: "F"
          },

          // X TIER
          {
            id: "g_mswe0tlm8rjeo",
            name: "Elden Ring",
            tier: "X"
          },
          {
            id: "g_mswe0tlmvqs1d",
            name: "Lies of P",
            tier: "X"
          }
        ];

        const existing = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM games")
          .first();

        if (existing.count > 0) {
          return Response.json({
            success: false,
            error: "Database already contains games",
            games: existing.count
          }, { status: 409 });
        }

        for (let i = 0; i < games.length; i++) {
          const game = games[i];

          await env.DB.prepare(`
            INSERT INTO games (
              id, name, tier,
              gameplay, visuals, story, music,
              voice, sound, writing,
              commentary, position
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            game.id,
            game.name,
            game.tier,
            game.gameplay ?? 0,
            game.visuals ?? 0,
            game.story ?? 0,
            game.music ?? 0,
            game.voice ?? 0,
            game.sound ?? 0,
            game.writing ?? 0,
            game.commentary ?? "",
            i
          ).run();
        }

        return Response.json({
          success: true,
          message: "Migration completed",
          games: games.length
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
    // GET ALL GAMES
    // =========================================================

    if (url.pathname === "/api/games" && request.method === "GET") {
      try {
        const result = await env.DB
          .prepare("SELECT * FROM games ORDER BY position ASC")
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
    // =========================================================

    if (
      url.pathname.startsWith("/api/games/") &&
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
        const id = url.pathname.split("/").pop();
        const body = await request.json();

        await env.DB.prepare(`
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
        `).bind(
          body.name,
          body.tier,
          Number(body.gameplay) || 0,
          Number(body.visuals) || 0,
          Number(body.story) || 0,
          Number(body.music) || 0,
          Number(body.voice) || 0,
          Number(body.sound) || 0,
          Number(body.writing) || 0,
          body.commentary ?? "",
          Number(body.position) || 0,
          id
        ).run();

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

    if (url.pathname === "/api/games" && request.method === "POST") {
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
          Math.random().toString(36).substring(2, 7);

        const maxPosition = await env.DB
          .prepare("SELECT MAX(position) AS maxPosition FROM games")
          .first();

        const position =
          maxPosition?.maxPosition != null
            ? Number(maxPosition.maxPosition) + 1
            : 0;

        await env.DB.prepare(`
          INSERT INTO games (
            id, name, tier,
            gameplay, visuals, story, music,
            voice, sound, writing,
            commentary, position
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
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
        ).run();

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
        const id = url.pathname.split("/").pop();

        await env.DB
          .prepare("DELETE FROM games WHERE id = ?")
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
    // WEBSITE
    // =========================================================

    return env.ASSETS.fetch(request);
  }
};
