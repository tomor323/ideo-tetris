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
    if (v === null) return true;
    return v !== "0";
  } catch {
    return true;
  }
}
const SUPABASE_URL = "https://xxlzekgookhwnwuwjtzb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bHpla2dvb2tod253dXdqdHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjA1NjQsImV4cCI6MjA5MzU5NjU2NH0.MgpItekpqVYWeuaSSFcZ0v06IJ07GISTkfG0W-LcCf8";
const MAX_LEADERBOARD_ENTRIES = 10;
const LETTERS = ["I", "D", "E", "O"];
const LINE_CLEAR_TOAST_MS = 700;
const CHAOS_LEVEL_TOAST_MS = 2600;

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

function scoreForLines(cleared) {
  return [0, 100, 300, 550, 900, 1250, 1600][cleared] ?? cleared * 300;
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
  const sidePadding = window.innerWidth < 768 ? 56 : 96;
  return Math.max(18, Math.min(CELL, Math.floor((window.innerWidth - sidePadding) / COLS)));
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
  console.assert(sanitizePlayerName("   ") === "Anonymous" && sanitizePlayerName("Tomoya Mori Long Name").length <= 18, "sanitizePlayerName handles empty and long names");
  console.assert(addLeaderboardEntry([{ name: "A", score: 10, lines: 0 }], { name: "B", score: 20, lines: 0 })[0].name === "B", "addLeaderboardEntry sorts high scores first");
  console.assert(SUPABASE_URL.includes("supabase.co") && SUPABASE_ANON_KEY.length > 80, "Supabase config is present");
  console.assert([...LOW_CHAOS, ...MED_CHAOS, ...HIGH_CHAOS].every((shape) => shape.length === LETTERS.length), "all chaos shapes have exactly I, D, E, O blocks");
  console.assert(getResponsiveCellSize() >= 18 && getResponsiveCellSize() <= CELL, "responsive cell size stays within usable bounds");
}

function Icon({ children }) {
  return <span className="inline-flex w-4 h-4 items-center justify-center text-base leading-none mr-2">{children}</span>;
}

function CellBlock({ letter, ghost = false, small = false, cellSize = CELL }) {
  const size = small ? 22 : cellSize;
  return (
    <div
      className="flex items-center justify-center font-semibold select-none"
      style={{
        width: size,
        height: size,
        background: ghost ? "transparent" : PALETTE.paper,
        border: `2px solid ${ghost ? "rgba(0,0,0,.22)" : PALETTE.ink}`,
        color: ghost ? "rgba(0,0,0,.22)" : PALETTE.ink,
        fontSize: small ? 18 : Math.max(16, Math.floor(cellSize * 0.76)),
        lineHeight: 1,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {letter}
    </div>
  );
}

function PiecePreview({ piece }) {
  if (!piece) return null;
  const width = Math.max(...piece.shape.map(([x]) => x)) + 1;
  const height = Math.max(...piece.shape.map(([, y]) => y)) + 1;
  return (
    <div
      className="grid gap-0 place-content-center"
      style={{ gridTemplateColumns: `repeat(${width}, 22px)`, gridTemplateRows: `repeat(${height}, 22px)` }}
    >
      {Array.from({ length: width * height }).map((_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        const pieceIndex = piece.shape.findIndex(([sx, sy]) => sx === x && sy === y);
        return pieceIndex >= 0 ? (
          <CellBlock key={index} small letter={piece.letters[pieceIndex]} />
        ) : (
          <div key={index} style={{ width: 22, height: 22 }} />
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
  const [scoreSaved, setScoreSaved] = useState(false);
  const [chaos, setChaos] = useState(INITIAL_CHAOS);
  const [piece, setPiece] = useState(() => makePiece(INITIAL_CHAOS));
  const [nextPiece, setNextPiece] = useState(() => makePiece(INITIAL_CHAOS));
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [clearEffect, setClearEffect] = useState(0);
  const [levelNotice, setLevelNotice] = useState(0);
  const touchStart = useRef(null);
  const clearEffectTimeoutRef = useRef(null);
  const chaosNoticeTimeoutRef = useRef(null);
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
    const result = clearLines(merged);
    const nextLines = prevLines + result.cleared;
    const targetChaos = chaosFromTotalLines(nextLines);

    setBoard(result.board);
    setLines(nextLines);
    setScore((s) => s + dropBonus + (result.cleared ? scoreForLines(result.cleared) + currentChaos * 20 * result.cleared : 5));
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
    if (chaosNoticeBlocksPlayRef.current) return;
    if (!collides(currentBoard, currentPiece, 0, 1)) {
      setPiece((p) => ({ ...p, y: p.y + 1 }));
    } else {
      lockPiece(currentBoard, currentPiece);
    }
  }, [hasStarted, lockPiece]);

  const reset = useCallback((nextChaos = INITIAL_CHAOS) => {
    dismissChaosLevelNotice();
    setBoard(emptyBoard());
    setChaos(nextChaos);
    setPiece(makePiece(nextChaos));
    setNextPiece(makePiece(nextChaos));
    setScore(0);
    setLines(0);
    setScoreSaved(false);
    setClearEffect(0);
    setGameOver(false);
    setRunning(hasStarted);
  }, [dismissChaosLevelNotice, hasStarted]);

  const move = useCallback((dx) => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!isRunning || isGameOver || chaosNoticeBlocksPlayRef.current) return;
    if (collides(currentBoard, currentPiece, dx, 0)) return;
    setPiece((p) => ({ ...p, x: p.x + dx }));
  }, []);

  const softDrop = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver || chaosNoticeBlocksPlayRef.current) return;
    if (!collides(currentBoard, currentPiece, 0, 1)) {
      setPiece((p) => ({ ...p, y: p.y + 1 }));
      setScore((s) => s + 1);
    } else {
      lockPiece(currentBoard, currentPiece);
    }
  }, [hasStarted, lockPiece]);

  const hardDrop = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver || chaosNoticeBlocksPlayRef.current) return;
    let drop = 0;
    while (!collides(currentBoard, currentPiece, 0, drop + 1)) drop += 1;
    lockPiece(currentBoard, { ...currentPiece, y: currentPiece.y + drop }, drop * 2);
  }, [hasStarted, lockPiece]);

  const rotatePiece = useCallback(() => {
    const { board: currentBoard, piece: currentPiece, running: isRunning, gameOver: isGameOver } = latestRef.current;
    if (!hasStarted || !isRunning || isGameOver || chaosNoticeBlocksPlayRef.current) return;
    const nextShape = rotate(currentPiece.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(currentBoard, currentPiece, k, 0, nextShape)) {
        setPiece((p) => ({ ...p, x: p.x + k, shape: nextShape }));
        return;
      }
    }
  }, [hasStarted]);

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
    setLeaderboardStatus("Loading shared leaderboard…");
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
    if (!gameOver || scoreSaved || !hasStarted) return;
    const entry = {
      name: sanitizePlayerName(playerName),
      score,
      lines,
      level: chaos,
    };

    setScoreSaved(true);
    setLeaderboardStatus("Saving score…");
    submitScoreToLeaderboard(entry)
      .then(() => fetchLeaderboard())
      .then((entries) => {
        setLeaderboard(entries);
        setLeaderboardStatus("Score saved to shared leaderboard");
      })
      .catch(() => {
        setLeaderboard((entries) => addLeaderboardEntry(entries, entry));
        setLeaderboardStatus("Could not save online. Showing temporary local score.");
      });
  }, [chaos, gameOver, hasStarted, lines, playerName, score, scoreSaved]);

  useEffect(
    () => () => {
      if (clearEffectTimeoutRef.current) window.clearTimeout(clearEffectTimeoutRef.current);
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

  return (
    <div className="min-h-screen w-full p-4 md:p-8 flex items-center justify-center" style={{ background: PALETTE.bg, color: PALETTE.ink }}>
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
      <div className="w-full max-w-5xl grid md:grid-cols-[1fr_310px] gap-6 items-start">
        <div className="space-y-3">
          <motion.div animate={boardFrameMotion} transition={boardFrameTransition} className="flex justify-center">
            <div
              className="relative p-2 sm:p-3 rounded-2xl overflow-hidden"
              style={{
                background: playfieldShellColor(chaos),
                border: `2px solid ${PALETTE.ink}`,
                boxShadow: "0 20px 50px rgba(0,0,0,.14)",
              }}
              onTouchStart={(e) => {
                touchStart.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStart.current == null) return;
                const dx = e.changedTouches[0].clientX - touchStart.current;
                if (Math.abs(dx) > 40) move(dx > 0 ? 1 : -1);
                else rotatePiece();
                touchStart.current = null;
              }}
            >
            <div className="grid" style={playfieldGridStyle}>
              {display.flatMap((row, y) =>
                row.map((cell, x) => (
                  <div key={`${x}-${y}`} style={{ width: cellSize, height: cellSize }}>
                    {cell === "ghost" ? <CellBlock letter="" ghost cellSize={cellSize} /> : cell ? <CellBlock letter={cell} cellSize={cellSize} /> : null}
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

          <div
            className="md:hidden grid grid-cols-3 gap-2 rounded-3xl p-3 shadow-lg"
            style={{ background: PALETTE.paper, border: `2px solid ${PALETTE.ink}` }}
            aria-label="Touch controls"
          >
            <Button variant="outline" className="min-h-16 rounded-2xl text-3xl" aria-label="Move left" onClick={() => move(-1)}>
              ←
            </Button>
            <Button variant="outline" className="min-h-16 rounded-2xl text-base" aria-label="Rotate block" onClick={rotatePiece}>
              ↻ Rotate
            </Button>
            <Button variant="outline" className="min-h-16 rounded-2xl text-3xl" aria-label="Move right" onClick={() => move(1)}>
              →
            </Button>
            <Button variant="outline" className="col-span-1 min-h-16 rounded-2xl text-base" aria-label="Drop one row" onClick={softDrop}>
              Drop
            </Button>
            <Button className="col-span-2 min-h-16 rounded-2xl text-lg" aria-label="Slam block to the bottom" onClick={hardDrop}>
              Slam
            </Button>
          </div>
        </div>

        <div className="space-y-4">
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
            <CardContent className="p-4">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
