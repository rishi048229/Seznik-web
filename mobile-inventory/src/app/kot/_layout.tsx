import { Redirect, Slot } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { isNavFeatureVisible } from '@/utils/businessFeatures';

export default function KotLayout() {
  const { user, hasPermission } = useAuth();
  const allowed =
    isNavFeatureVisible(user?.businessType, 'kot') && hasPermission('canAccessKOT');

  if (!allowed) {
    return <Redirect href="/(tabs)" />;
  }

  return <Slot />;
}
