import { Stack } from '@mui/material';
import { useEffect, useRef } from 'react';
import BookmarkCollectionSection from './BookmarkCollectionSection';

function BookmarkCollectionList({
  groups,
  focusTarget,
  quickNav,
  viewerProfileId,
  removingPinId,
  isOffline,
  formatSavedDate,
  onViewPin,
  onViewAuthor,
  onRemoveBookmark
}) {
  const collectionAnchorsRef = useRef(new Map());
  const focusAppliedRef = useRef(null);

  const registerAnchor = (groupKey, normalizedName, node) => {
    const anchors = collectionAnchorsRef.current;
    const keys = [groupKey, normalizedName, `${groupKey}::header`].filter(Boolean);
    keys.forEach((key) => {
      if (!key) {
        return;
      }
      if (node) {
        anchors.set(key, node);
      } else {
        anchors.delete(key);
      }
    });
  };

  useEffect(() => {
    if (!focusTarget) {
      quickNav.clearHighlight();
      focusAppliedRef.current = null;
      return undefined;
    }

    const focusKey = focusTarget.id ?? '__ungrouped__';
    if (focusAppliedRef.current === focusKey && quickNav.highlightedKey === focusKey) {
      return undefined;
    }

    const possibleKeys = [
      focusKey,
      focusTarget.name?.trim().toLowerCase(),
      `${focusKey}::header`
    ].filter(Boolean);

    const anchors = collectionAnchorsRef.current;
    let targetNode = null;
    for (const key of possibleKeys) {
      const candidate = anchors.get(key);
      if (candidate) {
        targetNode = candidate;
        break;
      }
    }
    if (!targetNode) {
      return undefined;
    }

    focusAppliedRef.current = focusKey;
    quickNav.highlightCollection(focusKey);
    try {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    } catch {
      targetNode.scrollIntoView(true);
    }

    return undefined;
  }, [focusTarget, groups, quickNav]);

  return (
    <Stack spacing={3}>
      {groups.map((group) => {
        const groupKey = group.id ?? '__ungrouped__';
        return (
          <BookmarkCollectionSection
            key={groupKey}
            group={group}
            viewerProfileId={viewerProfileId}
            removingPinId={removingPinId}
            isOffline={isOffline}
            formatSavedDate={formatSavedDate}
            onViewPin={onViewPin}
            onViewAuthor={onViewAuthor}
            onRemoveBookmark={onRemoveBookmark}
            isHighlighted={quickNav.highlightedKey === groupKey}
            isPinned={quickNav.isCollectionPinned(groupKey)}
            onPinToggle={(nextPinned) => quickNav.setCollectionPinned(groupKey, nextPinned)}
            registerAnchor={registerAnchor}
          />
        );
      })}
    </Stack>
  );
}

export default BookmarkCollectionList;
