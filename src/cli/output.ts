let jsonMode = false;

export function setJsonMode(on: boolean) {
  jsonMode = on;
}

export function isJson() {
  return jsonMode;
}

// Print a successful result: JSON when --json, otherwise a human string built by
// `human`. The result object is what CI consumes.
export function ok(result: unknown, human: (r: any) => string): void {
  if (jsonMode) {
    process.stdout.write(JSON.stringify(result) + "\n");
  } else {
    const s = human(result);
    if (s) process.stdout.write(s + "\n");
  }
}

export function fail(code: string, message: string, exit = 1): never {
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ error: code, message }) + "\n");
  } else {
    process.stderr.write(`error: ${message}\n`);
  }
  process.exit(exit);
}
