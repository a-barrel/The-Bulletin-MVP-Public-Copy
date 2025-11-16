import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useChatTabs({
  locationSearch,
  directMessagesHasAccess,
  selectDirectThread,
  refreshDmThreads,
  refreshFriendGraph,
  setLastConversationTab
}) {
  const [channelTab, setChannelTab] = useState('rooms');
  const [channelDialogTab, setChannelDialogTab] = useState('rooms');

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const tabParam = params.get('tab');
    if (tabParam === 'direct') {
      if (directMessagesHasAccess !== false) {
        setChannelTab('direct');
        setChannelDialogTab('direct');
        const threadParam = params.get('thread');
        if (threadParam) {
          selectDirectThread(threadParam);
        }
      } else {
        setChannelTab('rooms');
        setChannelDialogTab('rooms');
      }
      return;
    }

    if (tabParam === 'friends') {
      setChannelTab('friends');
      setChannelDialogTab('friends');
      return;
    }

    setChannelTab('rooms');
    setChannelDialogTab((prev) => (prev === 'direct' ? 'rooms' : prev));
  }, [directMessagesHasAccess, locationSearch, selectDirectThread]);

  useEffect(() => {
    if (channelTab === 'direct') {
      refreshDmThreads?.().catch(() => {});
    }
  }, [channelTab, refreshDmThreads]);

  useEffect(() => {
    if (channelTab === 'friends') {
      refreshFriendGraph?.().catch(() => {});
    }
  }, [channelTab, refreshFriendGraph]);

  useEffect(() => {
    if (channelTab === 'rooms' || channelTab === 'direct') {
      setLastConversationTab?.(channelTab);
    }
  }, [channelTab, setLastConversationTab]);

  const toggleChannelTab = useCallback((tab) => {
    setChannelTab(tab);
  }, []);

  return {
    channelTab,
    channelDialogTab,
    setChannelDialogTab,
    toggleChannelTab
  };
}
