/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { loginUser, registerUser, getUserProfile, signOutUser, setUserRoleAndProfile, completeOnboarding } from '@/services/authService'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth.types'
import { getAuthToken } from '@/services/api'

interface AuthContextType {
  user: UserProfile | null
  userProfile: UserProfile | null
  loading: boolean
  hasSelectedWorkspace: boolean
  loginWithEmail: (email: string, pass: string) => Promise<void>
  registerWithEmail: (email: string, pass: string, fName: string, lName: string, phone: string) => Promise<void>
  signOut: () => Promise<void>
  setUserRole: (role: UserRole, name: string, password: string) => Promise<void>
  completeOnboarding: (businessName: string) => Promise<void>
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

  const handleLogin = async (email: string, pass: string) => {
    const data = await loginUser(email, pass)
    setUser(data.user)
    localStorage.removeItem('hasSelectedWorkspace')
    setHasSelectedWorkspace(false)
    setUserProfile(data.user ? { ...data.user, role: null } : null)
  }
  
  const handleRegister = async (email: string, pass: string, fName: string, lName: string, phone: string) => {
    const data = await registerUser(email, pass, fName, lName, phone)
    setUser(data.user)
    localStorage.removeItem('hasSelectedWorkspace')
    setHasSelectedWorkspace(false)
    setUserProfile(data.user ? { ...data.user, role: null } : null)
  }

  const handleSignOut = async () => {
    setHasSelectedWorkspace(false)
    localStorage.removeItem('hasSelectedWorkspace')
    await signOutUser()
    setUser(null)
    setUserProfile(null)
  }

  const handleSetUserRole = async (role: UserRole, name: string, password: string) => {
    if (!user) throw new Error('No user logged in')
    await setUserRoleAndProfile(user.id || user.uid, role, name, password)
    const updatedProfile = await getUserProfile()
    setUserProfile(updatedProfile ? { ...updatedProfile, role } : null)
    setHasSelectedWorkspace(true)
    localStorage.setItem('hasSelectedWorkspace', 'true')
  }

  const handleCompleteOnboarding = async (businessName: string) => {
    if (!user) throw new Error('No user logged in')
    await completeOnboarding(user.id || user.uid, businessName)
    const updatedProfile = await getUserProfile()
    setUserProfile(updatedProfile)
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
