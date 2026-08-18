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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, Server, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { getApiBaseUrl, setApiBaseUrl } from '@/api/client';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState(getApiBaseUrl());

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setApiError(null);
    try {
      await login(data);
      // Auth state change in useAuthStore will trigger root layout redirect
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please check your credentials.';
      setApiError(msg);
    }
  };

  const handleSaveApiUrl = () => {
    if (baseUrlInput.trim()) {
      setApiBaseUrl(baseUrlInput);
      setShowApiConfig(false);
      Alert.alert('API URL Updated', `API Base URL set to: ${getApiBaseUrl()}`);
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
          {/* Header & Branding */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
              <ShieldCheck size={36} color="#FFFFFF" />
            </View>
            <Text className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Seznik <Text className="text-sky-500">POS</Text>
            </Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Mobile Companion & Checkout
            </Text>
          </View>

          {/* Form Card */}
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800">
            <Text className="text-xl font-bold text-slate-900 dark:text-white mb-6">
              Welcome back
            </Text>

            {/* Error Message */}
            {apiError ? (
              <View className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded-xl p-3.5 mb-5">
                <Text className="text-red-700 dark:text-red-300 text-xs font-medium">
                  {apiError}
                </Text>
              </View>
            ) : null}

            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="flex-row items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-3">
                    <Mail size={18} color="#64748B" />
                    <TextInput
                      className="flex-1 ml-3 text-slate-900 dark:text-white text-base"
                      placeholder="store@seznik.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.email ? (
                <Text className="text-red-500 text-xs mt-1 font-medium">
                  {errors.email.message}
                </Text>
              ) : null}
            </View>

            {/* Password Field */}
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password' as any)}
                >
                  <Text className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                    Forgot?
                  </Text>
                </TouchableOpacity>
              </View>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="flex-row items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-3">
                    <Lock size={18} color="#64748B" />
                    <TextInput
                      className="flex-1 ml-3 text-slate-900 dark:text-white text-base"
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <EyeOff size={18} color="#64748B" />
                      ) : (
                        <Eye size={18} color="#64748B" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.password ? (
                <Text className="text-red-500 text-xs mt-1 font-medium">
                  {errors.password.message}
                </Text>
              ) : null}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              className={`rounded-xl py-3.5 flex-row justify-center items-center ${
                isLoggingIn ? 'bg-blue-400' : 'bg-blue-600 active:bg-blue-700'
              }`}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#FFFFFF" className="mr-2" />
              ) : null}
              <Text className="text-white font-semibold text-base">
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dev API Server Config Toggle */}
          <View className="mt-8 items-center">
            <TouchableOpacity
              onPress={() => setShowApiConfig(!showApiConfig)}
              className="flex-row items-center space-x-1 py-2 px-3"
            >
              <Server size={14} color="#64748B" />
              <Text className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 font-medium">
                Server API URL: {getApiBaseUrl()}
              </Text>
            </TouchableOpacity>

            {showApiConfig ? (
              <View className="w-full mt-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <Text className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Configure Dev API Base URL
                </Text>
                <TextInput
                  className="border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 mb-3"
                  value={baseUrlInput}
                  onChangeText={setBaseUrlInput}
                  placeholder="e.g. http://192.168.1.10:5000/api"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={handleSaveApiUrl}
                  className="bg-slate-800 dark:bg-slate-700 rounded-lg py-2 items-center"
                >
                  <Text className="text-white text-xs font-semibold">Save Base URL</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
