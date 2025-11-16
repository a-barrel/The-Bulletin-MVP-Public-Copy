export const EMPTY_BOOKMARK_GROUP = 'Unsorted';

export function formatBookmarkSavedDate(value) {
  if (!value) {
    return 'Unknown date';
  }
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function groupBookmarksByCollection(bookmarks, collectionsById = new Map()) {
  const groups = new Map();
  bookmarks.forEach((bookmark) => {
    const collectionId = bookmark.collectionId || null;
    const collectionName = collectionsById.get(collectionId)?.name ?? EMPTY_BOOKMARK_GROUP;
    if (!groups.has(collectionName)) {
      groups.set(collectionName, []);
    }
    groups.get(collectionName).push(bookmark);
  });
  return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
}
