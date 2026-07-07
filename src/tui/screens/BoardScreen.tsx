import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { TaskDetail } from "../components/TaskDetail.tsx";
import { openUrl } from "../../platform/opener.ts";
import * as boards from "../../services/boards.ts";
import { logActivity } from "../../services/daily.ts";
import {
  tasksIn,
  addTask,
  moveTask,
  toggleTask,
  removeTask,
  updateTask,
  type Board,
} from "../../core/board.ts";

type Mode = "list" | "add" | "detail" | "edit";

const cardLabel = (title: string) => (title || "(untitled)").replace(/\s+#[\w-]+/g, "");

// Estimated rendered height of a wrapped card (+1 for the spacing line after it).
function cardLineCost(title: string, colWidth: number): number {
  const inner = Math.max(1, colWidth - 4);
  return Math.max(1, Math.ceil((cardLabel(title).length + 2) / inner)) + 1;
}

// Pick the card window to render so the focused card stays visible and the
// wrapped cards fit the column's line budget.
function cardWindow(costs: number[], budget: number, focus: number): { start: number; end: number } {
  if (costs.length === 0) return { start: 0, end: 0 };
  let start = 0;
  for (;;) {
    let used = 0;
    let end = start;
    while (end < costs.length && (end === start || used + costs[end] <= budget)) {
      used += costs[end];
      end++;
    }
    if (focus < end || start >= costs.length - 1) return { start, end };
    start++;
  }
}

export function BoardScreen({
  ws,
  active,
  height,
  width,
  setHints,
  toast,
}: {
  ws: string;
  active: boolean;
  height: number;
  width: number;
  setHints: (h: string) => void;
  toast: (t: string) => void;
}) {
  const c = useTheme();
  const [file, setFile] = useState(() => boards.getActiveBoard(ws));
  const [board, setBoard] = useState<Board>(() => boards.readBoard(ws, boards.getActiveBoard(ws)));
  const [colIdx, setColIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [colScroll, setColScroll] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const ddPending = useRef<{ idx: number; ts: number } | null>(null);

  const reload = (f = file) => setBoard(boards.readBoard(ws, f));
  useEffect(() => reload(), [ws, file]);

  const cols = board.columns;
  const clampedCol = Math.min(colIdx, cols.length - 1);
  const col = cols[clampedCol];
  const cards = col ? tasksIn(col) : [];
  const selCard = cards[Math.min(cardIdx, cards.length - 1)];

  // Comfortable, readable column width; show as many as fit and scroll the rest.
  const colWidth = Math.min(40, Math.max(22, Math.floor(width / 4) - 2));
  const perCol = colWidth + 3; // border(2) + margin(1)
  const visibleCount = Math.max(1, Math.floor(width / perCol));
  const rowsPerCol = Math.max(3, height - 5);

  // Keep the focused column inside the visible window (horizontal scroll).
  useEffect(() => {
    if (clampedCol < colScroll) setColScroll(clampedCol);
    else if (clampedCol >= colScroll + visibleCount) setColScroll(clampedCol - visibleCount + 1);
  }, [clampedCol, visibleCount]);

  useEffect(() => {
    if (active && mode === "list") {
      setHints("↑↓ pick card · < > move to next/prev column · d done · dd delete · ⏎ details · n add · ←→ switch column · [ ] board");
    }
  }, [active, mode]);

  const persist = (b: Board) => {
    boards.writeBoard(ws, file, b);
    setBoard({ ...b });
  };

  const moveCard = (dir: -1 | 1) => {
    if (!col || cards.length === 0) return;
    const target = cols[clampedCol + dir];
    if (!target) return;
    const task = cards[Math.min(cardIdx, cards.length - 1)];
    moveTask(board, task, target.key, 9999);
    if (target.key === "Done") logActivity(ws, "done", task.title, undefined, task.pr);
    else if (target.key === "Blocked") logActivity(ws, "blocked", task.title, undefined, task.pr);
    else if (target.key === "In Progress") logActivity(ws, "inprogress", task.title, undefined, task.pr);
    persist(board);
    setColIdx(clampedCol + dir);
    setCardIdx(0);
  };

  const switchBoard = (dir: -1 | 1) => {
    const list = boards.listBoards(ws);
    const cur = list.findIndex((b) => b.path.endsWith(file));
    const next = list[(cur + dir + list.length) % list.length];
    if (next) {
      const nf = next.path.split("/").pop()!;
      setFile(nf);
      boards.setActiveBoard(ws, nf);
      setColIdx(0);
      setCardIdx(0);
      setColScroll(0);
    }
  };

  useInput(
    (input, key) => {
      if (mode !== "list") return;
      if (key.leftArrow || input === "h") {
        setColIdx((i) => Math.max(0, Math.min(i, cols.length - 1) - 1));
        setCardIdx(0);
      } else if (key.rightArrow || input === "l") {
        setColIdx((i) => Math.min(cols.length - 1, i + 1));
        setCardIdx(0);
      } else if (key.upArrow || input === "k")
        setCardIdx((i) => (cards.length ? (i - 1 + cards.length) % cards.length : 0));
      else if (key.downArrow || input === "j")
        setCardIdx((i) => (cards.length ? (i + 1) % cards.length : 0));
      else if (key.return && selCard) setMode("detail");
      else if (input === "<" || input === ",") moveCard(-1);
      else if (input === ">" || input === ".") moveCard(1);
      else if (input === "n") setMode("add");
      else if (input === "d" && selCard) {
        const now = Date.now();
        const p = ddPending.current;
        if (p && p.idx === cardIdx && now - p.ts < 600) {
          // second 'd' -> delete
          removeTask(board, selCard);
          persist(board);
          setCardIdx((i) => Math.max(0, i - 1));
          toast("deleted");
          ddPending.current = null;
        } else {
          // first 'd' -> mark done
          toggleTask(board, selCard);
          if (selCard.checked) logActivity(ws, "done", selCard.title, undefined, selCard.pr);
          persist(board);
          ddPending.current = { idx: cardIdx, ts: now };
        }
      } else if (input === "]") switchBoard(1);
      else if (input === "[") switchBoard(-1);
    },
    { isActive: active && mode === "list" },
  );

  const visibleCols = cols.slice(colScroll, colScroll + visibleCount);
  const moreLeft = colScroll > 0;
  const moreRight = colScroll + visibleCount < cols.length;

  const selFull = selCard
    ? (selCard.title.replace(/\s+#[\w-]+/g, "").trim() || "(untitled)")
    : "";

  return (
    <Box flexDirection="column" height={height}>
      <Box justifyContent="space-between">
        <Text>
          <Text color={c.muted}>board: </Text>
          <Text color={c.accentHi} bold>
            {file.replace(/\.md$/, "")}
          </Text>
        </Text>
        <Text color={c.muted}>
          {moreLeft ? "‹ " : "  "}
          {clampedCol + 1}/{cols.length}
          {moreRight ? " ›" : "  "}
        </Text>
      </Box>

      {mode === "detail" && selCard ? (
        <Box flexGrow={1} paddingTop={1}>
          <TaskDetail
            task={selCard}
            column={col?.key ?? ""}
            onClose={() => setMode("list")}
            onOpenPr={() => {
              if (selCard.pr) openUrl(selCard.pr);
              toast("opened PR");
            }}
            onEdit={() => setMode("edit")}
          />
        </Box>
      ) : (
      <Box flexDirection="row" flexGrow={1}>
        {visibleCols.map((column) => {
          const ci = cols.indexOf(column);
          const list = tasksIn(column);
          const focused = ci === clampedCol;
          return (
            <Box
              key={column.key}
              flexDirection="column"
              width={colWidth}
              marginRight={1}
              borderStyle="round"
              borderColor={focused ? c.accent : undefined}
              paddingX={1}
            >
              <Text color={focused ? c.accent : c.muted} bold wrap="truncate">
                {column.key} ({list.length})
              </Text>
              {(() => {
                const costs = list.map((t) => cardLineCost(t.title, colWidth));
                const focusIdx = focused ? Math.min(cardIdx, list.length - 1) : -1;
                const { start, end } = cardWindow(costs, rowsPerCol, focusIdx);
                return (
                  <>
                    {start > 0 && <Text color={c.muted}>↑ {start} above</Text>}
                    {list.slice(start, end).map((task, i) => {
                      const idx = start + i;
                      const isSel = focused && idx === focusIdx;
                      const done = task.checked;
                      return (
                        <Box key={idx} marginBottom={1}>
                          <Text
                            wrap="wrap"
                            color={isSel ? c.bg0 : done ? c.muted : undefined}
                            backgroundColor={isSel ? c.accent : undefined}
                            strikethrough={done && !isSel}
                          >
                            {done ? "✓ " : "• "}
                            {cardLabel(task.title)}
                          </Text>
                        </Box>
                      );
                    })}
                    {end < list.length && (
                      <Text color={c.muted}>+ {list.length - end} more</Text>
                    )}
                  </>
                );
              })()}
            </Box>
          );
        })}
      </Box>
      )}

      {mode === "add" && col ? (
        <Prompt
          label={`add to ${col.key}:`}
          onSubmit={(v) => {
            setMode("list");
            if (v.trim()) {
              addTask(board, col.key, v.trim());
              persist(board);
            }
          }}
          onCancel={() => setMode("list")}
        />
      ) : mode === "edit" && selCard ? (
        <Prompt
          label="edit task:"
          initial={selCard.title}
          onSubmit={(v) => {
            setMode("list");
            const text = v.trim();
            if (!text) return;
            const hashes = [...text.matchAll(/#([\w-]+)/g)].map((m) => m[1]);
            selCard.refs = hashes.filter((h) => /^\d+$/.test(h)).map(Number);
            const tags = hashes.filter((h) => !/^\d+$/.test(h));
            const plain = text.replace(/#[\w-]+/g, "").replace(/\s+/g, " ").trim();
            updateTask(selCard, { text: plain, tags, body: selCard.body });
            persist(board);
            toast("updated");
          }}
          onCancel={() => setMode("list")}
        />
      ) : (
        <Text wrap="truncate" color={c.muted}>
          {selCard ? (
            <>
              <Text color={c.text}>{selFull}</Text>
              {selCard.tags.length ? <Text color={c.accentHi}>  {selCard.tags.map((t) => `#${t}`).join(" ")}</Text> : null}
              {selCard.pr ? <Text color={c.accent}>  {selCard.pr}</Text> : null}
            </>
          ) : (
            "empty column — press n to add a task"
          )}
        </Text>
      )}
    </Box>
  );
}
