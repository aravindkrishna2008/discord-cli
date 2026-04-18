import React from "react";
import { Box, Text } from "ink";
import type { DM } from "../store/types.js";

interface Props {
  items: DM[];
  selectedId: string | null;
  focused: boolean;
  filter: string;
}

export function DMList({ items, selectedId, focused, filter }: Props) {
  return (
    <Box flexDirection="column" width={30} borderStyle={focused ? "single" : "round"} paddingX={1}>
      <Text bold>DMs</Text>
      {filter ? <Text color="gray">/{filter}</Text> : null}
      {items.map((dm) => {
        const isSelected = dm.id === selectedId;
        const marker = dm.unread ? "\u25CF" : " ";
        const label = dm.isGroup ? `${dm.name} (${dm.memberCount})` : dm.name;
        return (
          <Text
            key={dm.id}
            color={dm.unread ? "yellow" : undefined}
            inverse={isSelected && focused}
          >
            {marker} {label}
          </Text>
        );
      })}
    </Box>
  );
}
