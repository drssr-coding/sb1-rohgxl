import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore';
import { useState, useCallback, useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { toFirestoreTimestamp } from '../utils/dateUtils';
import type { Party } from '../types';

export const useParties = () => {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Set up real-time listener for parties
  useEffect(() => {
    if (!user) {
      setParties([]);
      return;
    }

    setLoading(true);
    
    // Create query for parties where user is a participant
    const q = query(
      collection(db, 'parties'),
      where('participants', 'array-contains', {
        id: user.uid,
        name: user.displayName || 'Anonymous',
        avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Anonymous')}`
      })
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedParties = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date
        })) as Party[];

        // Sort parties by date, most recent first
        fetchedParties.sort((a, b) => b.date.seconds - a.date.seconds);
        
        setParties(fetchedParties);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching parties:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch parties');
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user]);

  const fetchParties = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'parties'),
        where('participants', 'array-contains', {
          id: user.uid,
          name: user.displayName || 'Anonymous',
          avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Anonymous')}`
        })
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedParties = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date
      })) as Party[];

      fetchedParties.sort((a, b) => b.date.seconds - a.date.seconds);
      setParties(fetchedParties);
    } catch (err) {
      console.error('Error fetching parties:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch parties');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createParty = useCallback(async (partyData: { title: string; date: Date; location: string }) => {
    if (!user) {
      setError('You must be logged in to create a party');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const newParty = {
        title: partyData.title,
        date: toFirestoreTimestamp(partyData.date),
        location: partyData.location,
        organizerId: user.uid,
        organizer: user.displayName || user.email || 'Anonymous',
        participants: [{
          id: user.uid,
          name: user.displayName || 'Anonymous',
          avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'Anonymous')}`
        }],
        items: [],
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'parties'), newParty);
      const createdParty = { ...newParty, id: docRef.id } as Party;
      return createdParty;
    } catch (err) {
      console.error('Error creating party:', err);
      setError(err instanceof Error ? err.message : 'Failed to create party');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateParty = useCallback(async (partyId: string, partyData: Partial<Party>) => {
    if (!user) return null;

    try {
      await updateDoc(doc(db, 'parties', partyId), partyData);
      return true;
    } catch (err) {
      console.error('Error updating party:', err);
      return false;
    }
  }, [user]);

  return {
    parties,
    loading,
    error,
    createParty,
    updateParty,
    fetchParties,
  };
};