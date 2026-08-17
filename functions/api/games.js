export async function onRequestGet(context) {
  try {
    const { results } = await context.env.DB
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
          position
        FROM games
        ORDER BY tier, position
      `)
      .all();

    return Response.json(results);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to load games" },
      { status: 500 }
    );
  }
}
