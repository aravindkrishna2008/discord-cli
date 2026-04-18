import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { truncateText } from "./text.js";

interface Props {
  mode: "normal" | "insert" | "search";
  value: string;
  sendError: string | null;
  width: number;
  onChange(v: string): void;
  onSubmit(): void;
}

export function Input({ mode, value, sendError, width, onChange, onSubmit }: Props) {
  return (
    <Box flexDirection="column" width={width} overflow="hidden">
      <Box width={width} overflow="hidden">
        <Text color="gray">{">"} </Text>
        {mode === "insert" ? (
          <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
        ) : (
          <Text color="gray">{truncateText("press i to type", Math.max(1, width - 2))}</Text>
        )}
      </Box>
      {sendError ? <Text color="red">! {truncateText(sendError, Math.max(1, width - 2))}</Text> : null}
    </Box>
  );
}
