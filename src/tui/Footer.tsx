import React from "react";
import { Box, Text } from "ink";
import { truncateText } from "./text.js";

interface Props {
  connection: "connecting" | "connected" | "reconnecting";
  mode: "normal" | "insert" | "search";
  width: number;
}

export function Footer({ connection, mode, width }: Props) {
  const light = connection === "connected" ? "\u25CF" : "\u25CB";
  const hints =
    mode === "insert"
      ? "Enter: send · Esc: normal"
      : mode === "search"
        ? "Type to search · Enter: done · Esc: clear"
      : "j/k: nav · Enter: open · i: type · /: filter · q: quit";
  const status = truncateText(`${light} ${connection}`, width);
  const separator = width > status.length + 3 ? "  ·  " : "";
  const hintWidth = Math.max(0, width - status.length - separator.length);
  const visibleHints = truncateText(hints, hintWidth);

  return (
    <Box width={width} overflow="hidden">
      <Text color={connection === "connected" ? "green" : "yellow"}>{status}</Text>
      {visibleHints ? <Text color="gray">{separator}{visibleHints}</Text> : null}
    </Box>
  );
}
