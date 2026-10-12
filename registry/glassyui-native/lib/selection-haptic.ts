import { selectionAsync } from 'expo-haptics';
import { Platform } from 'react-native';

/** Feedback follows a committed selection. Web input does not vibrate. */
export function selectionHaptic(enabled: boolean) {
  if (!enabled || Platform.OS === 'web') return;

  void selectionAsync().catch((error: Error) => {
    console.warn('Glassy UI could not play selection feedback.', error.message);
  });
}
