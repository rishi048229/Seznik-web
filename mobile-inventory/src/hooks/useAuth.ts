import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { LoginPayload, RegisterPayload } from '@/types/auth';

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
      await setAuth(data.token, data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: async (data) => {
      await setAuth(data.token, data.user);
      queryClient.setQueryData(['auth', 'profile'], data.user);
    },
  });

  const sendEmailOtpMutation = useMutation({
    mutationFn: (email: string) => authApi.sendEmailOtp(email),
  });

  const verifyEmailOtpMutation = useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      authApi.verifyEmailOtp(email, otp),
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
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    sendEmailOtp: sendEmailOtpMutation.mutateAsync,
    verifyEmailOtp: verifyEmailOtpMutation.mutateAsync,
    sendForgotPasswordOtp: sendForgotPasswordOtpMutation.mutateAsync,
    verifyForgotPasswordOtp: verifyForgotPasswordOtpMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    logout: handleLogout,
    refetchProfile: profileQuery.refetch,
    hasPermission: useAuthStore.getState().hasPermission,
  };
}
