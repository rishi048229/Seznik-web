import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { loginUser, registerUser, getUserProfile, signOutUser, setUserRoleAndProfile, completeOnboarding } from '@/services/authService'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth.types'
import { getAuthToken } from '@/services/api'

interface AuthContextType {
  user: any | null
  userProfile: UserProfile | null
  loading: boolean
  hasSelectedWorkspace: boolean
  loginWithEmail: (email: string, pass: string) => Promise<void>
  registerWithEmail: (email: string, pass: string, fName: string, lName: string) => Promise<void>
  signOut: () => Promise<void>
  setUserRole: (role: UserRole, name: string, password: string) => Promise<void>
  completeOnboarding: (businessName: string) => Promise<void>
  clearWorkspaceSelection: () => void
  hasRole: () => boolean
  permissions: UserPermissions | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasSelectedWorkspace, setHasSelectedWorkspace] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken()
      if (token) {
        try {
          const profile = await getUserProfile()
          setUser(profile)
          setUserProfile(profile)
        } catch (error) {
          console.error("Auth init failed", error)
          setUser(null)
          setUserProfile(null)
        }
      } else {
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const handleLogin = async (email: string, pass: string) => {
    const data = await loginUser(email, pass)
    setUser(data.user)
    setUserProfile(data.user)
  }
  
  const handleRegister = async (email: string, pass: string, fName: string, lName: string) => {
    const data = await registerUser(email, pass, fName, lName)
    setUser(data.user)
    setUserProfile(data.user)
  }

  const handleSignOut = async () => {
    setHasSelectedWorkspace(false)
    await signOutUser()
    setUser(null)
    setUserProfile(null)
  }

  const handleSetUserRole = async (role: UserRole, name: string, password: string) => {
    if (!user) throw new Error('No user logged in')
    await setUserRoleAndProfile(user.id || user.uid, role, name, password)
    const updatedProfile = await getUserProfile()
    setUserProfile(updatedProfile)
    setHasSelectedWorkspace(true)
  }

  const handleCompleteOnboarding = async (businessName: string) => {
    if (!user) throw new Error('No user logged in')
    await completeOnboarding(user.id || user.uid, businessName)
    const updatedProfile = await getUserProfile()
    setUserProfile(updatedProfile)
  }

  const handleClearWorkspaceSelection = () => {
    setHasSelectedWorkspace(false)
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
        signOut: handleSignOut,
        setUserRole: handleSetUserRole,
        completeOnboarding: handleCompleteOnboarding,
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
