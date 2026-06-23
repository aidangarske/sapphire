import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: true, label: false });

// Notes are rendered with raw HTML enabled (so `<u>` etc. work), but the output
// is sanitized so a malicious note can't run script / reach the Tauri bridge.
export function renderMarkdown(src: string): string {
  const clean = DOMPurify.sanitize(md.render(src), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"],
  });
  return clean;
}
