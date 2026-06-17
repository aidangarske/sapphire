import { Terminal, Copy, RefreshCw, ExternalLink } from "lucide-preact";
import { openExternal } from "../../lib/github";

export default function Login({
  status,
  onRecheck,
}: {
  status: "not-authed" | "gh-missing";
  onRecheck: () => void;
}) {
  const missing = status === "gh-missing";
  const cmd = missing ? "brew install gh && gh auth login" : "gh auth login";

  return (
    <div class="login">
      <div class="login-card">
        <div class="login-logo">
          <Terminal size={34} />
        </div>
        <h1>{missing ? "Install GitHub CLI" : "Sign in with GitHub"}</h1>
        <p class="login-sub">
          {missing
            ? "Sapphire uses the GitHub CLI to read your PRs. Install it and sign in once:"
            : "Sapphire uses your GitHub CLI session. Run this once in your terminal:"}
        </p>

        <div class="device-code cmd">
          <span>{cmd}</span>
          <button class="icon-btn" title="Copy" onClick={() => navigator.clipboard.writeText(cmd)}>
            <Copy size={15} />
          </button>
        </div>

        <button class="btn primary" onClick={onRecheck}>
          <RefreshCw size={16} /> I've signed in — refresh
        </button>

        {missing && (
          <button class="btn" onClick={() => openExternal("https://cli.github.com")}>
            <ExternalLink size={15} /> GitHub CLI website
          </button>
        )}
      </div>
    </div>
  );
}
