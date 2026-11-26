import { Chess } from "./lib/chess.mjs";
import {
  createReview, evaluationDisplay, linePath, moveLabel, originalGameUrl,
} from "./review-model.mjs";

const byId = (id) => document.getElementById(id);
const grid = byId("review-grid");
const board = byId("board");
const items = byId("move-list");
const variations = byId("variation-list");
const backToGame = byId("return-main");
const controls = Object.fromEntries(
  [...document.querySelectorAll("[data-action]")].map((button) => [button.dataset.action, button]),
);
const pieceNames = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const sideNames = { w: "White", b: "Black" };
const otherColor = (color) => color === "w" ? "b" : "w";
const pieceImage = (piece) => new URL(`./pieces/${piece.color}${piece.type.toUpperCase()}.svg`, import.meta.url).href;

let review;
let position;
let activeLine;
let flipped;
let path;

function element(tag, className, content) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (content) item.textContent = content;
  return item;
}

function gameMeta(record) {
  const date = record.date && new Intl.DateTimeFormat("en", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(record.date));
  return [record.timeControl === "5+0" ? "5+0 blitz" : record.timeControl, date].filter(Boolean).join(" · ");
}

function renderPlayer(container, color, turn, gameOver) {
  const record = review.record;
  const player = color === "w" ? record.white : record.black;
  const rating = color === "w" ? record.whiteRating : record.blackRating;
  const side = element("span", color === "w" ? "side-white" : "side-black");
  side.setAttribute("aria-label", sideNames[color]);
  const parts = [side, element("strong", "", player)];
  if (rating) parts.push(element("span", "player-rating", String(rating)));
  if (!gameOver && turn === color) parts.push(element("span", "to-move", "To move"));
  container.replaceChildren(...parts);
}

function renderBoard() {
  const game = new Chess(position.fen);
  const files = flipped ? "hgfedcba" : "abcdefgh";
  const ranks = flipped ? "12345678" : "87654321";
  const gridSquares = document.createDocumentFragment();
  const pieces = { w: [], b: [] };
  const turn = game.turn();
  const finished = position === review.main.positions.at(-1) && review.record.result !== "*";
  const over = game.isGameOver() || finished;

  [...ranks].forEach((rank, row) => {
    [...files].forEach((file, column) => {
      const square = file + rank;
      const piece = game.get(square);
      const tile = element("div", `square ${(row + column) % 2 === 0 ? "light" : "dark"}`);
      if (position.move?.from === square) tile.classList.add("from");
      if (position.move?.to === square) tile.classList.add("to");
      if (column === 0) tile.append(element("span", "coordinate rank", rank));
      if (row === 7) tile.append(element("span", "coordinate file", file));
      if (piece) {
        const image = element("img");
        image.alt = "";
        image.src = pieceImage(piece);
        tile.append(image);
        pieces[piece.color].push(`${pieceNames[piece.type]} ${square}`);
      }
      gridSquares.append(tile);
    });
  });

  for (const arrow of position.arrows ?? []) {
    const x1 = files.indexOf(arrow[0]) + 0.5;
    const y1 = ranks.indexOf(arrow[1]) + 0.5;
    const dx = files.indexOf(arrow[2]) + 0.5 - x1;
    const dy = ranks.indexOf(arrow[3]) + 0.5 - y1;
    const mark = element("span", "board-arrow");
    mark.style.left = `${x1 * 12.5}%`;
    mark.style.top = `${y1 * 12.5}%`;
    mark.style.width = `${Math.hypot(dx, dy) * 12.5}%`;
    mark.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;
    gridSquares.append(mark);
  }

  board.replaceChildren(gridSquares);
  const detail = game.isCheckmate()
    ? `Checkmate. ${sideNames[otherColor(turn)]} wins.`
    : game.isDraw() ? "Draw."
      : finished ? `Game result ${review.record.result}.` : `${sideNames[turn]} to move.`;
  const arrows = (position.arrows ?? []).map((arrow) => `Arrow from ${arrow.slice(0, 2)} to ${arrow.slice(2)}.`);
  board.setAttribute("aria-label", [
    position.move ? `Board after ${moveLabel(position)}. ${detail}` : `Starting board. ${detail}`,
    `White: ${pieces.w.join(", ")}.`,
    `Black: ${pieces.b.join(", ")}.`,
    ...arrows,
  ].join(" "));
  byId("board-caption").textContent = `${moveLabel(position)}. ${detail}`;
  const bottom = flipped ? "b" : "w";
  renderPlayer(byId("top-player"), otherColor(bottom), turn, over);
  renderPlayer(byId("bottom-player"), bottom, turn, over);
}

function renderEvaluation() {
  const { label, description, whiteShare } = evaluationDisplay(position.evaluation);
  const depth = position.evaluation?.depth;
  const engine = review.record.engine;
  const details = [description, engine && position.evaluation ? engine : null, depth ? `depth ${depth}` : null].filter(Boolean);
  byId("evaluation-value").textContent = label;
  byId("evaluation-detail").textContent = details.join(" · ");
  const meter = byId("eval-meter");
  meter.toggleAttribute("data-flipped", flipped);
  meter.toggleAttribute("data-unknown", whiteShare === null);
  meter.setAttribute("aria-label", whiteShare === null ? description : `Stockfish ${label}. ${description}`);
  byId("eval-fill").style.height = `${whiteShare ?? 0}%`;
}

function renderMoves(restoreFocus) {
  const oldScroll = items.scrollTop;
  const rows = document.createDocumentFragment();
  let row;
  let current;
  let number;

  for (const node of path.slice(1)) {
    if (!row || node.number !== number) {
      number = node.number;
      row = element("div", "move-row");
      row.append(element("span", "move-no", `${number}.`));
      rows.append(row);
    }
    const button = element("button", "move-button", node.move.san);
    button.classList.toggle("black-move", node.move.color === "b");
    button.type = "button";
    button.setAttribute("aria-label", [moveLabel(node), node.judgment, node.variations?.length ? "has variations" : null].filter(Boolean).join(", "));
    const mark = node.judgment ? "!" : node.variations?.length ? "+" : "";
    if (mark) {
      const indicator = element("span", "move-mark", mark);
      indicator.setAttribute("aria-hidden", "true");
      button.append(indicator);
    }
    button.addEventListener("click", () => show(node, activeLine, true));
    if (node === position) {
      button.setAttribute("aria-current", "step");
      current = button;
    }
    row.append(button);
  }

  items.replaceChildren(rows);
  items.scrollTop = oldScroll;
  if (current) {
    const area = items.getBoundingClientRect();
    const active = current.getBoundingClientRect();
    if (active.top < area.top) items.scrollTop -= area.top - active.top;
    if (active.bottom > area.bottom) items.scrollTop += active.bottom - area.bottom;
    if (restoreFocus) current.focus({ preventScroll: true });
  }
  backToGame.hidden = activeLine === review.main;
  const lineLabel = byId("line-label");
  lineLabel.hidden = activeLine !== review.main;
}

function renderVariations() {
  const options = new Set();
  for (const point of [position, position.parent].filter(Boolean)) {
    for (const option of point.options) {
      if (option === option.line.positions[0] && option.line !== review.main && option.line !== activeLine) {
        options.add(option);
      }
    }
  }
  variations.hidden = options.size === 0;
  const children = [];
  if (options.size) children.push(element("h4", "", "Alternatives"));
  for (const option of options) {
    const button = element("button", "variation-button", option.line.title);
    button.type = "button";
    button.addEventListener("click", () => show(option, option.line, true));
    children.push(button);
  }
  variations.replaceChildren(...children);
}

function renderNote() {
  const judgment = byId("note-class");
  judgment.textContent = position.judgment || "";
  judgment.hidden = !position.judgment;
  byId("note-move").textContent = moveLabel(position);
  byId("note-heading").textContent = position.title || "Notes";
  byId("note-text").textContent = position.note || "No notes.";
}

function show(node, line = node.line ?? review.main, restoreFocus = false) {
  position = node;
  activeLine = line;
  path = linePath(line);
  const index = path.indexOf(node);
  controls.first.disabled = controls.back.disabled = index === 0;
  controls.next.disabled = controls.last.disabled = index === path.length - 1;
  renderBoard();
  renderEvaluation();
  renderMoves(restoreFocus);
  renderVariations();
  renderNote();
}

function go(node, line = activeLine) {
  if (node === position) return;
  show(node, line);
}

controls.first.addEventListener("click", () => go(path[0]));
controls.back.addEventListener("click", () => go(path[path.indexOf(position) - 1]));
controls.next.addEventListener("click", () => go(path[path.indexOf(position) + 1]));
controls.last.addEventListener("click", () => go(path.at(-1)));
controls.flip.addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
  renderEvaluation();
});
backToGame.addEventListener("click", () => {
  let fork = activeLine.start;
  while (fork.line && fork.line !== review.main) fork = fork.line.start;
  show(review.main.positions[fork.ply] ?? fork, review.main, true);
});
grid.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const action = {
    ArrowLeft: "back", ArrowRight: "next", Home: "first", End: "last",
  }[event.key];
  if (action && !controls[action].disabled) {
    event.preventDefault();
    controls[action].click();
  }
});

function renderArchive(records) {
  for (const record of records) {
    const link = element("a", "archive-entry");
    link.href = `?game=${encodeURIComponent(record.id)}#review`;
    link.append(
      element("small", "", [record.example ? "Example game" : null, gameMeta(record)].filter(Boolean).join(" · ")),
      element("strong", "", record.title),
      element("span", "", record.summary),
    );
    const entry = document.createElement("li");
    entry.append(link);
    byId("archive-list").append(entry);
  }
}

async function openJournal() {
  const status = byId("catalog-status");
  try {
    const response = await fetch(document.body.dataset.catalog);
    if (!response.ok) throw new Error(`Game catalog returned ${response.status}`);
    const records = await response.json();
    records.sort((a, b) => Number(Boolean(a.example)) - Number(Boolean(b.example)) ||
      (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id));
    renderArchive(records);
    if (!records.length) {
      status.textContent = "No games yet.";
      return;
    }

    const game = new URLSearchParams(location.search).get("game");
    review = createReview(records.find(({ id }) => id === game) ?? records[0]);
    const { record } = review;
    byId("review-title").textContent = record.title;
    byId("review-kind").textContent = record.example ? "Example game" : "";
    byId("game-meta").textContent = [gameMeta(record), record.example ? null : record.result].filter(Boolean).join(" · ");
    byId("game-summary").textContent = record.summary;
    if (record.source) {
      const source = byId("source-game");
      source.href = originalGameUrl(record.source);
      source.hidden = false;
    }
    flipped = record.perspective === "b";
    status.hidden = true;
    grid.hidden = false;
    show(review.focus);
  } catch (error) {
    console.error(error);
    grid.hidden = true;
    status.hidden = false;
    status.textContent = "Couldn’t load the game.";
  }
}

openJournal();
