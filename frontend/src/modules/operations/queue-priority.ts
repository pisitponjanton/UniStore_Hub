/** Pure loaded-page queue ordering. Does not change backend filters, cursors or statuses. */
export function prioritizeLoadedQueue<T>(
  rows: readonly T[],
  isActionable: (item: T) => boolean,
  updatedAt: (item: T) => string,
): T[] {
  return [...rows].sort((a, b) =>
    Number(isActionable(b)) - Number(isActionable(a))
    || (Date.parse(updatedAt(b)) || 0) - (Date.parse(updatedAt(a)) || 0),
  );
}

/** Local switch is explicitly limited to records already fetched. */
export function visibleLoadedQueue<T>(
  rows: readonly T[],
  mode: "all" | "action",
  isActionable: (item: T) => boolean,
): T[] {
  return mode === "action" ? rows.filter(isActionable) : [...rows];
}
