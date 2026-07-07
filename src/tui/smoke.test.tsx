import { describe, it, expect, afterEach } from "bun:test";
import { render } from "ink-testing-library";
import { resolve } from "node:path";
import { setWorkspaceRoot } from "../platform/fs.ts";
import { ThemeProvider } from "./useTheme.tsx";
import { NotesScreen } from "./screens/NotesScreen.tsx";
import { BoardScreen } from "./screens/BoardScreen.tsx";
import { PrScreen } from "./screens/PrScreen.tsx";
import { TabBar } from "./components/TabBar.tsx";
import { HelpOverlay } from "./components/HelpOverlay.tsx";

const WS = resolve("fixtures/demo");
setWorkspaceRoot(WS);

const noop = () => {};
const unmounts: Array<() => void> = [];
afterEach(() => {
  while (unmounts.length) unmounts.pop()!();
});

function mount(node: React.ReactNode) {
  const r = render(<ThemeProvider id="sapphire">{node}</ThemeProvider>);
  unmounts.push(r.unmount);
  return r;
}

describe("TUI smoke", () => {
  it("renders the notes screen with a note from the workspace", () => {
    const { lastFrame } = mount(
      <NotesScreen ws={WS} active={false} height={20} suspendAndEdit={async () => {}} setHints={noop} toast={noop} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("notes");
    expect(out).toMatch(/Welcome|Daily Notes|Random Notes/);
  });

  it("renders the board screen with columns", () => {
    const { lastFrame } = mount(
      <BoardScreen ws={WS} active={false} height={20} width={120} setHints={noop} toast={noop} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("Todo");
    expect(out).toContain("In Progress");
  });

  it("renders the PR screen chrome without a network call", () => {
    const { lastFrame } = mount(
      <PrScreen ws={WS} active={false} height={20} setHints={noop} toast={noop} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("Created");
    expect(out).toContain("Assigned");
  });

  it("renders the tab bar and help overlay", () => {
    const tab = mount(<TabBar view="notes" workspace={WS} themeName="Sapphire" />);
    expect(tab.lastFrame()).toContain("Sapphire");
    const help = mount(<HelpOverlay />);
    expect(help.lastFrame()).toContain("keybindings");
  });
});
