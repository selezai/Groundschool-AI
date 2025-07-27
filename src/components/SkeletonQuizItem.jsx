import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Skeleton loading component for quiz items
 * Displays a placeholder UI while quiz data is being loaded
 */
const SkeletonQuizItem = () => (
  <View style={styles.quizItem}>
    <View style={styles.quizInfo}>
      <View style={[styles.skeletonLine, styles.titleSkeleton]} />
      <View style={[styles.skeletonLine, styles.detailsSkeleton]} />
    </View>
    <View style={styles.quizActions}>
      <View style={styles.startButtonSkeleton} />
      <View style={styles.deleteButtonSkeleton} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  quizItem: {
    backgroundColor: '#191E38', // Card background
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A5568', // Muted border
  },
  quizInfo: {
    flex: 1,
    marginRight: 16,
  },
  skeletonLine: {
    backgroundColor: '#4A5568', // Muted/borders
    borderRadius: 4,
    overflow: 'hidden',
  },
  titleSkeleton: {
    width: '80%',
    height: 20,
    marginBottom: 8,
  },
  detailsSkeleton: {
    width: '60%',
    height: 16,
  },
  quizActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButtonSkeleton: {
    width: 70,
    height: 36,
    backgroundColor: '#4A5568', // Muted/borders
    borderRadius: 6,
    marginRight: 12,
  },
  deleteButtonSkeleton: {
    width: 32,
    height: 32,
    backgroundColor: '#4A5568', // Muted/borders
    borderRadius: 16,
    opacity: 0.5,
  },
});

export default SkeletonQuizItem;
