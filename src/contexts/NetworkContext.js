import React, { createContext, useContext, useState, useEffect } from 'react';
import offlineService from '../services/offlineService';
import logger from '../services/loggerService';

// Create the NetworkContext
const NetworkContext = createContext({
  isConnected: true,
  isInitialized: false,
  syncOfflineData: async () => {},
});

/**
 * NetworkProvider component that manages network connectivity state
 * and provides it to all child components
 */
export const NetworkProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize network state and set up listeners
  useEffect(() => {
    const initializeNetworkState = async () => {
      try {
        // Get initial network state
        const connected = await offlineService.getNetworkStatus();
        setIsConnected(connected);
        setIsInitialized(true);
        
        logger.info('NetworkContext', `Initial network state: ${connected ? 'ONLINE' : 'OFFLINE'}`);
      } catch (error) {
        logger.error('NetworkContext', 'Error initializing network state', error);
        // Default to connected if we can't determine state
        setIsConnected(true);
        setIsInitialized(true);
      }
    };

    initializeNetworkState();

    // Set up network change listener
    const removeListener = offlineService.addNetworkListener((connected) => {
      setIsConnected(connected);
      logger.info('NetworkContext', `Network state changed: ${connected ? 'ONLINE' : 'OFFLINE'}`);
      
      // If connection was restored, attempt to sync offline data
      if (connected) {
        syncOfflineData();
      }
    });

    // Clean up listener on unmount
    return () => {
      removeListener();
    };
  }, []);

  /**
   * Sync offline data with the server
   */
  const syncOfflineData = async () => {
    // Prevent multiple simultaneous syncs
    if (isSyncing || !isConnected) return;
    
    setIsSyncing(true);
    try {
      logger.info('NetworkContext', 'Starting offline data synchronization');
      const result = await offlineService.syncOfflineData();
      logger.info('NetworkContext', 'Offline data synchronization completed', result);
      return result;
    } catch (error) {
      logger.error('NetworkContext', 'Error syncing offline data', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Context value to be provided
  const contextValue = {
    isConnected,
    isInitialized,
    isSyncing,
    syncOfflineData,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * Custom hook to use the NetworkContext
 * @returns {Object} Network context value
 */
export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

export default NetworkContext;
