import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  mode: "normal" | "insert";
  value: string;
  sendError: string | null;
  onChange(v: string): void;
  onSubmit(): void;
}

export function Input({ mode, value, sendError, onChange, onSubmit }: Props) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">{">"} </Text>
        {mode === "insert" ? (
          <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
        ) : (
          <Text color="gray">press i to type</Text>
        )}
      </Box>
      {sendError ? <Text color="red">! {sendError}</Text> : null}
    </Box>
  );
}
