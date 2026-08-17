import { create } from 'zustand';
import { RateTile } from '../types';
import * as db from '../services/db';

interface RateTileState {
  tiles: RateTile[];
  isLoading: boolean;

  loadTiles: () => Promise<void>;
  addTile: (tile: RateTile) => Promise<void>;
  updateTile: (tile: RateTile) => Promise<void>;
  deleteTile: (id: string) => Promise<void>;
  reorderTiles: (tiles: RateTile[]) => Promise<void>;
}

export const useRateTileStore = create<RateTileState>((set, get) => ({
  tiles: [],
  isLoading: false,

  loadTiles: async () => {
    set({ isLoading: true });
    try {
      const tiles = await db.getRateTiles();
      set({ tiles, isLoading: false });
    } catch (_e) {
      set({ isLoading: false });
    }
  },

  addTile: async (tile) => {
    try {
      await db.saveRateTile(tile);
      await get().loadTiles();
    } catch (_e) {
      // Ignored
    }
  },

  updateTile: async (tile) => {
    try {
      await db.saveRateTile(tile);
      await get().loadTiles();
    } catch (_e) {
      // Ignored
    }
  },

  deleteTile: async (id) => {
    try {
      await db.deleteRateTile(id);
      await get().loadTiles();
    } catch (_e) {
      // Ignored
    }
  },

  reorderTiles: async (tiles) => {
    try {
      await db.saveAllRateTiles(tiles);
      set({ tiles });
    } catch (_e) {
      // Ignored
    }
  },
}));
