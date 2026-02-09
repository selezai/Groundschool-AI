import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../contexts/NetworkContext';

/**
 * NetworkStatusBar component displays the current network status
 * and provides a way to manually sync offline data
 */
const NetworkStatusBar = () => {
  const { isConnected, isSyncing, syncOfflineData } = useNetwork();
  const [syncAttempted, setSyncAttempted] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Handle manual sync when user taps the sync button
  const handleSync = async () => {
    if (!isConnected || isSyncing) return;
    
    setSyncAttempted(true);
    setSyncSuccess(false);
    
    try {
      await syncOfflineData();
      setSyncSuccess(true);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncAttempted(false);
        setSyncSuccess(false);
      }, 3000);
    } catch (error) {
      setSyncSuccess(false);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setSyncAttempted(false);
      }, 3000);
    }
  };

  // Don't show anything if connected and no sync was attempted
  if (isConnected && !syncAttempted && !isSyncing) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      isConnected ? styles.onlineContainer : styles.offlineContainer,
      syncSuccess && styles.successContainer
    ]}>
      {!isConnected && (
        <>
          <Ionicons name="cloud-offline" size={16} color="#FFFFFF" />
          <Text style={styles.statusText}>You're offline. Changes will be saved locally.</Text>
        </>
      )}
      
      {isConnected && isSyncing && (
        <>
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
          <Text style={styles.statusText}>Syncing offline data...</Text>
        </>
      )}
      
      {isConnected && syncAttempted && !isSyncing && (
        <>
          <Ionicons 
            name={syncSuccess ? 'checkmark-circle' : 'alert-circle'} 
            size={16} 
            color="#FFFFFF" 
          />
          <Text style={styles.statusText}>
            {syncSuccess ? 'Sync completed successfully!' : 'Sync failed. Try again.'}
          </Text>
        </>
      )}
      
      {isConnected && !isSyncing && (
        <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
          <Ionicons name="sync" size={16} color="#FFFFFF" />
          <Text style={styles.syncText}>Sync now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineContainer: {
    backgroundColor: '#EF4444',
  },
  onlineContainer: {
    backgroundColor: '#3B82F6',
  },
  successContainer: {
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  icon: {
    marginRight: 8,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  syncText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default NetworkStatusBar;
