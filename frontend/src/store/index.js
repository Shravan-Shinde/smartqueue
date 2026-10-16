import { configureStore, createSlice } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';

/**
 * SmartQueue Redux Store
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: false,
    activeTab: 'overview',
  },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, setActiveTab } = uiSlice.actions;

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer,
    auth: authReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
