import type { ImageProtocol } from "../config/config.js";

export type RenderProtocol = Exclude<ImageProtocol, "auto">;

export function resolveProtocol(
  choice: ImageProtocol,
  env: NodeJS.ProcessEnv,
): RenderProtocol {
  if (choice !== "auto") return choice;
  if (env.TERM_PROGRAM === "iTerm.app") return "iterm";
  if (env.TERM === "xterm-kitty" || env.KITTY_WINDOW_ID) return "kitty";
  return "halfblock";
}

export function resolveProtocolForInk(
  choice: ImageProtocol,
  env: NodeJS.ProcessEnv,
): RenderProtocol {
  const protocol = resolveProtocol(choice, env);
  return protocol === "iterm" || protocol === "kitty" ? "halfblock" : protocol;
}
