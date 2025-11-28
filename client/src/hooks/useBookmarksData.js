import { useAuthState } from 'react-firebase-hooks/auth';
import { useCallback, useEffect, useState } from 'react';
import { fetchBookmarks, fetchBookmarkCollections } from '../api';
import { auth } from '../firebase';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';

export default function useBookmarksData() {
  const { isOffline } = useNetworkStatusContext();
  const [authUser, authLoading] = useAuthState(auth);
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!authUser) {
      setError('Sign in to view your bookmarks.');
      setBookmarks([]);
      setCollections([]);
      return;
    }

    if (isOffline) {
      setIsLoading(false);
      setError('You are offline. Connect to refresh your bookmarks.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [bookmarkPayload, collectionPayload] = await Promise.all([
        fetchBookmarks(),
        fetchBookmarkCollections()
      ]);
      setBookmarks(Array.isArray(bookmarkPayload) ? bookmarkPayload : []);
      setCollections(Array.isArray(collectionPayload) ? collectionPayload : []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      setBookmarks([]);
      setCollections([]);
      setError(err?.message || 'Failed to load bookmarks.');
    } finally {
      setIsLoading(false);
    }
  }, [authUser, isOffline]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!authUser) {
      setBookmarks([]);
      setCollections([]);
      setError('Sign in to view your bookmarks.');
      setIsLoading(false);
      return;
    }
    loadData();
  }, [authLoading, authUser, loadData]);

  return {
    authUser,
    authLoading,
    isOffline,
    bookmarks,
    setBookmarks,
    collections,
    isLoading,
    error,
    reload: loadData,
    setError
  };
}
