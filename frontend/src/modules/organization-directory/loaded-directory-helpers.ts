/** Local, already-loaded directory search. Never claims to search unseen API cursor pages. */
export function searchLoadedItems<T>(
  items: readonly T[],
  query: string,
  tokensFor: (item: T) => readonly (string | null | undefined)[],
): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  if (!terms.length) return [...items];
  return items.filter((item) => {
    const haystack = tokensFor(item).filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

export function visibleLoadedItems<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, Math.max(0, limit));
}
