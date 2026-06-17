import { useState } from "preact/hooks";
import { X, Trash2 } from "lucide-preact";
import { COLUMN_KEYS, ColumnKey, Task } from "../../lib/taskParser";

function titleText(t: Task): string {
  return t.title
    .replace(/#[\w-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function TaskDetail({
  task,
  currentKey,
  onSave,
  onMove,
  onDelete,
  onClose,
}: {
  task: Task;
  currentKey: ColumnKey;
  onSave: (f: { text: string; tags: string[]; body: string }) => void;
  onMove: (key: ColumnKey) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(titleText(task));
  const [tags, setTags] = useState<string[]>([...task.tags]);
  const [body, setBody] = useState(task.body);
  const [tagInput, setTagInput] = useState("");
  const [key, setKey] = useState<ColumnKey>(currentKey);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").replace(/\s+/g, "-");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function save() {
    onSave({ text, tags, body });
    if (key !== currentKey) onMove(key);
    onClose();
  }

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-head">
          <input
            class="modal-title"
            value={text}
            placeholder="Task title"
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <button class="icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <label class="modal-label">Status</label>
        <select
          class="repo-select"
          value={key}
          onChange={(e) => setKey(e.currentTarget.value as ColumnKey)}
        >
          {COLUMN_KEYS.map((k) => (
            <option value={k} key={k}>
              {k}
            </option>
          ))}
        </select>

        <label class="modal-label">Tags</label>
        <div class="tag-edit">
          {tags.map((t) => (
            <span class="tag" key={t}>
              #{t}
              <button class="tag-x" onClick={() => setTags(tags.filter((x) => x !== t))}>
                ×
              </button>
            </span>
          ))}
          <input
            class="tag-input"
            value={tagInput}
            placeholder="add tag…"
            onInput={(e) => setTagInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
          />
        </div>

        <label class="modal-label">Notes</label>
        <textarea
          class="modal-notes"
          value={body}
          rows={6}
          placeholder="Add notes…"
          onInput={(e) => setBody(e.currentTarget.value)}
        />

        {task.pr && (
          <a
            class="card-pr"
            href={task.pr}
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: "10px" }}
          >
            Open PR
          </a>
        )}

        <div class="modal-actions">
          <button
            class="btn ghost danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
          <div style={{ flex: 1 }} />
          <button class="btn" onClick={onClose}>
            Cancel
          </button>
          <button class="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
