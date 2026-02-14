/**
 * AsyncStorage 统一层 - 用于 Zustand persist middleware
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

/**
 * Zustand persist 所需的 StateStorage 适配器
 */
export const zustandMMKVStorage: StateStorage = {
  getItem: async (name: string) => {
    const value = await AsyncStorage.getItem(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string) => {
    await AsyncStorage.removeItem(name);
  },
};
