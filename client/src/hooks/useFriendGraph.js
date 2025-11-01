import { useCallback, useEffect, useReducer } from 'react';

import {
  fetchFriendOverview,
  removeFriendRelationship,
  respondToFriendRequest,
  sendFriendRequest
} from '../api/mongoDataApi';

const initialState = {
  graph: null,
  isLoading: false,
  status: null,
  requestStatus: null,
  queueStatus: null,
  isProcessing: false
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'graph/pending':
      return {
        ...state,
        isLoading: true,
        status: null
      };
    case 'graph/success':
      return {
        ...state,
        isLoading: false,
        graph: action.payload,
        status: { type: 'success' }
      };
    case 'graph/error':
      return {
        ...state,
        isLoading: false,
        status: { type: 'error', message: action.error }
      };
    case 'request/pending':
      return {
        ...state,
        isProcessing: true,
        requestStatus: null
      };
    case 'request/success':
      return {
        ...state,
        isProcessing: false,
        requestStatus: { type: 'success', message: action.message }
      };
    case 'request/error':
      return {
        ...state,
        isProcessing: false,
        requestStatus: { type: 'error', message: action.error }
      };
    case 'queue/pending':
      return {
        ...state,
        isProcessing: true,
        queueStatus: null
      };
    case 'queue/success':
      return {
        ...state,
        isProcessing: false,
        queueStatus: { type: 'success', message: action.message }
      };
    case 'queue/error':
      return {
        ...state,
        isProcessing: false,
        queueStatus: { type: 'error', message: action.error }
      };
    default:
      return state;
  }
};

const addOptimisticOutgoing = (graph, request) => {
  if (!graph) {
    return graph;
  }
  return {
    ...graph,
    outgoingRequests: [
      {
        id: request.id,
        recipient: request.recipient,
        message: request.message || '',
        createdAt: new Date().toISOString(),
        optimistic: true
      },
      ...(graph.outgoingRequests || [])
    ]
  };
};

export default function useFriendGraph({ autoLoad = true } = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadGraph = useCallback(async () => {
    dispatch({ type: 'graph/pending' });
    try {
      const payload = await fetchFriendOverview();
      dispatch({ type: 'graph/success', payload });
      return payload;
    } catch (error) {
      dispatch({
        type: 'graph/error',
        error: error?.message || 'Failed to load friend overview.'
      });
      throw error;
    }
  }, []);

  const sendRequestAction = useCallback(
    async ({ targetUserId, message }) => {
      if (!targetUserId) {
        const error = new Error('Select a user before sending a request.');
        dispatch({ type: 'request/error', error: error.message });
        throw error;
      }

      const optimisticRequest = {
        id: `optimistic-${Date.now()}`,
        recipient: { id: targetUserId },
        message: message || '',
        optimistic: true
      };

      if (state.graph) {
        dispatch({
          type: 'graph/success',
          payload: addOptimisticOutgoing(state.graph, optimisticRequest)
        });
      }

      dispatch({ type: 'request/pending' });
      try {
        await sendFriendRequest({ targetUserId, message });
        dispatch({
          type: 'request/success',
          message: 'Friend request sent.'
        });
        await loadGraph();
      } catch (error) {
        dispatch({
          type: 'request/error',
          error: error?.message || 'Failed to send friend request.'
        });
        if (state.graph) {
          await loadGraph().catch(() => {});
        }
        throw error;
      }
    },
    [state.graph, loadGraph]
  );

  const respondToRequest = useCallback(
    async ({ requestId, decision }) => {
      if (!requestId || !decision) {
        const error = new Error('Select a request and decision.');
        dispatch({ type: 'queue/error', error: error.message });
        throw error;
      }
      dispatch({ type: 'queue/pending' });
      try {
        await respondToFriendRequest(requestId, decision);
        dispatch({
          type: 'queue/success',
          message: decision === 'accept' ? 'Friend request accepted.' : 'Friend request declined.'
        });
        await loadGraph();
      } catch (error) {
        dispatch({
          type: 'queue/error',
          error: error?.message || 'Failed to update friend request.'
        });
        throw error;
      }
    },
    [loadGraph]
  );

  const removeFriend = useCallback(
    async (friendId) => {
      if (!friendId) {
        const error = new Error('Select a friend to remove.');
        dispatch({ type: 'queue/error', error: error.message });
        throw error;
      }
      dispatch({ type: 'queue/pending' });
      try {
        await removeFriendRelationship(friendId);
        dispatch({
          type: 'queue/success',
          message: 'Friend removed.'
        });
        await loadGraph();
      } catch (error) {
        dispatch({
          type: 'queue/error',
          error: error?.message || 'Failed to remove friend.'
        });
        throw error;
      }
    },
    [loadGraph]
  );

  useEffect(() => {
    if (autoLoad) {
      loadGraph().catch(() => {});
    }
  }, [autoLoad, loadGraph]);

  const graph = state.graph || {
    viewer: null,
    friends: [],
    incomingRequests: [],
    outgoingRequests: []
  };

  return {
    graph,
    refresh: loadGraph,
    isLoading: state.isLoading,
    status: state.status,
    sendFriendRequest: sendRequestAction,
    requestStatus: state.requestStatus,
    respondToRequest,
    queueStatus: state.queueStatus,
    removeFriend,
    isProcessing: state.isProcessing
  };
}
