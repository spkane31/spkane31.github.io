# Chess Journal

[Journal](https://seankane.xyz/) · [Blog](https://seankane.xyz/blog/)

## Write a review

1. Export a PGN for one game and import it with Node.js 20 or newer. Use `w` or `b` for your side of the board.

   ```sh
   node tools/chess-review.mjs import ~/Downloads/game.pgn keeping-f7-safe.json b
   ```

   The import brings over player details, the moves played, and their comments. Add variations in the JSON file.

2. Edit the title and summary. Add notes and, if useful, a `judgment` like `"Blunder"`. Set `focusPly` to the position the board should open on. Start at `0` and count each White or Black move.

   Put each variation on the move it replaces. You can add notes and further variations to its moves.

   ```json
   {
     "san": "Nf6",
     "judgment": "Blunder",
     "title": "Mate on f7",
     "note": "White has 4. Qxf7#.",
     "arrows": ["h5f7"],
     "variations": [
       {
         "title": "3…g6",
         "moves": [
           { "san": "g6", "note": "The pawn attacks the queen and cuts off f7." },
           { "san": "Qf3" },
           { "san": "Nf6", "note": "Now the knight blocks the queen’s line to f7." }
         ]
       }
     ]
   }
   ```

   Use standard algebraic notation for moves. Set `fen` for a custom starting position. An arrow such as `"h5f7"` runs from h5 to f7 on the board after that move.

3. With Stockfish installed, score the game and its variations.

   ```sh
   node tools/chess-review.mjs evaluate keeping-f7-safe.json 16
   ```

   Default depth is 14. Set `STOCKFISH_BIN` if Stockfish is outside your PATH. Positive scores favor White. Run this again after changing the moves.

4. Save the finished file as `docs/_data/chess/<id>.json`, using the review’s `id` for the filename. Run `node tools/chess-review.mjs check`, then push to `gh-pages` to publish. Reviews with `"example": true` appear below your games.

5. To update your rating, edit `current` in `docs/_data/chess_goal.yml`.

Run `make serve` from the repo root to preview.
