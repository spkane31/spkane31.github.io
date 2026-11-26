import { Chess } from "./lib/chess.mjs";

const square = "[a-h][1-8]";
const arrowPattern = new RegExp(`^${square}${square}$`);
const movePattern = new RegExp(`^${square}${square}[qrbn]?$`);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value) => typeof value === "string" && value.trim().length > 0;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function originalGameUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function validateEvaluation(evaluation, chess, label) {
  if (evaluation === undefined) return;
  requireValue(evaluation && typeof evaluation === "object", `${label}: invalid evaluation`);
  const { cp, mate, winner, depth, bestMove } = evaluation;
  requireValue((Number.isInteger(cp) && mate === undefined) ||
    (Number.isInteger(mate) && cp === undefined &&
      (mate !== 0 || winner === "w" || winner === "b")), `${label}: use a centipawn or mate score`);
  requireValue(depth === undefined || (Number.isInteger(depth) && depth > 0), `${label}: invalid depth`);
  if (bestMove !== undefined) {
    requireValue(movePattern.test(bestMove) &&
      chess.moves({ verbose: true }).some((move) => move.lan === bestMove), `${label}: illegal best move`);
  }
}

export function createReview(record) {
  requireValue(record && idPattern.test(record.id ?? ""), "Review IDs must use lowercase letters, numbers, and hyphens");
  for (const field of ["title", "summary", "white", "black"]) {
    requireValue(text(record[field]), `${record.id}: missing ${field}`);
  }
  requireValue(["w", "b"].includes(record.perspective), `${record.id}: perspective must be w or b`);
  requireValue(["1-0", "0-1", "1/2-1/2", "*"].includes(record.result), `${record.id}: invalid game result`);
  requireValue(record.source === undefined || originalGameUrl(record.source), `${record.id}: invalid game URL`);
  if (record.date !== undefined) {
    const day = new Date(record.date);
    requireValue(/^\d{4}-\d{2}-\d{2}$/.test(record.date) && !Number.isNaN(day.valueOf()) &&
      day.toISOString().startsWith(record.date), `${record.id}: date must be a real date in YYYY-MM-DD format`);
  }

  const chess = new Chess(record.fen);
  const root = { fen: chess.fen(), key: "", ply: 0, evaluation: record.evaluation, options: [] };
  const byKey = new Map([["", root]]);
  validateEvaluation(root.evaluation, chess, record.id);

  function addLine(entries, start, title, label) {
    requireValue(Array.isArray(entries) && entries.length > 0, `${label}: add at least one move`);
    const line = { title, start, positions: [] };
    let parent = start;
    for (const [index, entry] of entries.entries()) {
      const address = `${label} move ${index + 1}`;
      const board = new Chess(parent.fen);
      requireValue(text(entry?.san), `${address}: missing move notation`);
      let move;
      try {
        move = board.move(entry.san, { strict: true });
      } catch {
        throw new Error(`${address}: illegal move ${entry.san}`);
      }
      for (const field of ["title", "note", "judgment"]) {
        requireValue(entry[field] === undefined || text(entry[field]), `${address}: invalid ${field}`);
      }
      requireValue(entry.arrows === undefined || (Array.isArray(entry.arrows) &&
        entry.arrows.every((arrow) => typeof arrow === "string" && arrowPattern.test(arrow) &&
          arrow.slice(0, 2) !== arrow.slice(2))), `${address}: invalid board arrow`);
      requireValue(entry.variations === undefined || Array.isArray(entry.variations), `${address}: variations must be an array`);
      validateEvaluation(entry.evaluation, board, address);

      const key = parent.key ? `${parent.key}.${move.lan}` : move.lan;
      requireValue(!byKey.has(key), `${address}: ${move.san} is already a choice here`);
      const position = {
        ...entry,
        move,
        parent,
        line,
        key,
        ply: parent.ply + 1,
        number: Number(parent.fen.split(" ")[5]),
        fen: board.fen(),
        options: [],
      };
      line.positions.push(position);
      parent.options.push(position);
      byKey.set(key, position);
      for (const variation of entry.variations ?? []) {
        requireValue(text(variation?.title), `${address}: missing variation title`);
        addLine(variation.moves, parent, variation.title, `${address} (${variation.title})`);
      }
      parent = position;
    }
    return line;
  }

  const main = addLine(record.moves, root, "Main line", record.id);
  const focusPly = record.focusPly ?? 0;
  requireValue(Number.isInteger(focusPly) && focusPly >= 0 && focusPly <= main.positions.length,
    `${record.id}: focusPly is outside the game`);
  return { record, root, main, byKey, focus: main.positions[focusPly - 1] ?? root };
}

export function linePath(line) {
  const prefix = [];
  for (let node = line.start; node; node = node.parent) prefix.push(node);
  return prefix.reverse().concat(line.positions);
}

export function moveLabel(position) {
  if (!position.move) return "Starting position";
  const dots = position.move.color === "w" ? "." : "…";
  return `${position.number}${dots} ${position.move.san}`;
}

export function evaluationDisplay(evaluation) {
  if (!evaluation) return { label: "—", description: "No evaluation", whiteShare: null };
  const { cp, mate, winner } = evaluation;
  if (mate !== undefined) {
    const whiteWins = mate === 0 ? winner === "w" : mate > 0;
    const side = whiteWins ? "White" : "Black";
    const label = mate === 0 ? "#" : `${whiteWins ? "+" : "−"}M${Math.abs(mate)}`;
    const description = mate === 0 ? `Checkmate · ${side} wins` : `${side} has mate in ${Math.abs(mate)}`;
    return { label, description, whiteShare: whiteWins ? 100 : 0 };
  }
  const sign = cp > 0 ? "+" : cp < 0 ? "−" : "";
  return {
    label: `${sign}${(Math.abs(cp) / 100).toFixed(2)}`,
    description: "White’s perspective",
    whiteShare: 50 + 49 * Math.tanh(cp / 375),
  };
}
