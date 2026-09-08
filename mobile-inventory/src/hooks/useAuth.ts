import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { CompleteOnboardingPayload, LoginPayload, RegisterPayload } from '@/types/auth';
import { setCachedTrackStockSetting } from '@/hooks/useSettings';

export function useAuth() {
  const queryClient = useQueryClient();
  const { user, token, isAuthenticated, isLoading, setAuth, logout, updateUser } = useAuthStore();

  const profileQuery = useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: authApi.getProfile,
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: async (data) => {
      queryClient.clear();
      await setAuth(data.token, data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const qrLoginMutation = useMutation({
    mutationFn: (code: string) => authApi.loginWithQr(code),
    onSuccess: async (data) => {
      queryClient.clear();
      await setAuth(data.token, data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: async (data) => {
      queryClient.clear();
      await setAuth(data.token, data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const sendEmailOtpMutation = useMutation({
    mutationFn: (email: string) => authApi.sendEmailOtp(email),
  });

  const verifyAccessCodeMutation = useMutation({
    mutationFn: (code: string) => authApi.verifyAccessCode(code),
  });

  const verifyEmailOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      authApi.verifyEmailOtp(email, otp),
  });

  const sendPhoneOtpMutation = useMutation({
    mutationFn: (phone: string) => authApi.sendPhoneOtp(phone),
  });

  const verifyPhoneOtpMutation = useMutation({
    mutationFn: ({ phone, otp }: { phone: string; otp: string }) =>
      authApi.verifyPhoneOtp(phone, otp),
  });

  const sendForgotPasswordOtpMutation = useMutation({
    mutationFn: (email: string) => authApi.sendForgotPasswordOtp(email),
  });

  const verifyForgotPasswordOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      authApi.verifyForgotPasswordOtp(email, otp),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ email, newPassword }: { email: string; newPassword: string }) =>
      authApi.resetPasswordWithOtp(email, newPassword),
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: (payload: CompleteOnboardingPayload) => authApi.completeOnboarding(payload),
    onSuccess: async (profile) => {
      await updateUser({
        ...profile,
        onboardingCompleted: true,
      });
      queryClient.setQueryData(['auth', 'profile'], profile);
    },
  });

  const updateBusinessTypeMutation = useMutation({
    mutationFn: (businessType: CompleteOnboardingPayload['businessType']) =>
      authApi.updateBusinessType(businessType),
    onSuccess: async (profile) => {
      await updateUser(profile);
      queryClient.setQueryData(['auth', 'profile'], profile);
      setCachedTrackStockSetting(profile?.businessType === 'restaurant_cafe' ? false : true);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['kot-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  const handleLogout = async () => {
    queryClient.clear();
    await logout();
  };

  return {
    user: profileQuery.data || user,
    token,
    isAuthenticated,
    isLoading: isLoading || (!!token && profileQuery.isLoading),
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    loginWithQr: qrLoginMutation.mutateAsync,
    isLoggingInWithQr: qrLoginMutation.isPending,
    qrLoginError: qrLoginMutation.error,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    sendEmailOtp: sendEmailOtpMutation.mutateAsync,
    sendPhoneOtp: sendPhoneOtpMutation.mutateAsync,
    isSendingPhoneOtp: sendPhoneOtpMutation.isPending,
    verifyPhoneOtp: verifyPhoneOtpMutation.mutateAsync,
    isVerifyingPhoneOtp: verifyPhoneOtpMutation.isPending,
    verifyAccessCode: verifyAccessCodeMutation.mutateAsync,
    isVerifyingAccessCode: verifyAccessCodeMutation.isPending,
    verifyEmailOtp: verifyEmailOtpMutation.mutateAsync,
    sendForgotPasswordOtp: sendForgotPasswordOtpMutation.mutateAsync,
    verifyForgotPasswordOtp: verifyForgotPasswordOtpMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    completeOnboarding: completeOnboardingMutation.mutateAsync,
    isCompletingOnboarding: completeOnboardingMutation.isPending,
    updateBusinessType: updateBusinessTypeMutation.mutateAsync,
    isUpdatingBusinessType: updateBusinessTypeMutation.isPending,
    logout: handleLogout,
    refetchProfile: profileQuery.refetch,
    hasPermission: useAuthStore.getState().hasPermission,
  };
}
