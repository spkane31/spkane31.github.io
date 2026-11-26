import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { basename } from "node:path";
import { Chess, DEFAULT_POSITION } from "../docs/assets/chess/lib/chess.mjs";
import { createReview, originalGameUrl } from "../docs/assets/chess/review-model.mjs";

const catalog = new URL("../docs/_data/chess/", import.meta.url);

async function readReview(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function pgnNotes(move, comments) {
  const note = comments.get(move.after)?.replace(/\[%[^\]]+\]/g, "").trim();
  return { san: move.san, ...(note && { note }) };
}

function dateFromPgn(header) {
  for (const field of ["UTCDate", "Date"]) {
    const value = header[field];
    if (value && /^\d{4}\.\d{2}\.\d{2}$/.test(value)) return value.replaceAll(".", "-");
  }
}

function ratingFromPgn(value) {
  if (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
}

function timeControlFromPgn(value) {
  if (!value || value === "-" || value === "?") return undefined;
  const match = value.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return value;
  const seconds = Number(match[1]);
  const base = seconds % 60 === 0 ? String(seconds / 60) : `${seconds}s`;
  return `${base}+${match[2] ?? 0}`;
}

function serialize(record) {
  return JSON.stringify(record, null, 2) + "\n";
}

async function importPgn(pgnPath, outputFile, perspective) {
  const chess = new Chess();
  const pgn = await readFile(pgnPath, "utf8");
  if ((pgn.match(/^\s*\[Event\s+"/gm) ?? []).length > 1) {
    throw new Error("Export one game at a time.");
  }
  chess.loadPgn(pgn, { strict: true });
  const header = chess.getHeaders();
  const history = chess.history({ verbose: true });
  const comments = new Map(chess.getComments().map(({ fen, comment }) => [fen, comment]));
  const source = originalGameUrl(header.Link) ?? originalGameUrl(header.Site) ?? undefined;
  const players = [header.White, header.Black].map((name, index) => !name || name === "?" ? ["White", "Black"][index] : name);
  const [white, black] = players;
  const id = basename(outputFile, ".json");
  const record = {
    id,
    title: `${white} vs. ${black}`,
    summary: "Add a game summary.",
    date: dateFromPgn(header),
    perspective,
    white,
    black,
    whiteRating: ratingFromPgn(header.WhiteElo),
    blackRating: ratingFromPgn(header.BlackElo),
    result: header.Result ?? "*",
    timeControl: timeControlFromPgn(header.TimeControl),
    source,
    fen: history[0]?.before === DEFAULT_POSITION ? undefined : history[0]?.before,
    focusPly: 0,
    moves: history.map((move) => pgnNotes(move, comments)),
  };
  createReview(record);
  await writeFile(outputFile, serialize(record), { flag: "wx" });
  console.log(`Imported ${history.length} half-moves into ${outputFile}`);
}

function stockfish(binary) {
  const child = spawn(binary, [], { stdio: ["pipe", "pipe", "inherit"] });
  const lines = createInterface({ input: child.stdout });
  let failure;
  child.on("error", (error) => { failure = error; });
  child.stdin.on("error", (error) => { failure = error; });

  function ask(command, completion, readLine) {
    return new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        lines.off("line", read);
        child.off("error", finish);
        child.stdin.off("error", finish);
        child.off("close", closed);
        if (error) reject(error);
        else resolve();
      };
      const closed = () => finish(failure ?? new Error("Stockfish closed before replying."));
      const read = (line) => {
        readLine?.(line);
        if (completion.test(line)) finish();
      };
      const timer = setTimeout(() => finish(new Error(`Stockfish timed out on ${command.at(-1)}.`)), 120_000);

      lines.on("line", read);
      child.once("error", finish);
      child.stdin.once("error", finish);
      child.once("close", closed);
      child.stdin.write(command.join("\n") + "\n");
    });
  }

  return { child, ask };
}

async function scorePosition(ask, chess, rootFen, key, depth) {
  if (chess.isCheckmate()) return { mate: 0, winner: chess.turn() === "w" ? "b" : "w" };
  if (chess.isDraw()) return { cp: 0 };

  const sign = chess.turn() === "w" ? 1 : -1;
  let score;
  let bestMove;
  const position = `position fen ${rootFen}${key ? ` moves ${key.replaceAll(".", " ")}` : ""}`;
  await ask([position, `go depth ${depth}`], /^bestmove /, (line) => {
    const match = line.match(/^info depth (\d+).*\bscore (cp|mate) (-?\d+)(?!\d)(?! (?:upperbound|lowerbound))/);
    if (match) score = { [match[2]]: Number(match[3]) * sign, depth: Number(match[1]) };
    if (line.startsWith("bestmove ")) bestMove = line.split(" ")[1];
  });
  if (!score || !bestMove) throw new Error(`Stockfish returned no score after ${key || "the starting position"}.`);
  return { ...score, bestMove };
}

async function evaluate(file, depth) {
  const record = await readReview(file);
  const { root } = createReview(record);
  const { child, ask } = stockfish(process.env.STOCKFISH_BIN || "stockfish");
  const closed = once(child, "close").catch(() => {});
  const temporary = `${file}.${process.pid}.tmp`;

  async function scoreTree(entries, start, prefix) {
    const board = new Chess(root.fen);
    for (const move of prefix) board.move(move);
    let key = start;
    for (const entry of entries) {
      for (const variation of entry.variations ?? []) await scoreTree(variation.moves, key, board.history());
      const move = board.move(entry.san);
      key = key ? `${key}.${move.lan}` : move.lan;
      entry.evaluation = await scorePosition(ask, board, root.fen, key, depth);
    }
  }

  try {
    await ask(["uci"], /^uciok$/, (line) => {
      if (line.startsWith("id name ")) record.engine = line.slice(8);
    });
    await ask(["isready"], /^readyok$/);
    record.evaluation = await scorePosition(ask, new Chess(root.fen), root.fen, "", depth);
    await scoreTree(record.moves, "", []);
    createReview(record);
    await writeFile(temporary, serialize(record), { flag: "wx" });
    await rename(temporary, file);
    console.log(`Saved ${record.engine} evaluations to ${file}`);
  } finally {
    child.kill();
    await closed;
    await rm(temporary, { force: true });
  }
}

async function check() {
  const files = (await readdir(catalog)).filter((name) => name.endsWith(".json"));
  for (const file of files) {
    const record = await readReview(new URL(file, catalog));
    if (record.id + ".json" !== file) throw new Error(`${file}: the filename must match the review ID.`);
    createReview(record);
  }
  console.log(`Validated ${files.length} chess review${files.length === 1 ? "" : "s"}`);
}

async function main() {
  const [action, first, second, color] = process.argv.slice(2);
  if (action === "import" && first && second?.endsWith(".json") && ["w", "b"].includes(color)) {
    await importPgn(first, second, color);
  } else if (action === "evaluate" && first && !color) {
    const depth = second === undefined ? 14 : Number(second);
    if (!Number.isInteger(depth) || depth < 1 || depth > 24) throw new Error("Depth must be between 1 and 24.");
    await evaluate(first, depth);
  } else if (action === "check" && !first) {
    await check();
  } else {
    throw new Error([
      "Usage",
      "  node tools/chess-review.mjs import GAME.pgn REVIEW.json w|b",
      "  node tools/chess-review.mjs evaluate REVIEW.json [DEPTH]",
      "  node tools/chess-review.mjs check",
    ].join("\n"));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
