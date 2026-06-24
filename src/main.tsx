import { render } from "preact";
import App from "./App";
import { applyTheme, applyDockIcon, applyNoteText } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/editor.css";
import "./styles/board.css";
import "./styles/prs.css";

applyTheme();
applyNoteText();
applyDockIcon();

render(<App />, document.getElementById("root")!);
