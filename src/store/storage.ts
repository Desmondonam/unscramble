import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Shared persistent storage for Zustand stores (AsyncStorage on native, IndexedDB/localStorage on web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
