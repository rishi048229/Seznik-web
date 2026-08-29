import React, { useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useNotificationStore } from '@/store/useNotificationStore';
import { NotificationModal } from './NotificationModal';

interface NotificationBellProps {
  size?: number;
  color?: string;
  style?: any;
}

export function NotificationBell({ size = 18, color, style }: NotificationBellProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const theme = useAppTheme();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const iconColor = color || theme.textPrimary;

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={[
          styles.bellBtn,
          {
            backgroundColor: theme.cardBg,
            borderColor: unreadCount > 0 ? 'rgba(239, 68, 68, 0.4)' : theme.borderColor,
          },
          style,
        ]}
        activeOpacity={0.7}
        accessibilityLabel="Notifications"
        accessibilityRole="button"
      >
        <Bell size={size} color={unreadCount > 0 ? '#EF4444' : iconColor} />
        {unreadCount > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <NotificationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
});
