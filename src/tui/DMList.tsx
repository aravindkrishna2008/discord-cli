import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { DM } from "../store/types.js";
import { truncateText } from "./text.js";

interface Props {
  items: DM[];
  selectedId: string | null;
  focused: boolean;
  filter: string;
  searching: boolean;
  onFilterChange(value: string): void;
  onFilterSubmit(): void;
  width: number;
  height: number;
}

export function DMList({
  items,
  selectedId,
  focused,
  filter,
  searching,
  onFilterChange,
  onFilterSubmit,
  width,
  height,
}: Props) {
  const innerWidth = Math.max(1, width - 4);
  const maxItems = Math.max(0, height - 4);
  const visibleItems = getVisibleItems(items, selectedId, maxItems);
  const emptyMessage = filter ? "no matches" : "no DMs";

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={focused ? "single" : "round"}
      paddingX={1}
      overflow="hidden"
    >
      <Text bold>DMs</Text>
      <Box width={innerWidth} overflow="hidden">
        <Text color="gray">/ </Text>
        {searching ? (
          <TextInput value={filter} onChange={onFilterChange} onSubmit={onFilterSubmit} />
        ) : (
          <Text color={filter ? undefined : "gray"}>
            {truncateText(filter || "search by name", Math.max(1, innerWidth - 2))}
          </Text>
        )}
      </Box>
      {visibleItems.map((dm) => {
        const isSelected = dm.id === selectedId;
        const marker = dm.unread ? "\u25CF" : " ";
        const label = dm.isGroup ? `${dm.name} (${dm.memberCount})` : dm.name;
        return (
          <Text
            key={dm.id}
            color={dm.unread ? "yellow" : undefined}
            inverse={isSelected && focused}
          >
            {marker} {truncateText(label, Math.max(1, innerWidth - 2))}
          </Text>
        );
      })}
      {visibleItems.length === 0 && maxItems > 0 ? (
        <Text color="gray">{truncateText(emptyMessage, innerWidth)}</Text>
      ) : null}
    </Box>
  );
}

function getVisibleItems(items: DM[], selectedId: string | null, maxItems: number): DM[] {
  if (maxItems <= 0 || items.length <= maxItems) return items.slice(0, Math.max(0, maxItems));
  const selectedIndex = Math.max(0, items.findIndex((dm) => dm.id === selectedId));
  const start = Math.min(
    Math.max(0, selectedIndex - Math.floor(maxItems / 2)),
    items.length - maxItems,
  );
  return items.slice(start, start + maxItems);
}
