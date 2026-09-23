/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { loginUser, registerUser, getUserProfile, signOutUser, setUserRoleAndProfile, completeOnboarding, updateBusinessType, redeemAccessCode as redeemAccessCodeApi } from '@/services/authService'
import type { UserProfile, UserRole, UserPermissions, CompleteOnboardingPayload, BusinessType } from '@/types/auth.types'
import { getAuthToken, setAuthToken } from '@/services/api'
import { queryClient } from '@/lib/queryClient'
import { resolveUserPermissions } from '@/utils/permissions'

const withAuthIds = (profile: UserProfile | null | undefined): UserProfile | null => {
  if (!profile) return null
  const id = profile.id || profile.uid
  const uid = profile.uid || profile.id || ''
  return { ...profile, id, uid, permissions: resolveUserPermissions({ ...profile, uid }) || profile.permissions }
}

const isManagedAccount = (profile: UserProfile | null | undefined) =>
  profile?.accountType === 'managed' || Boolean(profile?.adminId && profile.accountType !== 'user')

const OWNER_SESSION_BACKUP_KEY = 'seznik_owner_session_backup'

const saveOwnerSessionBackup = (token: string, profile: UserProfile) => {
  try {
    localStorage.setItem(OWNER_SESSION_BACKUP_KEY, JSON.stringify({ token, user: profile }))
  } catch {
    /* ignore */
  }
}

const loadOwnerSessionBackup = (): { token: string; user: UserProfile } | null => {
  try {
    const raw = localStorage.getItem(OWNER_SESSION_BACKUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.token && parsed?.user) return parsed
  } catch {
    /* ignore */
  }
  return null
}

const clearOwnerSessionBackup = () => {
  try {
    localStorage.removeItem(OWNER_SESSION_BACKUP_KEY)
  } catch {
    /* ignore */
  }
}

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
  adoptSession: (profile: UserProfile) => void
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
          const profile = withAuthIds(await getUserProfile())
          const isWorkspaceSelected = localStorage.getItem('hasSelectedWorkspace') === 'true'

          if (isManagedAccount(profile)) {
            setUser(profile)
            setUserProfile(profile)
            setHasSelectedWorkspace(true)
            localStorage.setItem('hasSelectedWorkspace', 'true')
          } else if (!isWorkspaceSelected) {
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
    const nextUser = withAuthIds(data.user)
    if (!nextUser) return
    setUser(nextUser)
    setHasSelectedWorkspace(true)
    setUserProfile(nextUser.role ? nextUser : { ...nextUser, role: 'admin' })
    localStorage.setItem('hasSelectedWorkspace', 'true')
  }
  
  const adoptSession = (profile: UserProfile) => {
    clearTransientStorage()
    const nextUser = withAuthIds(profile)
    setUser(nextUser)
    setHasSelectedWorkspace(true)
    setUserProfile(nextUser && nextUser.role ? nextUser : nextUser ? { ...nextUser, role: 'admin' } : null)
    localStorage.setItem('hasSelectedWorkspace', 'true')
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

  const handleSetUserRole = async (role: UserRole, name: string, password: string, agentUid?: string) => {
    if (!user) throw new Error('No user logged in')

    const prevToken = getAuthToken()
    const prevUser = user
    const wasOwner = !isManagedAccount(prevUser)

    if (role === 'admin' && isManagedAccount(prevUser)) {
      const backup = loadOwnerSessionBackup()
      if (!backup?.token) {
        throw new Error(
          'No saved Store Owner session in this browser. Log out and sign in with the store owner account, then choose Admin.'
        )
      }
      setAuthToken(backup.token)
      try {
        const res = await setUserRoleAndProfile(
          backup.user.id || backup.user.uid,
          'admin',
          backup.user.displayName || backup.user.email || name,
          password
        )
        clearOwnerSessionBackup()
        const updatedProfile = withAuthIds(res?.user || backup.user)
        setUser(updatedProfile)
        setUserProfile(updatedProfile ? { ...updatedProfile, role: 'admin' } : null)
        setHasSelectedWorkspace(true)
        localStorage.setItem('hasSelectedWorkspace', 'true')
      } catch (err) {
        if (prevToken) setAuthToken(prevToken)
        throw err
      }
      return
    }

    const res = await setUserRoleAndProfile(user.id || user.uid, role, name, password, agentUid)
    const updatedProfile = withAuthIds(res?.user || await getUserProfile())
    if (role === 'agent' && !isManagedAccount(updatedProfile)) {
      throw new Error('Could not switch into the agent account. Pick the agent from the list and try again.')
    }
    if (role === 'agent' && !res?.token) {
      throw new Error('Agent login did not issue a new session. Pick the agent from the list and try again.')
    }
    if (role === 'agent' && wasOwner && prevToken && prevUser) {
      saveOwnerSessionBackup(prevToken, prevUser)
    }
    setUser(updatedProfile)
    setUserProfile(updatedProfile ? { ...updatedProfile, role: updatedProfile.role || role } : null)
    setHasSelectedWorkspace(true)
    localStorage.setItem('hasSelectedWorkspace', 'true')
  }

  const handleClearWorkspaceSelection = () => {
    setHasSelectedWorkspace(false)
    localStorage.removeItem('hasSelectedWorkspace')
    setUserProfile(prev => prev ? { ...prev, role: null } : null)
  }

  const handleSignOut = async () => {
    clearTransientStorage()
    clearOwnerSessionBackup()
    setHasSelectedWorkspace(false)
    await signOutUser()
    setUser(null)
    setUserProfile(null)
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
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['kot-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    } catch (error) {
      setUserProfile((prev) => (prev ? { ...prev, businessType: previousType } : prev))
      setUser((prev) => (prev ? { ...prev, businessType: previousType } : prev))
      throw error
    }
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
        adoptSession,
        hasRole,
        permissions: resolveUserPermissions(userProfile),
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
