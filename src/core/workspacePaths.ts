export const notesDir = (ws: string) => `${ws}/notes`;
export const tasksDir = (ws: string) => `${ws}/tasks`;
export const configDir = (ws: string) => `${ws}/config`;
export const boardPath = (ws: string) => `${ws}/tasks/board.md`;
export const indexPath = (ws: string) => `${ws}/config/notes-index.json`;
export const statePath = (ws: string) => `${ws}/config/state.json`;
export const activityPath = (ws: string) => `${ws}/config/activity.json`;
export const notePath = (ws: string, name: string) => `${notesDir(ws)}/${name}.md`;
export const boardFilePath = (ws: string, file: string) => `${tasksDir(ws)}/${file}`;

export const BOARD_TEMPLATE =
  "## Todo\n\n## In Progress\n\n## Blocked\n\n## Done\n\n## Want To Do\n";
