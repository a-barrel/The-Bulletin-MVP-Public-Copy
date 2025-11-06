import { useCallback, useMemo, useState } from 'react';

import useFriendGraph from '../../../hooks/useFriendGraph';
import { fetchUsers } from '../../../api/mongoDataApi';

const INITIAL_REQUEST_FORM = {
  targetUserId: '',
  message: ''
};

const useFriendsTools = () => {
  const {
    graph,
    refresh,
    isLoading,
    status,
    hasAccess,
    sendFriendRequest,
    requestStatus,
    respondToRequest,
    queueStatus,
    removeFriend,
    isProcessing
  } = useFriendGraph();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState(null);
  const [requestForm, setRequestForm] = useState(INITIAL_REQUEST_FORM);

  const handleSearch = useCallback(
    async (term = searchTerm) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchStatus(null);
        return;
      }

      setIsSearching(true);
      setSearchStatus(null);
      try {
        const results = await fetchUsers({ search: trimmed, limit: 15 });
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        setSearchStatus({
          type: 'error',
          message: error?.message || 'Failed to search for users.'
        });
      } finally {
        setIsSearching(false);
      }
    },
    [searchTerm]
  );

  const updateRequestForm = useCallback((field, value) => {
    setRequestForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const submitFriendRequest = useCallback(
    async (overrides = {}) => {
      const payload = {
        ...requestForm,
        ...overrides
      };

      await sendFriendRequest({
        targetUserId: payload.targetUserId,
        message: payload.message?.trim() || ''
      });
      setRequestForm(INITIAL_REQUEST_FORM);
    },
    [requestForm, sendFriendRequest]
  );

  const friends = useMemo(() => graph?.friends || [], [graph]);
  const incomingRequests = useMemo(() => graph?.incomingRequests || [], [graph]);
  const outgoingRequests = useMemo(() => graph?.outgoingRequests || [], [graph]);

  return {
    overview: graph,
    isLoadingOverview: isLoading,
    overviewStatus: status,
    refreshOverview: refresh,
    friends,
    incomingRequests,
    outgoingRequests,
    searchTerm,
    setSearchTerm,
    handleSearch,
    searchResults,
    isSearching,
    searchStatus,
    requestForm,
    updateRequestForm,
    submitFriendRequest,
    requestStatus,
    isSendingRequest: isProcessing,
    respondToRequestQueue: respondToRequest,
    queueStatus,
    removeFriend,
    isUpdatingQueue: isProcessing,
    hasAccess
  };
};

export default useFriendsTools;
