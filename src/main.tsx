import { render } from "preact";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/editor.css";
import "./styles/board.css";
import "./styles/prs.css";

render(<App />, document.getElementById("root")!);
