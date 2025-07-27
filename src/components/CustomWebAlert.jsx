import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';

const CustomWebAlert = ({ visible, title, message, buttons, onClose }) => {
  if (Platform.OS !== 'web' || !visible) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose} // For Android back button
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonContainer}>
            {buttons && buttons.map((button, index) => (
              <Pressable
                key={index}
                style={[styles.button, button.style === 'destructive' ? styles.destructiveButton : styles.defaultButton]}
                onPress={() => {
                  if (button.onPress) button.onPress();
                  onClose(); // Always close after button press
                }}
              >
                <Text style={[styles.buttonText, button.style === 'destructive' ? styles.destructiveButtonText : styles.defaultButtonText]}>
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay for better dimming
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: '#191E38', // Card background
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#4A5568', // Muted border, removed shadow for dark theme
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF', // Primary text color
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#A0AEC0', // Secondary text color
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  defaultButton: {
    backgroundColor: '#8dffd6', // Accent color
  },
  destructiveButton: {
    backgroundColor: '#CC2936', // Darker, suitable red for dark themes
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  defaultButtonText: {
    color: '#0a0e23', // Contrasting text for new accent
  },
  destructiveButtonText: {
    color: 'white',
  },
});

export default CustomWebAlert;
