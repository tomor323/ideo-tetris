import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import bgmUrl from "./assets/Block_Party_Blitz.mp3";

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const INITIAL_CHAOS = 1;
/** Total lines cleared; every N lines raises chaos by one until MAX_CHAOS. */
const LINES_PER_CHAOS_LEVEL = 3;
const MIN_CHAOS = 1;
const MAX_CHAOS = 5;
const PLAYER_NAME_KEY = "ideo-block-party-player-name";
const PLAYER_NAME_LEGACY_KEY = "ideo-chaos-tetris-player-name";
const MUSIC_ENABLED_KEY = "ideo-block-party-music-enabled";

function readStoredPlayerName() {
  try {
    return window.localStorage.getItem(PLAYER_NAME_KEY) || window.localStorage.getItem(PLAYER_NAME_LEGACY_KEY) || "";
  } catch {
    return "";
  }
}

function readMusicEnabled() {
  try {
    const v = window.localStorage.getItem(MUSIC_ENABLED_KEY);
    if (v === null) return false;
    return v !== "0";
  } catch {
    return false;
  }
}
const SUPABASE_URL = "https://xxlzekgookhwnwuwjtzb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bHpla2dvb2tod253dXdqdHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjA1NjQsImV4cCI6MjA5MzU5NjU2NH0.MgpItekpqVYWeuaSSFcZ0v06IJ07GISTkfG0W-LcCf8";
const MAX_LEADERBOARD_ENTRIES = 10;
const LETTERS = ["I", "D", "E", "O"];
const LINE_CLEAR_TOAST_MS = 700;
const CHAOS_LEVEL_TOAST_MS = 2600;
const IDEO_WORD = "IDEO";
const IDEO_LINE_MULTIPLIER = 2;
const IDEO_BONUS_TOAST_MS = 1100;
const IDEO_HINT_TOAST_MS = 2000;

const PALETTE = {
  bg: "#fbfaf7",
  ink: "#111111",
  paper: "#ffffff",
  soft: "#ece7dd",
};

/** Playfield frame gets slightly cooler/darker as chaos rises. */
function playfieldShellColor(chaosLevel) {
  const t = (Math.min(MAX_CHAOS, Math.max(MIN_CHAOS, chaosLevel)) - MIN_CHAOS) / (MAX_CHAOS - MIN_CHAOS);
  const r = Math.round(255 - 42 * t);
  const g = Math.round(253 - 38 * t);
  const b = Math.round(250 - 36 * t);
  return `rgb(${r},${g},${b})`;
}

const LOW_CHAOS = [
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 1], [2, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
];

// IDEO-ish tetrominoes/polyominoes inspired by the sketch: stair-steps, hooks, broken wordmarks, and odd little logo clusters.
const MED_CHAOS = [
  [[0, 0], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [2, -1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [2, 1], [3, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 2]],
  [[0, 0], [0, 1], [1, 2], [2, 2]],
];

const HIGH_CHAOS = [
  [[0, 0], [1, 0], [2, 0], [3, 1]],
  [[0, 0], [1, 1], [2, 1], [3, 1]],
  [[0, 0], [0, 1], [1, 2], [2, 2]],
  [[2, 0], [1, 1], [2, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 1]],
  [[0, 0], [2, 0], [1, 1], [3, 2]],
  [[0, 0], [1, 0], [2, 1], [3, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 2]],
  [[0, 0], [0, 1], [1, 2], [2, 3]],
  [[1, 0], [0, 1], [2, 1], [3, 2]],
  [[0, 0], [1, 1], [2, 0], [3, 1]],
  [[1, 0], [0, 1], [2, 1], [3, 2]],
  [[0, 0], [1, 1], [2, 2], [3, 3]],
  [[0, 0], [2, 0], [1, 1], [3, 2]],
];

function Button({ children, className = "", variant = "default", ...props }) {
  return (
    <button
      type="button"
      className={`px-4 py-2 rounded-2xl font-semibold transition active:scale-95 touch-manipulation ${
        variant === "outline" ? "bg-white border-2 border-black" : "bg-black text-white border-2 border-black"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "", style }) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function normalize(shape) {
  const minX = Math.min(...shape.map(([x]) => x));
  const minY = Math.min(...shape.map(([, y]) => y));
  return shape.map(([x, y]) => [x - minX, y - minY]);
}

function rotate(shape) {
  return normalize(shape.map(([x, y]) => [y, -x]));
}

function orderedLetters(n) {
  return Array.from({ length: n }, (_, i) => LETTERS[i % LETTERS.length]);
}

function poolForChaos(chaos) {
  if (chaos <= 2) return LOW_CHAOS;
  if (chaos <= 4) return [...LOW_CHAOS, ...MED_CHAOS];
  return [...LOW_CHAOS, ...MED_CHAOS, ...HIGH_CHAOS];
}

function makePiece(chaos) {
  const pool = poolForChaos(chaos);
  const shape = normalize(pool[Math.floor(Math.random() * pool.length)]);
  const width = Math.max(...shape.map(([x]) => x)) + 1;
  return {
    shape,
    letters: orderedLetters(shape.length),
    x: Math.floor((COLS - width) / 2),
    y: -1,
  };
}

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function collides(board, piece, dx = 0, dy = 0, nextShape = piece.shape) {
  return nextShape.some(([sx, sy]) => {
    const x = piece.x + sx + dx;
    const y = piece.y + sy + dy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x]) return true;
    return false;
  });
}

function merge(board, piece) {
  const next = cloneBoard(board);
  piece.shape.forEach(([sx, sy], i) => {
    const x = piece.x + sx;
    const y = piece.y + sy;
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
      next[y][x] = piece.letters[i] || LETTERS[i % LETTERS.length];
    }
  });
  return next;
}

function clearLines(board) {
  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(null));
  return { board: kept, cleared };
}

function findIdeoSpans(board) {
  const spans = [];
  board.forEach((row, y) => {
    for (let x = 0; x <= row.length - IDEO_WORD.length; x += 1) {
      const word = row.slice(x, x + IDEO_WORD.length).join("");
      if (word === IDEO_WORD) spans.push({ x, y });
    }
  });
  return spans;
}

function findIdeoSpanCells(board) {
  return findIdeoSpans(board).flatMap(({ x, y }) => Array.from({ length: IDEO_WORD.length }, (_, i) => ({ x: x + i, y })));
}

function rowHasIdeo(row) {
  for (let x = 0; x <= row.length - IDEO_WORD.length; x += 1) {
    if (row.slice(x, x + IDEO_WORD.length).join("") === IDEO_WORD) return true;
  }
  return false;
}

function countClearedIdeoRows(board) {
  return board.filter((row) => row.every(Boolean) && rowHasIdeo(row)).length;
}

function scoreForLines(cleared) {
  return [0, 100, 300, 550, 900, 1250, 1600][cleared] ?? cleared * 300;
}

function scoreForClear(cleared, chaos, ideoRows = 0) {
  if (!cleared) return 5;
  const base = scoreForLines(cleared) + chaos * 20 * cleared;
  const bonusRows = Math.min(cleared, ideoRows);
  return base + Math.round((base / cleared) * bonusRows * (IDEO_LINE_MULTIPLIER - 1));
}

function chaosFromTotalLines(totalLines) {
  return Math.min(MAX_CHAOS, INITIAL_CHAOS + Math.floor(totalLines / LINES_PER_CHAOS_LEVEL));
}

async function fetchLeaderboard() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/leaderboard?select=name,score,lines,level,created_at&order=score.desc&order=lines.desc&limit=${MAX_LEADERBOARD_ENTRIES}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );

  if (!response.ok) throw new Error(`Could not load leaderboard: ${response.status}`);
  return response.json();
}

async function submitScoreToLeaderboard(entry) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: sanitizePlayerName(entry.name),
      score: entry.score,
      lines: entry.lines,
      level: entry.level,
    }),
  });

  if (!response.ok) throw new Error(`Could not save score: ${response.status}`);
}

function sanitizePlayerName(name) {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 18) : "Anonymous";
}

function addLeaderboardEntry(entries, entry) {
  return [...entries, entry].sort((a, b) => b.score - a.score || b.lines - a.lines).slice(0, MAX_LEADERBOARD_ENTRIES);
}

function getResponsiveCellSize() {
  if (typeof window === "undefined") return CELL;
  if (window.innerWidth < 768) {
    const widthFit = Math.floor((window.innerWidth - 40) / COLS);
    const heightFit = Math.floor((window.innerHeight - 260) / ROWS);
    return Math.max(16, Math.min(CELL, widthFit, heightFit));
  }
  return Math.max(18, Math.min(CELL, Math.floor((window.innerWidth - 96) / COLS)));
}

function runSelfTests() {
  const board = emptyBoard();
  const line = Array(COLS).fill("I");
  const almostLine = Array(COLS).fill("D");
  almostLine[3] = null;

  console.assert(board.length === ROWS && board.every((row) => row.length === COLS), "emptyBoard creates a 10x20 board");
  console.assert(JSON.stringify(normalize([[2, 2], [3, 2], [2, 3]])) === JSON.stringify([[0, 0], [1, 0], [0, 1]]), "normalize moves shape to origin");
  console.assert(clearLines([...board.slice(0, ROWS - 2), line, almostLine]).cleared === 1, "clearLines removes only full lines");
  console.assert(collides(board, { shape: [[0, 0]], letters: ["I"], x: -1, y: 0 }), "collides detects left wall");
  console.assert(!collides(board, { shape: [[0, 0]], letters: ["I"], x: 4, y: 0 }), "collides allows open board space");
  console.assert(poolForChaos(1) === LOW_CHAOS && poolForChaos(5).length > poolForChaos(3).length, "chaos levels increase shape variety");
  console.assert(
    chaosFromTotalLines(0) === 1 && chaosFromTotalLines(2) === 1 && chaosFromTotalLines(3) === 2 && chaosFromTotalLines(12) === MAX_CHAOS,
    "chaos tracks cumulative line clears",
  );
  console.assert(findIdeoSpans([...board.slice(0, ROWS - 1), [null, "I", "D", "E", "O", null, null, null, null, null]])[0]?.x === 1, "findIdeoSpans detects horizontal IDEO");
  console.assert(countClearedIdeoRows([...board.slice(0, ROWS - 1), ["I", "D", "E", "O", "I", "D", "E", "O", "I", "D"]]) === 1, "countClearedIdeoRows counts full IDEO rows");
  console.assert(scoreForClear(1, 1, 1) === (scoreForLines(1) + 20) * IDEO_LINE_MULTIPLIER, "scoreForClear applies IDEO multiplier");
  console.assert(sanitizePlayerName("   ") === "Anonymous" && sanitizePlayerName("Tomoya Mori Long Name").length <= 18, "sanitizePlayerName handles empty and long names");
  console.assert(addLeaderboardEntry([{ name: "A", score: 10, lines: 0 }], { name: "B", score: 20, lines: 0 })[0].name === "B", "addLeaderboardEntry sorts high scores first");
  console.assert(SUPABASE_URL.includes("supabase.co") && SUPABASE_ANON_KEY.length > 80, "Supabase config is present");
  console.assert([...LOW_CHAOS, ...MED_CHAOS, ...HIGH_CHAOS].every((shape) => shape.length === LETTERS.length), "all chaos shapes have exactly I, D, E, O blocks");
  console.assert(getResponsiveCellSize() >= 16 && getResponsiveCellSize() <= CELL, "responsive cell size stays within usable bounds");
}

function Icon({ children }) {
  return <span className="inline-flex w-4 h-4 items-center justify-center text-base leading-none mr-2">{children}</span>;
}

function LogoGlyph({ letter, size }) {
  const glyphStyle = { fill: "currentColor" };
  const normalizedLetter = String(letter).toUpperCase();

  return (
    <svg width={Math.round(size * 0.66)} height={Math.round(size * 0.66)} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {normalizedLetter === "I" && (
        <>
          <rect x="19" y="16" width="62" height="9" style={glyphStyle} />
          <rect x="45.5" y="16" width="9" height="68" style={glyphStyle} />
          <rect x="19" y="75" width="62" height="9" style={glyphStyle} />
        </>
      )}
      {normalizedLetter === "D" && (
        <path
          style={glyphStyle}
          fillRule="evenodd"
          d="M22 15h29c24 0 40 15 40 35S75 85 51 85H22V15Zm12 12v46h17c16 0 28-10 28-23S67 27 51 27H34Z"
        />
      )}
      {normalizedLetter === "E" && (
        <>
          <rect x="22" y="15" width="60" height="11" style={glyphStyle} />
          <rect x="22" y="44.5" width="48" height="11" style={glyphStyle} />
          <rect x="22" y="74" width="60" height="11" style={glyphStyle} />
          <rect x="22" y="15" width="11" height="70" style={glyphStyle} />
        </>
      )}
      {normalizedLetter === "O" && (
        <path
          style={glyphStyle}
          fillRule="evenodd"
          d="M50 11c23 0 39 17 39 39S73 89 50 89 11 72 11 50s16-39 39-39Zm0 12c-16 0-28 11-28 27s12 27 28 27 28-11 28-27-12-27-28-27Z"
        />
      )}
    </svg>
  );
}

function CellBlock({ letter, ghost = false, small = false, cellSize = CELL, smallSize = 22, ideoGlow = false }) {
  const size = small ? smallSize : cellSize;
  return (
    <div
      className="flex items-center justify-center font-semibold select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: ghost ? "transparent" : PALETTE.paper,
        backgroundImage: ideoGlow
          ? "radial-gradient(circle at 30% 30%, rgba(255,255,255,.7), transparent 34%), linear-gradient(120deg, #ff4fd8, #ffe45c, #52ff8f, #55c7ff, #b96cff, #ff4fd8)"
          : undefined,
        backgroundSize: ideoGlow ? "180% 180%, 220% 220%" : undefined,
        border: `2px solid ${ghost ? "rgba(0,0,0,.22)" : ideoGlow ? "#ffffff" : PALETTE.ink}`,
        boxShadow: ideoGlow ? "0 0 0 2px rgba(17,17,17,.82), 0 0 12px rgba(255,79,216,.52), 0 0 22px rgba(85,199,255,.38)" : undefined,
        color: ghost ? "rgba(0,0,0,.22)" : PALETTE.ink,
        lineHeight: 1,
        animation: ideoGlow ? "ideoGlowFadeIn 850ms ease-out, ideoGlowPulse 3.4s ease-in-out 850ms infinite, ideoRainbowDrift 5.8s linear infinite" : undefined,
      }}
    >
      {letter ? <LogoGlyph letter={letter} size={size} /> : null}
    </div>
  );
}

function PiecePreview({ piece, blockSize = 22 }) {
  if (!piece) return null;
  const width = Math.max(...piece.shape.map(([x]) => x)) + 1;
  const height = Math.max(...piece.shape.map(([, y]) => y)) + 1;
  return (
    <div
      className="grid gap-0 place-content-center"
      style={{ gridTemplateColumns: `repeat(${width}, ${blockSize}px)`, gridTemplateRows: `repeat(${height}, ${blockSize}px)` }}
    >
      {Array.from({ length: width * height }).map((_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        const pieceIndex = piece.shape.findIndex(([sx, sy]) => sx === x && sy === y);
        return pieceIndex >= 0 ? (
          <CellBlock key={index} small smallSize={blockSize} letter={piece.letters[pieceIndex]} />
        ) : (
          <div key={index} style={{ width: blockSize, height: blockSize }} />
        );
      })}
    </div>
  );
}

export default function IDEOBlockParty() {
  const [board, setBoard] = useState(emptyBoard);
  const [cellSize, setCellSize] = useState(() => getResponsiveCellSize());
  const [playerName, setPlayerName] = useState(() => readStoredPlayerName());
  const [nameInput, setNameInput] = useState(() => readStoredPlayerName());
  const [hasStarted, setHasStarted] = useState(() => Boolean(readStoredPlayerName()));
  const [musicEnabled, setMusicEnabled] = useState(() => readMusicEnabled());
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState("Loading shared leaderboard…");
  const [chaos, setChaos] = useState(INITIAL_CHAOS);
  const [piece, setPiece] = useState(() => makePiece(INITIAL_CHAOS));
  const [nextPiece, setNextPiece] = useState(() => makePiece(INITIAL_CHAOS));
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [clearEffect, setClearEffect] = useState(0);
  const [ideoBonusEffect, setIdeoBonusEffect] = useState(0);
  const [ideoHintVisible, setIdeoHintVisible] = useState(false);
  const [levelNotice, setLevelNotice] = useState(0);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const touchStart = useRef(null);
  const clearEffectTimeoutRef = useRef(null);
  const ideoBonusTimeoutRef = useRef(null);
  const ideoHintTimeoutRef = useRef(null);
  const hasShownIdeoHintRef = useRef(false);
  const chaosNoticeTimeoutRef = useRef(null);
  const scoreSubmittedRef = useRef(false);
  /** While the chaos level-up overlay is visible, gravity and controls are frozen (music keeps playing). */
  const chaosNoticeBlocksPlayRef = useRef(false);
  const bgmRef = useRef(null);
  const latestRef = useRef({ board, piece, nextPiece, chaos, lines, running, gameOver });

  const submitPlayerName = useCallback((e) => {
    e?.preventDefault?.();
    const safeName = sanitizePlayerName(nameInput);
    setPlayerName(safeName);
    setNameInput(safeName);
    setHasStarted(true);
    setRunning(true);
    try {
      window.localStorage.setItem(PLAYER_NAME_KEY, safeName);
    } catch {
      // localStorage can fail in private browsing or restricted embeds; the game still works for the current session.
    }
    if (musicEnabled) void bgmRef.current?.play().catch(() => {});
  }, [musicEnabled, nameInput]);

  const speed = 680 - chaos * 90;
  const noticesBlockPlay = levelNotice > 0 || ideoHintVisible;

  const dismissChaosLevelNotice = useCallback(() => {
    if (chaosNoticeTimeoutRef.current) {
      window.clearTimeout(chaosNoticeTimeoutRef.current);
      chaosNoticeTimeoutRef.current = null;
    }
    chaosNoticeBlocksPlayRef.current = false;
    setLevelNotice(0);
  }, []);

  useEffect(() => {
    runSelfTests();
  }, []);

  useEffect(() => {
    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.preload = "auto";
    bgmRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      bgmRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    const shouldPlay = hasStarted && running && !gameOver && musicEnabled;
    if (shouldPlay) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [gameOver, hasStarted, musicEnabled, running]);

  useEffect(() => {
    const updateCellSize = () => setCellSize(getResponsiveCellSize());
    updateCellSize();
    window.addEventListener("resize", updateCellSize);
    return () => window.removeEventListener("resize", updateCellSize);
  }, []);

  useEffect(() => {
    latestRef.current = { board, piece, nextPiece, chaos, lines, running, gameOver };
  }, [board, piece, nextPiece, chaos, lines, running, gameOver]);

  const spawn = useCallback((currentBoard, currentChaos, incoming) => {
    const newPiece = incoming ?? makePiece(currentChaos);
    setPiece(newPiece);
    setNextPiece(makePiece(currentChaos));
    if (collides(currentBoard, newPiece, 0, 1)) {
      setGameOver(true);
      setRunning(false);
    }
  }, []);

  const lockPiece = useCallback((currentBoard, currentPiece, dropBonus = 0) => {
    const { chaos: currentChaos, nextPiece: queuedPiece, lines: prevLines = 0 } = latestRef.current;
    const merged = merge(currentBoard, currentPiece);
    const ideoBonusRows = countClearedIdeoRows(merged);
    const result = clearLines(merged);
    const nextLines = prevLines + result.cleared;
    const targetChaos = chaosFromTotalLines(nextLines);

    setBoard(result.board);
    setLines(nextLines);
    setScore((s) => s + dropBonus + scoreForClear(result.cleared, currentChaos, ideoBonusRows));
    if (clearEffectTimeoutRef.current) {
      window.clearTimeout(clearEffectTimeoutRef.current);
      clearEffectTimeoutRef.current = null;
    }
    if (result.cleared > 0) {
      setClearEffect(result.cleared);
      clearEffectTimeoutRef.current = window.setTimeout(() => {
        setClearEffect(0);
        clearEffectTimeoutRef.current = null;
      }, LINE_CLEAR_TOAST_MS);
    } else {
      setClearEffect(0);
    }
    if (ideoBonusTimeoutRef.current) {
      window.clearTimeout(ideoBonusTimeoutRef.current);
      ideoBonusTimeoutRef.current = null;
    }
    if (ideoBonusRows > 0) {
      setIdeoBonusEffect(ideoBonusRows);
      ideoBonusTimeoutRef.current = window.setTimeout(() => {
        setIdeoBonusEffect(0);
        ideoBonusTimeoutRef.current = null;
      }, IDEO_BONUS_TOAST_MS);
    } else {
      setIdeoBonusEffect(0);
    }
    if (targetChaos > currentChaos) {
      if (chaosNoticeTimeoutRef.current) {
        window.clearTimeout(chaosNoticeTimeoutRef.current);
        chaosNoticeTimeoutRef.current = null;
      }
      chaosNoticeBlocksPlayRef.current = true;
      setLevelNotice(targetChaos);
      chaosNoticeTimeoutRef.current = window.setTimeout(() => {
        chaosNoticeBlocksPlayRef.current = false;
        setLevelNotice(0);
        chaosNoticeTimeoutRef.current = null;
      }, CHAOS_LEVEL_TOAST_MS);
    }
    setChaos(targetChaos);
    spawn(result.board, targetChaos, queuedPiece);
  }, [spawn]);

  const tick = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver) return;
    if (chaosNoticeBlocksPlayRef.current || ideoHintVisible) return;
    if (!collides(currentBoard, currentPiece, 0, 1)) {
      setPiece((p) => ({ ...p, y: p.y + 1 }));
    } else {
      lockPiece(currentBoard, currentPiece);
    }
  }, [hasStarted, ideoHintVisible, lockPiece]);

  const reset = useCallback((nextChaos = INITIAL_CHAOS) => {
    dismissChaosLevelNotice();
    if (ideoHintTimeoutRef.current) {
      window.clearTimeout(ideoHintTimeoutRef.current);
      ideoHintTimeoutRef.current = null;
    }
    setBoard(emptyBoard());
    setChaos(nextChaos);
    setPiece(makePiece(nextChaos));
    setNextPiece(makePiece(nextChaos));
    setScore(0);
    setLines(0);
    scoreSubmittedRef.current = false;
    setClearEffect(0);
    setIdeoBonusEffect(0);
    setIdeoHintVisible(false);
    setGameOver(false);
    setRunning(hasStarted);
  }, [dismissChaosLevelNotice, hasStarted]);

  const move = useCallback((dx) => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!isRunning || isGameOver || chaosNoticeBlocksPlayRef.current || noticesBlockPlay) return;
    if (collides(currentBoard, currentPiece, dx, 0)) return;
    setPiece((p) => ({ ...p, x: p.x + dx }));
  }, [noticesBlockPlay]);

  const moveHorizontalSteps = useCallback((steps) => {
    const { board: currentBoard, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!isRunning || isGameOver || chaosNoticeBlocksPlayRef.current || noticesBlockPlay || steps === 0) return;
    const direction = steps > 0 ? 1 : -1;
    setPiece((currentPiece) => {
      let nextPiece = currentPiece;
      for (let i = 0; i < Math.abs(steps); i += 1) {
        const candidate = { ...nextPiece, x: nextPiece.x + direction };
        if (collides(currentBoard, candidate)) break;
        nextPiece = candidate;
      }
      return nextPiece;
    });
  }, [noticesBlockPlay]);

  const softDrop = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver || chaosNoticeBlocksPlayRef.current || noticesBlockPlay) return;
    if (!collides(currentBoard, currentPiece, 0, 1)) {
      setPiece((p) => ({ ...p, y: p.y + 1 }));
      setScore((s) => s + 1);
    } else {
      lockPiece(currentBoard, currentPiece);
    }
  }, [hasStarted, lockPiece, noticesBlockPlay]);

  const hardDrop = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver || chaosNoticeBlocksPlayRef.current || noticesBlockPlay) return;
    let drop = 0;
    while (!collides(currentBoard, currentPiece, 0, drop + 1)) drop += 1;
    lockPiece(currentBoard, { ...currentPiece, y: currentPiece.y + drop }, drop * 2);
  }, [hasStarted, lockPiece, noticesBlockPlay]);

  const rotatePiece = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver || chaosNoticeBlocksPlayRef.current || noticesBlockPlay) return;
    const nextShape = rotate(currentPiece.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(currentBoard, currentPiece, k, 0, nextShape)) {
        setPiece((p) => ({ ...p, x: p.x + k, shape: nextShape }));
        return;
      }
    }
  }, [hasStarted, noticesBlockPlay]);

  const handleBoardTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      lastX: touch.clientX,
      moved: false,
      slammed: false,
    };
  }, []);

  const handleBoardTouchMove = useCallback((e) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!touchStart.current.slammed && dy > 52 && absY > absX * 1.25) {
      touchStart.current.slammed = true;
      touchStart.current.moved = true;
      hardDrop();
      return;
    }

    if (absX < 10 || absY > absX * 0.9) return;

    const stepDistance = Math.max(12, cellSize * 0.7);
    const dragDelta = touch.clientX - touchStart.current.lastX;
    const steps = Math.trunc(dragDelta / stepDistance);
    if (steps === 0) return;

    touchStart.current.moved = true;
    touchStart.current.lastX += steps * stepDistance;
    moveHorizontalSteps(steps);
  }, [cellSize, hardDrop, moveHorizontalSteps]);

  const handleBoardTouchEnd = useCallback((e) => {
    if (!touchStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const moved = touchStart.current.moved;
    const slammed = touchStart.current.slammed;
    touchStart.current = null;

    if (!slammed && absY > 48 && absY > absX * 1.2 && dy > 0) {
      hardDrop();
      return;
    }
    if (!moved && absX <= 16 && absY <= 16) rotatePiece();
  }, [hardDrop, rotatePiece]);

  useEffect(() => {
    const id = window.setInterval(tick, speed);
    return () => window.clearInterval(id);
  }, [tick, speed]);

  useEffect(() => {
    if (!hasStarted) return undefined;
    const onKey = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "z", "Z", "c", "C", "p", "P"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowDown") softDrop();
      if (e.key === "ArrowUp" || e.key === "z" || e.key === "Z") rotatePiece();
      if (e.key === " ") hardDrop();
      if (e.key === "c" || e.key === "C") reset();
      if (e.key === "p" || e.key === "P") setRunning((r) => !r);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hardDrop, hasStarted, move, reset, rotatePiece, softDrop]);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((entries) => {
        if (!cancelled) {
          setLeaderboard(entries);
          setLeaderboardStatus(entries.length ? "Shared leaderboard" : "No shared scores yet");
        }
      })
      .catch(() => {
        if (!cancelled) setLeaderboardStatus("Could not load shared leaderboard. Check Supabase policies.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gameOver || scoreSubmittedRef.current || !hasStarted) return;
    scoreSubmittedRef.current = true;
    const entry = {
      name: sanitizePlayerName(playerName),
      score,
      lines,
      level: chaos,
    };

    Promise.resolve()
      .then(() => {
        setLeaderboardStatus("Saving score…");
        return submitScoreToLeaderboard(entry);
      })
      .then(() => fetchLeaderboard())
      .then((entries) => {
        setLeaderboard(entries);
        setLeaderboardStatus("Score saved to shared leaderboard");
      })
      .catch(() => {
        setLeaderboard((entries) => addLeaderboardEntry(entries, entry));
        setLeaderboardStatus("Could not save online. Showing temporary local score.");
      });
  }, [chaos, gameOver, hasStarted, lines, playerName, score]);

  useEffect(
    () => () => {
      if (clearEffectTimeoutRef.current) window.clearTimeout(clearEffectTimeoutRef.current);
      if (ideoBonusTimeoutRef.current) window.clearTimeout(ideoBonusTimeoutRef.current);
      if (ideoHintTimeoutRef.current) window.clearTimeout(ideoHintTimeoutRef.current);
      if (chaosNoticeTimeoutRef.current) {
        window.clearTimeout(chaosNoticeTimeoutRef.current);
        chaosNoticeTimeoutRef.current = null;
      }
      chaosNoticeBlocksPlayRef.current = false;
    },
    [],
  );

  const ghostPiece = useMemo(() => {
    const ghost = { ...piece };
    while (!collides(board, ghost, 0, 1)) ghost.y += 1;
    return ghost;
  }, [board, piece]);

  const ideoGlowCells = useMemo(() => new Set(findIdeoSpanCells(board).map(({ x, y }) => `${x}-${y}`)), [board]);

  useEffect(() => {
    if (hasShownIdeoHintRef.current || ideoGlowCells.size === 0) return;
    hasShownIdeoHintRef.current = true;
    Promise.resolve().then(() => setIdeoHintVisible(true));
    if (ideoHintTimeoutRef.current) window.clearTimeout(ideoHintTimeoutRef.current);
    ideoHintTimeoutRef.current = window.setTimeout(() => {
      setIdeoHintVisible(false);
      ideoHintTimeoutRef.current = null;
    }, IDEO_HINT_TOAST_MS);
  }, [ideoGlowCells]);

  const display = useMemo(() => {
    const nextDisplay = cloneBoard(board);
    ghostPiece.shape.forEach(([sx, sy]) => {
      const x = ghostPiece.x + sx;
      const y = ghostPiece.y + sy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS && !nextDisplay[y][x]) nextDisplay[y][x] = "ghost";
    });
    piece.shape.forEach(([sx, sy], i) => {
      const x = piece.x + sx;
      const y = piece.y + sy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) nextDisplay[y][x] = piece.letters[i] || LETTERS[i % LETTERS.length];
    });
    return nextDisplay;
  }, [board, ghostPiece, piece]);

  const playfieldGridStyle = useMemo(() => {
    const lineRgb = Math.round(210 - chaos * 18);
    const line = `rgb(${lineRgb},${lineRgb},${lineRgb})`;
    return {
      gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
      gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: `${cellSize}px ${cellSize}px`,
    };
  }, [cellSize, chaos]);

  const boardFrameMotion = useMemo(() => {
    if (levelNotice > 0) {
      return {
        x: [0, -6, 6, -5, 5, -3, 3, 0],
        y: [0, 4, -3, 2, -2, 0],
        scale: [1, 1.06, 0.97, 1.03, 1],
      };
    }
    if (clearEffect > 0) return { scale: [1, 1.025, 1], x: 0, y: 0 };
    return { scale: 1, x: 0, y: 0 };
  }, [clearEffect, levelNotice]);

  const boardFrameTransition = useMemo(() => {
    if (levelNotice > 0) return { duration: 2.25, ease: "easeInOut" };
    if (clearEffect > 0) return { duration: 0.45 };
    return { duration: 0.2 };
  }, [clearEffect, levelNotice]);

  const leaderboardContent = (
    <>
      <div className="flex items-center justify-between mb-3">
        <strong className="text-sm uppercase tracking-wide">Leaderboard</strong>
        <span className="text-xs">Top {MAX_LEADERBOARD_ENTRIES}</span>
      </div>
      <p className="text-xs mb-3">{leaderboardStatus}</p>
      {leaderboard.length ? (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div key={`${entry.name}-${entry.score}-${entry.created_at ?? index}`} className="grid grid-cols-[28px_1fr_auto] gap-2 items-center text-sm">
              <div className="font-semibold">#{index + 1}</div>
              <div className="truncate">{entry.name}</div>
              <div className="font-semibold text-right">{entry.score}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed">No scores yet. Be the first to own the dance floor.</p>
      )}
    </>
  );

  return (
    <div className="h-dvh md:min-h-screen md:h-auto w-full overflow-hidden md:overflow-visible p-2 md:p-8 flex items-center justify-center" style={{ background: PALETTE.bg, color: PALETTE.ink }}>
      {!hasStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(251,250,247,.92)" }}>
          <form
            onSubmit={submitPlayerName}
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl text-center"
            style={{ background: PALETTE.paper, border: `2px solid ${PALETTE.ink}` }}
          >
            <div className="text-sm uppercase tracking-wide font-semibold">Welcome to</div>
            <div className="mt-1 text-4xl font-semibold tracking-tight">IDEO Block Party</div>
            <p className="mt-3 text-sm leading-relaxed">Enter your name or nickname to join the shared online leaderboard.</p>
            <input
              autoFocus
              className="mt-5 w-full rounded-2xl px-4 py-3 text-center text-xl outline-none"
              style={{ border: `2px solid ${PALETTE.ink}`, background: PALETTE.bg }}
              maxLength={18}
              placeholder="Your nickname"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            <Button className="mt-4 w-full rounded-2xl" type="submit">Start at Level 1</Button>
            <p className="mt-3 text-xs">Scores are saved to the shared Supabase leaderboard.</p>
          </form>
        </div>
      )}
      <div className="w-full max-w-5xl h-full md:h-auto grid md:grid-cols-[1fr_310px] gap-3 md:gap-6 items-center md:items-start">
        <div className="h-full md:h-auto flex flex-col items-center justify-center gap-2 md:block md:space-y-3">
          <div
            className="md:hidden w-full max-w-[360px] rounded-2xl p-2 grid grid-cols-3 gap-2 text-center shadow-md"
            style={{ background: PALETTE.paper, border: `2px solid ${PALETTE.ink}` }}
          >
            <div>
              <div className="text-[10px] uppercase font-bold">Score</div>
              <div className="text-xl font-semibold leading-none">{score}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold">Lines</div>
              <div className="text-xl font-semibold leading-none">{lines}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold">Next</div>
              <div className="flex justify-center max-h-[44px] overflow-hidden">
                <PiecePreview piece={nextPiece} blockSize={12} />
              </div>
            </div>
          </div>

          <motion.div animate={boardFrameMotion} transition={boardFrameTransition} className="flex justify-center">
            <div
              className="relative p-2 sm:p-3 rounded-2xl overflow-hidden"
              style={{
                background: playfieldShellColor(chaos),
                border: `2px solid ${PALETTE.ink}`,
                boxShadow: "0 20px 50px rgba(0,0,0,.14)",
                touchAction: "none",
              }}
              onTouchStart={handleBoardTouchStart}
              onTouchMove={handleBoardTouchMove}
              onTouchEnd={handleBoardTouchEnd}
              onTouchCancel={() => {
                touchStart.current = null;
              }}
            >
            <div className="grid" style={playfieldGridStyle}>
              {display.flatMap((row, y) =>
                row.map((cell, x) => (
                  <div key={`${x}-${y}`} style={{ width: cellSize, height: cellSize }}>
                    {cell === "ghost" ? (
                      <CellBlock letter="" ghost cellSize={cellSize} />
                    ) : cell ? (
                      <CellBlock letter={cell} cellSize={cellSize} ideoGlow={ideoGlowCells.has(`${x}-${y}`)} />
                    ) : null}
                  </div>
                )),
              )}
            </div>
            <AnimatePresence>
              {levelNotice > 0 && !gameOver && (
                <motion.div
                  key={`chaos-up-${levelNotice}`}
                  className="absolute inset-0 z-[6] pointer-events-none flex flex-col items-center justify-center rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background:
                        "radial-gradient(ellipse 90% 80% at 50% 42%, rgba(0,0,0,.78) 0%, rgba(0,0,0,.52) 50%, rgba(0,0,0,.12) 100%)",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.72, 0] }}
                    transition={{ duration: 2.35, times: [0, 0.12, 0.4, 1], ease: "easeOut" }}
                  />
                  <motion.div
                    className="relative z-10 mx-4 px-7 py-5 rounded-2xl text-center max-w-[min(92vw,420px)]"
                    style={{
                      background: "rgba(251,250,247,.96)",
                      border: `3px solid ${PALETTE.ink}`,
                      boxShadow: "0 0 0 5px rgba(255,255,255,.35), 0 28px 70px rgba(0,0,0,.45)",
                    }}
                    initial={{ scale: 0.45, opacity: 0, rotate: -5 }}
                    animate={{
                      scale: [0.45, 1.18, 1.03, 1],
                      opacity: [0, 1, 1, 1],
                      rotate: [-5, 3, -1.5, 0],
                    }}
                    transition={{ duration: 2.05, times: [0, 0.22, 0.48, 1], ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="text-[11px] sm:text-xs uppercase tracking-[0.38em] font-bold" style={{ color: "rgba(0,0,0,.5)" }}>
                      Chaos level
                    </div>
                    <div className="mt-2 text-4xl sm:text-6xl font-black tracking-tight leading-none" style={{ color: PALETTE.ink }}>
                      {levelNotice}
                    </div>
                    <div className="mt-3 text-xs sm:text-sm font-semibold" style={{ color: "rgba(0,0,0,.45)" }}>
                      Shapes get wilder — stay sharp.
                    </div>
                    <div className="mt-4 text-[10px] sm:text-xs uppercase tracking-widest font-bold" style={{ color: "rgba(0,0,0,.38)" }}>
                      Play paused — resumes when this closes
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {ideoHintVisible && !gameOver && (
                <motion.div
                  className="absolute inset-0 z-[6] pointer-events-none flex items-center justify-center p-4"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div
                    className="rounded-2xl px-5 py-4 text-center text-sm sm:text-base font-bold shadow-xl max-w-[260px]"
                    style={{
                      background: "rgba(251,250,247,.94)",
                      border: `2px solid ${PALETTE.ink}`,
                      boxShadow: "0 0 0 4px rgba(255,255,255,.35), 0 22px 54px rgba(0,0,0,.28)",
                    }}
                  >
                    <div>IDEO lined up.</div>
                    <div className="mt-1 text-xs sm:text-sm font-semibold">Clear this row for a ×{IDEO_LINE_MULTIPLIER} score boost.</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {clearEffect > 0 && !gameOver && (
              <motion.div
                className="absolute inset-0 z-[7] rounded-xl pointer-events-none flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.9, 1.08, 1.08, 1] }}
                transition={{ duration: 0.7 }}
              >
                <div
                  className="px-4 sm:px-5 py-3 rounded-2xl text-2xl sm:text-3xl font-semibold tracking-tight shadow-xl"
                  style={{ background: PALETTE.paper, border: `2px solid ${PALETTE.ink}` }}
                >
                  LINE CLEAR ×{clearEffect}
                </div>
              </motion.div>
            )}
            {ideoBonusEffect > 0 && !gameOver && (
              <motion.div
                className="absolute inset-0 z-[8] rounded-xl pointer-events-none flex items-center justify-center"
                initial={{ opacity: 0, y: 18, scale: 0.82 }}
                animate={{ opacity: [0, 1, 1, 0], y: [18, -8, -8, -22], scale: [0.82, 1.1, 1.1, 1] }}
                transition={{ duration: 1.1 }}
              >
                <div
                  className="px-5 py-3 rounded-2xl text-2xl sm:text-3xl font-black tracking-tight shadow-xl text-center"
                  style={{
                    background: "linear-gradient(135deg, #ff4fd8, #ffe45c, #52ff8f, #55c7ff)",
                    border: `2px solid ${PALETTE.ink}`,
                    color: PALETTE.ink,
                  }}
                >
                  IDEO BONUS ×{IDEO_LINE_MULTIPLIER}
                </div>
              </motion.div>
            )}
            {gameOver && (
              <div className="absolute inset-0 rounded-xl bg-white/85 flex items-center justify-center text-center p-6">
                <div>
                  <div className="text-4xl font-semibold tracking-tight">IDEO-verload</div>
                  <p className="mt-2 text-sm">The grid couldn&apos;t take the party anymore.</p>
                  <div className="mt-3 text-sm">Score submitted for <strong>{sanitizePlayerName(playerName)}</strong>.</div>
                  <Button className="mt-4 rounded-2xl" onClick={() => reset()}>
                    Play again
                  </Button>
                </div>
              </div>
            )}
            </div>
          </motion.div>

          <div className="md:hidden text-center text-xs font-semibold leading-snug">
            Tap to rotate. Drag left/right to move. Swipe down to slam.
          </div>

          <div
            className="md:hidden w-full max-w-[360px] grid grid-cols-4 gap-2 rounded-2xl p-2 shadow-md"
            style={{ background: PALETTE.paper, border: `2px solid ${PALETTE.ink}` }}
          >
            <Button className="rounded-xl px-2 py-2 text-sm" onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Play"}
            </Button>
            <Button className="rounded-xl px-2 py-2 text-sm" variant="outline" onClick={() => reset()}>
              Reset
            </Button>
            <Button
              className="rounded-xl px-2 py-2 text-sm"
              variant="outline"
              aria-pressed={musicEnabled}
              onClick={() => {
                setMusicEnabled((on) => {
                  const next = !on;
                  try {
                    window.localStorage.setItem(MUSIC_ENABLED_KEY, next ? "1" : "0");
                  } catch {
                    // ignore
                  }
                  return next;
                });
              }}
            >
              {musicEnabled ? "Music" : "Muted"}
            </Button>
            <Button className="rounded-xl px-2 py-2 text-sm" variant="outline" onClick={() => setLeaderboardOpen(true)}>
              Scores
            </Button>
          </div>
        </div>

        <div className="hidden md:block space-y-4">
          <Card className="rounded-2xl shadow-lg" style={{ border: `2px solid ${PALETTE.ink}`, background: PALETTE.paper }}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-2xl font-semibold" style={{ border: `2px solid ${PALETTE.ink}` }}>
                  ⚡
                </div>
                <div>
                  <h1 className="text-3xl font-semibold leading-none tracking-tight">IDEO Block Party</h1>
                  <p className="text-sm mt-1">How might we clear lines?</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl p-3 flex items-center justify-between" style={{ background: PALETTE.soft }}>
                <div>
                  <div className="text-xs uppercase font-bold">Player</div>
                  <div className="text-xl font-semibold">{sanitizePlayerName(playerName)}</div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    dismissChaosLevelNotice();
                    setRunning(false);
                    setHasStarted(false);
                  }}
                >
                  Change
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-xl p-3" style={{ background: PALETTE.soft }}>
                  <div className="text-xs uppercase font-bold">Score</div>
                  <div className="text-3xl font-semibold">{score}</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: PALETTE.soft }}>
                  <div className="text-xs uppercase font-bold">Lines</div>
                  <div className="text-3xl font-semibold">{lines}</div>
                </div>
              </div>

              <div className="mt-5 rounded-xl p-4 flex items-center justify-between" style={{ background: PALETTE.soft }}>
                <div>
                  <div className="text-xs uppercase font-bold mb-2">Next</div>
                  <PiecePreview piece={nextPiece} />
                </div>
                <div className="hidden md:block text-right text-xs leading-relaxed max-w-[145px]">
                  Arrow keys move/drop.<br />↑ rotates. Space slams.<br />C resets the game.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button className="rounded-2xl" onClick={() => setRunning((r) => !r)}>
                  {running ? <Icon>Ⅱ</Icon> : <Icon>▶</Icon>}
                  {running ? "Pause" : "Play"}
                </Button>
                <Button className="rounded-2xl" variant="outline" onClick={() => reset()}>
                  <Icon>↻</Icon>Reset
                </Button>
                <Button
                  className="rounded-2xl col-span-2"
                  variant="outline"
                  type="button"
                  aria-pressed={musicEnabled}
                  onClick={() => {
                    setMusicEnabled((on) => {
                      const next = !on;
                      try {
                        window.localStorage.setItem(MUSIC_ENABLED_KEY, next ? "1" : "0");
                      } catch {
                        // ignore
                      }
                      return next;
                    });
                  }}
                >
                  <Icon>{musicEnabled ? "♪" : "−"}</Icon>
                  {musicEnabled ? "Music on" : "Music off"}
                </Button>
              </div>

            </CardContent>
          </Card>

          <Card className="rounded-2xl" style={{ border: `2px solid ${PALETTE.ink}`, background: PALETTE.paper }}>
            <CardContent className="p-4">{leaderboardContent}</CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {leaderboardOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-50 flex items-end p-2"
            style={{ background: "rgba(0,0,0,.28)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLeaderboardOpen(false)}
          >
            <motion.div
              className="w-full rounded-3xl p-4 shadow-2xl"
              style={{ background: PALETTE.paper, border: `2px solid ${PALETTE.ink}` }}
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              onClick={(e) => e.stopPropagation()}
            >
              {leaderboardContent}
              <Button className="w-full mt-4 rounded-2xl" onClick={() => setLeaderboardOpen(false)}>
                Back to game
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
