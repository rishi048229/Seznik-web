import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { DataTable, type ColumnDef } from '@/components/data-display/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { Pencil, Trash2, KeyRound, Plus, Shield, ShieldOff } from 'lucide-react'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth.types'
import { ADMIN_PERMISSIONS, AGENT_PERMISSIONS } from '@/types/auth.types'
import { normalizePermissions } from '@/utils/permissions'
import type { TranslationKey } from '@/i18n/translations'
import { useAuth } from '@/contexts/AuthContext'
import {
  getAdminAccountId,
  getAllUsers,
  saveManagedUser,
  updateManagedUserProfile,
  deleteManagedUser,
  updateManagedUserPasswordDirectly,
} from '@/services/authService'
import { validatePassword } from '@/utils/password'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'

interface ManagedUser extends UserProfile {
  password?: string
}

const PERMISSION_LABELS: { key: keyof UserPermissions; labelKey: TranslationKey }[] = [
  { key: 'canAccessProducts', labelKey: 'permissions.canAccessProducts' },
  { key: 'canManipulateStock', labelKey: 'permissions.canManipulateStock' },
  { key: 'canAccessSales', labelKey: 'permissions.canAccessSales' },
  { key: 'canAccessCustomers', labelKey: 'permissions.canAccessCustomers' },
  { key: 'canAccessSuppliers', labelKey: 'permissions.canAccessSuppliers' },
  { key: 'canAccessPurchases', labelKey: 'permissions.canAccessPurchases' },
  { key: 'canAccessExpenses', labelKey: 'permissions.canAccessExpenses' },
  { key: 'canAccessReports', labelKey: 'permissions.canAccessReports' },
  { key: 'canAccessSettings', labelKey: 'permissions.canAccessSettings' },
  { key: 'canManageUsers', labelKey: 'permissions.canManageUsers' },
]

export const PermissionsAndAccounts = () => {
  const { t } = useLanguage()
  const { user, userProfile, permissions } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'agent' as UserRole,
    password: '',
  })
  
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  
  const [permissionsForm, setPermissionsForm] = useState<UserPermissions>(AGENT_PERMISSIONS)

  const isAdmin = userProfile?.role === 'admin'
  const canManageAccounts = isAdmin || permissions?.canManageUsers === true
  const adminId = getAdminAccountId(user)

  const reloadManagedUsers = async () => {
    if (!adminId) {
      setUsers([])
      return
    }
    const managedUsers = await getAllUsers(adminId)
    setUsers(managedUsers as ManagedUser[])
  }

  useEffect(() => {
    let cancelled = false

    const loadManagedUsers = async () => {
      if (!adminId) {
        setUsers([])
        return
      }

      try {
        const managedUsers = await getAllUsers(adminId)
        if (!cancelled) setUsers(managedUsers as ManagedUser[])
      } catch (error) {
        console.error('Error loading managed users:', error)
        if (!cancelled) toast.error(t('permissions.errLoadFailed'))
      }
    }

    loadManagedUsers()
    return () => { cancelled = true }
  }, [adminId, t])

  const handleAddUser = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error(t('permissions.errFillRequired'))
      return
    }

    const normalizedEmail = form.email.trim().toLowerCase()

    // Fast client-side checks against what we already have loaded — the backend
    // is still the source of truth (it also sees the admin's own login email).
    if (userProfile?.email && userProfile.email.trim().toLowerCase() === normalizedEmail) {
      toast.error(t('permissions.errEmailInUseOwn'))
      return
    }
    if (users.some(u => u.email && u.email.trim().toLowerCase() === normalizedEmail)) {
      toast.error(t('permissions.errEmailInUse'))
      return
    }

    const { isValid, failedRequirements } = validatePassword(form.password)
    if (!isValid) {
      toast.error(`${t('security.errPasswordRequirementPrefix')} ${failedRequirements[0]}`)
      return
    }

    if (!adminId) {
      toast.error(t('permissions.errLoadFailed'))
      return
    }

    const newUser: ManagedUser = {
      uid: `user_${Date.now()}`,
      displayName: form.name.trim(),
      email: normalizedEmail,
      role: form.role,
      permissions: form.role === 'admin' ? ADMIN_PERMISSIONS : normalizePermissions(permissionsForm, 'agent'),
      password: form.password,
      photoURL: null,
      businessName: '',
      plan: 'free',
      createdAt: new Date().toISOString(),
    }

    try {
      const created = await saveManagedUser(adminId, newUser)
      setUsers(prev => [...prev.filter(u => u.uid !== created.uid), created as ManagedUser])
      await reloadManagedUsers()
      toast.success(t('permissions.userAddedSuccess'))
      setIsAddUserOpen(false)
      setForm({ name: '', email: '', role: 'agent', password: '' })
      setPermissionsForm({ ...AGENT_PERMISSIONS })
    } catch (err: any) {
      console.error('Add agent failed:', err)
      toast.error(err?.message || t('permissions.errLoadFailed'))
    }
  }

  const handleUpdatePermissions = async () => {
    if (!selectedUser || !adminId) return

    const nextPermissions = selectedUser.role === 'admin'
      ? ADMIN_PERMISSIONS
      : normalizePermissions(permissionsForm, 'agent')

    try {
      const updated = await updateManagedUserProfile(adminId, selectedUser.uid, {
        permissions: nextPermissions,
        role: selectedUser.role,
      })
      setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, ...updated } as ManagedUser : u))
      toast.success(t('permissions.permissionsUpdated'))
      setIsEditUserOpen(false)
    } catch (err: any) {
      console.error('Update permissions failed:', err)
      toast.error(err?.message || t('permissions.errLoadFailed'))
    }
  }

  const handleUpdatePassword = async () => {
    if (!selectedUser || !passwordForm.newPassword || !adminId) {
      toast.error(t('permissions.errEnterPassword'))
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('security.errPasswordsNoMatch'))
      return
    }

    const { isValid, failedRequirements } = validatePassword(passwordForm.newPassword)
    if (!isValid) {
      toast.error(`${t('security.errPasswordRequirementPrefix')} ${failedRequirements[0]}`)
      return
    }

    try {
      await updateManagedUserPasswordDirectly(adminId, selectedUser.uid, passwordForm.newPassword)
      toast.success(t('permissions.passwordUpdated'))
      setIsPasswordOpen(false)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      console.error('Password update failed:', err)
      toast.error(err.message || 'Failed to update agent password')
    }
  }

  const handleResetPassword = async (targetUser?: ManagedUser) => {
    if (!adminId) return
    const userToReset = targetUser ?? selectedUser
    if (!userToReset) return

    try {
      await updateManagedUserPasswordDirectly(adminId, userToReset.uid, 'password123')
      toast.success(t('permissions.passwordResetDefault'))
    } catch (err: any) {
      console.error('Password reset failed:', err)
      toast.error(err.message || 'Failed to reset agent password')
    }
  }

  const handleResetPasswordUser = async (target: ManagedUser) => {
    setSelectedUser(target)
    await handleResetPassword(target)
  }

  const handleDeleteUser = async (uid: string) => {
    if (!confirm(t('permissions.deleteUserConfirm'))) return
    if (!adminId) {
      toast.error(t('permissions.errLoadFailed'))
      return
    }

    const previous = users
    setUsers(users.filter(u => u.uid !== uid))

    try {
      await deleteManagedUser(adminId, uid)
      toast.success(t('permissions.userDeleted'))
    } catch (err: any) {
      console.error('Delete agent failed:', err)
      setUsers(previous)
      toast.error(err?.message || t('permissions.errLoadFailed'))
    }
  }

  const openEditUser = (user: ManagedUser) => {
    setSelectedUser(user)
    setPermissionsForm(normalizePermissions(user.permissions, user.role || 'agent'))
    setIsEditUserOpen(true)
  }

  const openPasswordChange = (user: ManagedUser) => {
    setSelectedUser(user)
    setIsPasswordOpen(true)
  }

  const columns: ColumnDef<ManagedUser>[] = [
    {
      key: 'displayName',
      header: t('common.name'),
      render: (row) => (
        <div>
          <p className="font-medium text-sm">{row.displayName}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('permissions.roleHeader'),
      render: (row) => (
        <Badge variant={row.role === 'admin' ? 'warning' : 'info'}>
          {row.role?.toUpperCase() || t('permissions.agentLabel')}
        </Badge>
      ),
    },
    {
      key: 'permissions',
      header: t('permissions.permissionsLabel'),
      render: (row) => {
        const perms = normalizePermissions(row.permissions, row.role || 'agent')
        const enabled = PERMISSION_LABELS.filter(item => perms[item.key]).length
        return (
          <Badge variant={enabled > 0 ? 'success' : 'default'}>
            {enabled}/{PERMISSION_LABELS.length}
          </Badge>
        )
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditUser(row)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openPasswordChange(row)}>
            <KeyRound size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleResetPasswordUser(row)}>
            <ShieldOff size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(row.uid)}>
            <Trash2 size={16} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  if (!canManageAccounts) {
    return (
      <div className="text-center py-12">
        <Shield size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('permissions.adminAccessRequiredTitle')}
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          {t('permissions.adminAccessRequiredDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('permissions.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('permissions.subtitle')}
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => {
          setPermissionsForm({ ...AGENT_PERMISSIONS })
          setIsAddUserOpen(true)
        }}>
          {t('permissions.addUser')}
        </Button>
      </div>

      <Card className="p-4">
        <DataTable
          data={users}
          columns={columns}
          searchable
          emptyMessage={t('permissions.noUsersYet')}
        />
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => {
          setIsAddUserOpen(false)
          setForm({ name: '', email: '', role: 'agent', password: '' })
        }}
        title={t('permissions.addNewUserTitle')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsAddUserOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleAddUser}>
              {t('permissions.addUser')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('permissions.fullNameRequired')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('permissions.fullNamePlaceholder')}
            autoFocus
          />
          <Input
            label={t('permissions.emailRequired')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="user@example.com"
          />
          <Input
            label={t('permissions.passwordRequired')}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={t('permissions.minChars')}
          />
          <Select
            label={t('permissions.roleRequired')}
            options={[
              { value: 'admin', label: t('permissions.administrator') },
              { value: 'agent', label: t('permissions.agent') },
            ]}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          />

          {form.role === 'agent' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('permissions.permissionsLabel')}
              </label>
              {PERMISSION_LABELS.map(item => (
                <Checkbox
                  key={item.key}
                  checked={permissionsForm[item.key]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, [item.key]: e.target.checked })}
                  label={t(item.labelKey)}
                />
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Permissions Modal */}
      <Modal
        isOpen={isEditUserOpen}
        onClose={() => setIsEditUserOpen(false)}
        title={t('permissions.editUserPermissionsTitle')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsEditUserOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleUpdatePermissions}>
              {t('permissions.updatePermissions')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('permissions.editingPermissionsForPrefix')} <strong>{selectedUser?.displayName}</strong>
          </p>
          {PERMISSION_LABELS.map(item => (
            <Checkbox
              key={item.key}
              checked={permissionsForm[item.key]}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, [item.key]: e.target.checked })}
              label={t(item.labelKey)}
            />
          ))}
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordOpen}
        onClose={() => {
          setIsPasswordOpen(false)
          setPasswordForm({ newPassword: '', confirmPassword: '' })
        }}
        title={t('permissions.changePasswordTitle')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsPasswordOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button onClick={handleUpdatePassword}>
              {t('permissions.updatePasswordBtn')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('permissions.changingPasswordForPrefix')} <strong>{selectedUser?.displayName}</strong>
          </p>
          <Input
            label={t('permissions.newPasswordRequired')}
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder={t('permissions.minChars')}
            autoFocus
          />
          <Input
            label={t('permissions.confirmPasswordRequired')}
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder={t('permissions.reEnterPassword')}
          />
        </div>
      </Modal>
    </div>
  )
}
