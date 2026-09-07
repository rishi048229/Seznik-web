/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { loginUser, registerUser, getUserProfile, signOutUser, setUserRoleAndProfile, completeOnboarding, updateBusinessType, redeemAccessCode as redeemAccessCodeApi } from '@/services/authService'
import type { UserProfile, UserRole, UserPermissions, CompleteOnboardingPayload, BusinessType } from '@/types/auth.types'
import { getAuthToken } from '@/services/api'

interface AuthContextType {
  user: UserProfile | null
  userProfile: UserProfile | null
  loading: boolean
  hasSelectedWorkspace: boolean
  loginWithEmail: (email: string, pass: string) => Promise<void>
  registerWithEmail: (
    email: string,
    pass: string,
    fName: string,
    lName: string,
    phone: string,
    hasSeznikPrinter?: boolean,
    accessCode?: string
  ) => Promise<void>
  redeemAccessCode: (code: string) => Promise<void>
  signOut: () => Promise<void>
  setUserRole: (role: UserRole, name: string, password: string, agentUid?: string) => Promise<void>
  completeOnboarding: (payload: CompleteOnboardingPayload) => Promise<void>
  updateBusinessType: (businessType: BusinessType) => Promise<void>
  clearWorkspaceSelection: () => void
  hasRole: () => boolean
  permissions: UserPermissions | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null)

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasSelectedWorkspace, setHasSelectedWorkspace] = useState<boolean>(() => {
    return localStorage.getItem('hasSelectedWorkspace') === 'true'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken()
      if (token) {
        try {
          const profile = await getUserProfile()
          const isWorkspaceSelected = localStorage.getItem('hasSelectedWorkspace') === 'true'

          if (!isWorkspaceSelected) {
            setUser(profile)
            setUserProfile(profile ? { ...profile, role: null } : null)
            setHasSelectedWorkspace(false)
          } else {
            setUser(profile)
            setUserProfile(profile)
            setHasSelectedWorkspace(true)
          }
        } catch (error) {
          console.error("Auth init failed", error)
          setUser(null)
          setUserProfile(null)
          setHasSelectedWorkspace(false)
          localStorage.removeItem('hasSelectedWorkspace')
        }
      } else {
        setUser(null)
        setUserProfile(null)
        setHasSelectedWorkspace(false)
        localStorage.removeItem('hasSelectedWorkspace')
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const clearTransientStorage = () => {
    try {
      localStorage.removeItem('hasSelectedWorkspace')
      localStorage.removeItem('pos_cart')
      localStorage.removeItem('pos_lite_cart')
      localStorage.removeItem('pos_lite_recent_items')
      localStorage.removeItem('pos_lite_last_bill')
      localStorage.removeItem('pos_cart_guest')
      localStorage.removeItem('pos_lite_cart_guest')
      localStorage.removeItem('pos_selected_location_id')
    } catch {
      // ignore
    }
  }

  const handleLogin = async (email: string, pass: string) => {
    clearTransientStorage()
    const data = await loginUser(email, pass)
    setUser(data.user)
    setHasSelectedWorkspace(false)
    setUserProfile(data.user ? { ...data.user, role: null } : null)
  }
  
  const handleRegister = async (
    email: string,
    pass: string,
    fName: string,
    lName: string,
    phone: string,
    hasSeznikPrinter?: boolean,
    accessCode?: string
  ) => {
    clearTransientStorage()
    const data = await registerUser(email, pass, fName, lName, phone, hasSeznikPrinter, accessCode)
    setUser(data.user)
    setHasSelectedWorkspace(false)
    setUserProfile(data.user ? { ...data.user, role: null } : null)
  }

  const handleRedeemAccessCode = async (code: string) => {
    if (!user) throw new Error('No user logged in')
    const res = await redeemAccessCodeApi(code)
    if (res?.user) {
      const updatedProfile = await getUserProfile()
      const next = updatedProfile ?? { ...user, ...res.user, seznikUser: true }
      setUser(next)
      setUserProfile(prev => prev ? { ...prev, ...res.user, seznikUser: true } : next)
    }
  }

  const handleSignOut = async () => {
    clearTransientStorage()
    setHasSelectedWorkspace(false)
    await signOutUser()
    setUser(null)
    setUserProfile(null)
  }

  const handleSetUserRole = async (role: UserRole, name: string, password: string, agentUid?: string) => {
    if (!user) throw new Error('No user logged in')
    const res = await setUserRoleAndProfile(user.id || user.uid, role, name, password, agentUid)
    const updatedProfile = res?.user || await getUserProfile()
    setUser(updatedProfile)
    setUserProfile(updatedProfile ? { ...updatedProfile, role } : null)
    setHasSelectedWorkspace(true)
    localStorage.setItem('hasSelectedWorkspace', 'true')
  }

  const handleCompleteOnboarding = async (payload: CompleteOnboardingPayload) => {
    if (!user) throw new Error('No user logged in')
    const updated = await completeOnboarding(payload)
    const updatedProfile = await getUserProfile()
    const nextProfile = updatedProfile ?? { ...user, ...updated, onboardingCompleted: true }
    setUser(nextProfile)
    setUserProfile(nextProfile)
  }

  const handleUpdateBusinessType = async (businessType: BusinessType) => {
    if (!user) throw new Error('No user logged in')
    const previousType = userProfile?.businessType ?? user.businessType
    setUserProfile((prev) => (prev ? { ...prev, businessType } : prev))
    setUser((prev) => (prev ? { ...prev, businessType } : prev))
    try {
      const updated = await updateBusinessType(businessType)
      const updatedProfile = await getUserProfile()
      const nextProfile = updatedProfile ?? { ...user, ...updated, businessType }
      setUser(nextProfile)
      setUserProfile((prev) => (prev ? { ...nextProfile, role: prev.role } : nextProfile))
    } catch (error) {
      setUserProfile((prev) => (prev ? { ...prev, businessType: previousType } : prev))
      setUser((prev) => (prev ? { ...prev, businessType: previousType } : prev))
      throw error
    }
  }

  const handleClearWorkspaceSelection = () => {
    setHasSelectedWorkspace(false)
    localStorage.removeItem('hasSelectedWorkspace')
    setUserProfile(prev => prev ? { ...prev, role: null } : null)
  }

  const hasRole = (): boolean => {
    return !!userProfile?.role && hasSelectedWorkspace
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        hasSelectedWorkspace,
        loginWithEmail: handleLogin,
        registerWithEmail: handleRegister,
        redeemAccessCode: handleRedeemAccessCode,
        signOut: handleSignOut,
        setUserRole: handleSetUserRole,
        completeOnboarding: handleCompleteOnboarding,
        updateBusinessType: handleUpdateBusinessType,
        clearWorkspaceSelection: handleClearWorkspaceSelection,
        hasRole,
        permissions: userProfile?.permissions || null,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
