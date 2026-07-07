import { useEffect, useRef } from "react";
import { useStdin } from "ink";

// Scroll-wheel support. Mouse tracking is enabled in main.tsx; here we parse SGR
// wheel events (button 64 = up, 65 = down) from stdin and report a line delta.
// A ref keeps the subscription stable across renders.
export function useWheel(onScroll: (delta: number) => void, active = true): void {
  const handler = useRef(onScroll);
  handler.current = onScroll;
  const { stdin } = useStdin();

  useEffect(() => {
    if (!active || !stdin) return;
    const onData = (data: Buffer | string) => {
      const s = typeof data === "string" ? data : data.toString("utf8");
      if (!s.includes("\x1b[<")) return;
      const re = /\x1b\[<(\d+);\d+;\d+[Mm]/g;
      let m: RegExpExecArray | null;
      let delta = 0;
      while ((m = re.exec(s))) {
        const button = Number(m[1]);
        if (button === 64) delta -= 3; // wheel up
        else if (button === 65) delta += 3; // wheel down
      }
      if (delta !== 0) handler.current(delta);
    };
    stdin.on("data", onData);
    return () => {
      stdin.off("data", onData);
    };
  }, [stdin, active]);
}
