import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MoreMenuModal } from '@/components/ui/MoreMenuModal';

export default function MoreTabScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <MoreMenuModal
        visible={true}
        onClose={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/' as any);
          }
        }}
      />
    </View>
  );
}
