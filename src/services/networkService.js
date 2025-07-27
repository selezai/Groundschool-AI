// src/services/networkService.js
import NetInfo from '@react-native-community/netinfo';
import logger from './loggerService'; // Assuming loggerService is in the same directory

const NetworkService = {
  isNetworkAvailable: async () => {
    try {
      const state = await NetInfo.fetch();
      if (state === null || typeof state.isConnected === 'undefined') {
        // This might happen if NetInfo.fetch() resolves but with unexpected data
        logger.warn('NetworkService:isNetworkAvailable', 'NetInfo.fetch() returned null or undefined isConnected state. Assuming no connection as a fallback.', { state });
        return false;
      }
      logger.debug('NetworkService:isNetworkAvailable', 'Network state fetched', { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable });
      return state.isConnected && state.isInternetReachable;
    } catch (error) {
      logger.error('NetworkService:isNetworkAvailable', 'Error fetching network state', error);
      // Fallback to false in case of any error to prevent app from assuming online status
      return false; 
    }
  },

  // Optional: Add a listener for network status changes if needed elsewhere
  subscribe: (listener) => {
    try {
      const unsubscribe = NetInfo.addEventListener(state => {
        logger.debug('NetworkService:subscribe', 'Network state changed', { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable });
        listener(state.isConnected && state.isInternetReachable);
      });
      return unsubscribe;
    } catch (error) {
      logger.error('NetworkService:subscribe', 'Error adding network state listener', error);
      return () => {}; // Return a no-op unsubscribe function
    }
  }
};

export default NetworkService;
