export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

// Minimal flag parser: `--key val`, `--key=val`, `--bool`, `-w val`, `-b`.
// Known value-taking flags consume the next token; everything else is a bool.
const VALUE_FLAGS = new Set(["workspace", "w", "interval", "pr", "due", "editor"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (VALUE_FLAGS.has(body) && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        flags[body] = argv[++i];
      } else {
        flags[body] = true;
      }
    } else if (tok.startsWith("-") && tok.length > 1 && !/^-\d/.test(tok)) {
      const key = tok.slice(1);
      if (VALUE_FLAGS.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(tok);
    }
  }
  return { positionals, flags };
}

export function flagStr(flags: Record<string, string | boolean>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = flags[k];
    if (typeof v === "string") return v;
  }
  return undefined;
}

export function flagBool(flags: Record<string, string | boolean>, ...keys: string[]): boolean {
  return keys.some((k) => flags[k] === true || flags[k] === "true");
}
