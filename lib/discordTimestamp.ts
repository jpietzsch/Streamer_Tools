import { DateTime } from "luxon";

export type DiscordTimestampStyle =
  | "t"
  | "T"
  | "d"
  | "D"
  | "f"
  | "F"
  | "R";

export function createDiscordTimestamp(
  date: string,
  time: string,
  timezone: string,
  style: DiscordTimestampStyle = "F",
): string | null {
  if (!date || !time || !timezone) {
    return null;
  }

  const dateTime = DateTime.fromISO(`${date}T${time}`, {
    zone: timezone,
  });

  if (!dateTime.isValid) {
    return null;
  }

  const unixSeconds = Math.floor(dateTime.toSeconds());

  return `<t:${unixSeconds}:${style}>`;
}

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
