# Sean Kane’s chess journal

The journal is the homepage of [seankane.xyz](https://seankane.xyz/). The original machine-learning blog is at [/blog/](https://seankane.xyz/blog/). GitHub Pages builds both from the Jekyll project under `docs/`.

## Write a review

1. Export one completed game as a PGN. With Node.js 20 or newer, import it into a draft JSON file. The last argument is your color, `w` for White or `b` for Black. It sets the starting board orientation.

   ```sh
   node tools/chess-review.mjs import ~/Downloads/game.pgn keeping-f7-safe.json b
   ```

   The importer reads the main line, player information, and any written main-line PGN comments. It ignores embedded PGN variations and clock annotations. Add the alternatives you want readers to explore in the draft.

2. Edit the title and summary. Give a key move a `judgment`, a `title`, and a `note` in your own words. Use `focusPly` to open at a specific position. Zero is the initial board, one is after the first half-move, and so on. Prefer a specific takeaway, such as what you missed and what you will look for next time.

   Each variation replaces the move it is attached to. The example below branches from the position *before* `3…Nf6`. Alternative moves use the same format, so notes and variations can be nested.

   ```json
   {
     "san": "Nf6",
     "judgment": "Blunder",
     "title": "Check the threat before developing",
     "note": "White can take on f7 with mate.",
     "arrows": ["h5f7"],
     "variations": [
       {
         "title": "Block the queen with 3…g6",
         "moves": [
           { "san": "g6", "note": "The pawn attacks the queen and cuts off f7." },
           { "san": "Qf3" },
           { "san": "Nf6", "note": "Now the knight blocks the queen’s line to f7." }
         ]
       }
     ]
   }
   ```

   Move notation is standard SAN. The board reconstructs pieces from the moves and uses the normal starting position unless the game supplies a `fen`. An arrow such as `"h5f7"` marks a route on the board after the annotated move.

3. Generate and save evaluations for the starting position, main game and every authored variation with Stockfish installed locally.

   ```sh
   node tools/chess-review.mjs evaluate keeping-f7-safe.json 16
   ```

   The default depth is 14. Set `STOCKFISH_BIN` if the binary is outside your PATH. The file stores the engine version, centipawn or mate score, search depth, and best move where available. Positive scores favor White. Run the command again after changing a line. Browsers read these saved scores.

4. Move the finished file into `docs/_data/chess/` and run `node tools/chess-review.mjs check`. Use the same filename as the review’s `id`. GitHub Pages publishes reviews in that directory when the changes reach `gh-pages`. Files with `"example": true` are labeled as demos and sort below personal reviews.

5. Update `current` in `docs/_data/chess_goal.yml` as your blitz rating changes.

Run `make serve` from the repository root to preview with the site's Jekyll toolchain. The Pages workflow validates the review data and builds the site.
