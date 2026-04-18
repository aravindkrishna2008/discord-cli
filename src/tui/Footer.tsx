import React from "react";
import { Box, Text } from "ink";

interface Props {
  connection: "connecting" | "connected" | "reconnecting";
  mode: "normal" | "insert";
}

export function Footer({ connection, mode }: Props) {
  const light = connection === "connected" ? "\u25CF" : "\u25CB";
  const hints =
    mode === "insert"
      ? "Enter: send · Esc: normal"
      : "j/k: nav · Enter: open · i: type · /: filter · q: quit";
  return (
    <Box>
      <Text color={connection === "connected" ? "green" : "yellow"}>
        {light} {connection}
      </Text>
      <Text color="gray">  ·  {hints}</Text>
    </Box>
  );
}
