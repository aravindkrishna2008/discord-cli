const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const PACIFIC_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function getPacificParts(timestamp: number) {
  const parts = PACIFIC_TIMESTAMP_FORMATTER.formatToParts(new Date(timestamp));
  return {
    year: getPart(parts, "year"),
    month: getPart(parts, "month"),
    day: getPart(parts, "day"),
    hour: getPart(parts, "hour"),
    minute: getPart(parts, "minute"),
  };
}

export function formatPacificTimestamp(timestamp: number): string {
  const parts = getPacificParts(timestamp);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatPacificClockTime(timestamp: number): string {
  const parts = getPacificParts(timestamp);
  return `${parts.hour}:${parts.minute}`;
}
