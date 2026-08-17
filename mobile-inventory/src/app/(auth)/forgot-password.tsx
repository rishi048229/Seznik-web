import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { ArrowLeft, KeyRound, Mail, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const {
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPassword,
  } = useAuth();

  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await sendForgotPasswordOtp(email.trim());
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
      }
      setStep('otp');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP email');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length < 4) {
      setErrorMsg('Please enter a valid OTP code');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await verifyForgotPasswordOtp({ email: email.trim(), otp: otp.trim() });
      setStep('reset');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await resetPassword({ email: email.trim(), newPassword });
      Alert.alert('Success', 'Password updated successfully!', [
        { text: 'Login', onPress: () => router.replace('/(auth)/login' as any) },
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-6"
          >
            <ArrowLeft size={20} color="#64748B" />
            <Text className="text-slate-600 dark:text-slate-400 font-medium ml-2 text-sm">
              Back to Login
            </Text>
          </TouchableOpacity>

          <View className="items-center mb-8">
            <View className="w-14 h-14 rounded-2xl bg-sky-500/10 items-center justify-center mb-3">
              <KeyRound size={28} color="#0284C7" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">
              Reset Password
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">
              {step === 'email'
                ? 'Enter your account email to receive an OTP'
                : step === 'otp'
                ? `Verification code sent to ${email}`
                : 'Choose a new password for your account'}
            </Text>
          </View>

          <View className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            {errorMsg ? (
              <View className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl p-3.5 mb-5">
                <Text className="text-red-700 dark:text-red-300 text-xs font-medium">
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {devOtpHint ? (
              <View className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3.5 mb-5">
                <Text className="text-amber-800 dark:text-amber-200 text-xs font-medium">
                  🔑 Dev Code: {devOtpHint}
                </Text>
              </View>
            ) : null}

            {step === 'email' && (
              <View>
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Email Address
                </Text>
                <View className="flex-row items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-3 mb-6">
                  <Mail size={18} color="#64748B" />
                  <TextInput
                    className="flex-1 ml-3 text-slate-900 dark:text-white text-base"
                    placeholder="store@seznik.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={loading}
                  className="bg-blue-600 active:bg-blue-700 rounded-xl py-3.5 flex-row justify-center items-center"
                >
                  {loading && <ActivityIndicator color="#FFF" className="mr-2" />}
                  <Text className="text-white font-semibold text-base">Send OTP</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'otp' && (
              <View>
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Verification Code
                </Text>
                <TextInput
                  className="border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-3.5 text-slate-900 dark:text-white text-xl font-bold tracking-widest text-center mb-6"
                  placeholder="123456"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                />
                <TouchableOpacity
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  className="bg-blue-600 active:bg-blue-700 rounded-xl py-3.5 flex-row justify-center items-center"
                >
                  {loading && <ActivityIndicator color="#FFF" className="mr-2" />}
                  <Text className="text-white font-semibold text-base">Verify Code</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'reset' && (
              <View>
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  New Password
                </Text>
                <View className="flex-row items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-3 mb-4">
                  <Lock size={18} color="#64748B" />
                  <TextInput
                    className="flex-1 ml-3 text-slate-900 dark:text-white text-base"
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </Text>
                <View className="flex-row items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-3 mb-6">
                  <Lock size={18} color="#64748B" />
                  <TextInput
                    className="flex-1 ml-3 text-slate-900 dark:text-white text-base"
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={loading}
                  className="bg-blue-600 active:bg-blue-700 rounded-xl py-3.5 flex-row justify-center items-center"
                >
                  {loading && <ActivityIndicator color="#FFF" className="mr-2" />}
                  <Text className="text-white font-semibold text-base">Update Password</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
