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
import { useAuth } from '@/contexts/AuthContext'
import { getAllUsers, saveManagedUser, saveManagedUsers } from '@/services/authService'
import { PasswordRequirementsList } from '@/components/ui/PasswordRequirementsList'
import { validatePassword } from '@/utils/password'
import toast from 'react-hot-toast'

interface ManagedUser extends UserProfile {
  password?: string
}

export const PermissionsAndAccounts = () => {
  const { user, userProfile } = useAuth()
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

  useEffect(() => {
    const loadManagedUsers = async () => {
      if (!user) {
        setUsers([])
        return
      }

      try {
        const managedUsers = await getAllUsers(user.uid)
        setUsers(managedUsers as ManagedUser[])
      } catch (error) {
        console.error('Error loading managed users:', error)
        toast.error('Failed to load managed users')
      }
    }

    loadManagedUsers()
  }, [user])

  const handleAddUser = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all required fields')
      return
    }

    const { isValid, failedRequirements } = validatePassword(form.password)
    if (!isValid) {
      toast.error(`Password requirement missing: ${failedRequirements[0]}`)
      return
    }

    const newUser: ManagedUser = {
      uid: `user_${Date.now()}`,
      displayName: form.name,
      email: form.email,
      role: form.role,
      permissions: form.role === 'admin' ? ADMIN_PERMISSIONS : { ...permissionsForm },
      password: form.password,
      photoURL: null,
      businessName: '',
      plan: 'free',
      createdAt: new Date() as any,
    }

    const updatedUsers = [...users, newUser]
    setUsers(updatedUsers)
    if (user) {
      await saveManagedUser(user.uid, newUser)
    }
    
    toast.success('User added successfully')
    setIsAddUserOpen(false)
    setForm({ name: '', email: '', role: 'agent', password: '' })
  }

  const handleUpdatePermissions = async () => {
    if (!selectedUser || !user) return

    const updatedUser = { ...selectedUser, permissions: permissionsForm }
    const updatedUsers = users.map(u => u.uid === selectedUser.uid ? updatedUser : u)
    setUsers(updatedUsers)
    await saveManagedUsers(user.uid, updatedUsers)
    
    toast.success('Permissions updated')
    setIsEditUserOpen(false)
  }

  const handleUpdatePassword = async () => {
    if (!selectedUser || !passwordForm.newPassword || !user) {
      toast.error('Please enter a password')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    const { isValid, failedRequirements } = validatePassword(passwordForm.newPassword)
    if (!isValid) {
      toast.error(`Password requirement missing: ${failedRequirements[0]}`)
      return
    }

    const updatedUsers = users.map(u =>
      u.uid === selectedUser.uid
        ? { ...u, password: passwordForm.newPassword }
        : u
    )
    setUsers(updatedUsers)
    await saveManagedUsers(user.uid, updatedUsers)
    toast.success('Password updated')
    setIsPasswordOpen(false)
    setPasswordForm({ newPassword: '', confirmPassword: '' })
  }

  const handleResetPassword = async (targetUser?: ManagedUser) => {
    if (!user) return
    const userToReset = targetUser ?? selectedUser
    if (!userToReset) return

    const updatedUsers = users.map(u =>
      u.uid === userToReset.uid
        ? { ...u, password: 'password123' }
        : u
    )
    setUsers(updatedUsers)
    await saveManagedUsers(user.uid, updatedUsers)
    toast.success('Password reset to default: password123')
  }

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    const updatedUsers = users.filter(u => u.uid !== uid)
    setUsers(updatedUsers)
    if (user) {
      await saveManagedUsers(user.uid, updatedUsers)
    }
    toast.success('User deleted')
  }

  const openEditUser = (user: ManagedUser) => {
    setSelectedUser(user)
    setPermissionsForm(user.permissions || AGENT_PERMISSIONS)
    setIsEditUserOpen(true)
  }

  const openPasswordChange = (user: ManagedUser) => {
    setSelectedUser(user)
    setIsPasswordOpen(true)
  }

  const columns: ColumnDef<ManagedUser>[] = [
    {
      key: 'displayName',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium text-sm">{row.displayName}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge variant={row.role === 'admin' ? 'warning' : 'info'}>
          {row.role?.toUpperCase() || 'AGENT'}
        </Badge>
      ),
    },
    {
      key: 'permissions',
      header: 'Stock Access',
      render: (row) => (
        row.permissions?.canManipulateStock ? (
          <Badge variant="success">Yes</Badge>
        ) : (
          <Badge variant="default">No</Badge>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
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

  const handleResetPasswordUser = async (user: ManagedUser) => {
    setSelectedUser(user)
    await handleResetPassword(user)
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Admin Access Required
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Only administrators can manage users and permissions.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Permissions & Accounts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setIsAddUserOpen(true)}>
          Add User
        </Button>
      </div>

      <Card className="p-4">
        <DataTable
          data={users}
          columns={columns}
          searchable
          emptyMessage="No users added yet"
        />
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => {
          setIsAddUserOpen(false)
          setForm({ name: '', email: '', role: 'agent', password: '' })
        }}
        title="Add New User"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsAddUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>
              Add User
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Enter user's full name"
            autoFocus
          />
          <Input
            label="Email *"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="user@example.com"
          />
          <Input
            label="Password *"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Min 6 characters"
          />
          <Select
            label="Role *"
            options={[
              { value: 'admin', label: 'Administrator' },
              { value: 'agent', label: 'Agent' },
            ]}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          />
          
          {form.role === 'agent' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Permissions
              </label>
              <Checkbox
                checked={permissionsForm.canManipulateStock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canManipulateStock: e.target.checked })}
                label="Can manipulate stock"
              />
              <Checkbox
                checked={permissionsForm.canAccessSuppliers}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessSuppliers: e.target.checked })}
                label="Can access suppliers"
              />
              <Checkbox
                checked={permissionsForm.canAccessPurchases}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessPurchases: e.target.checked })}
                label="Can access purchases"
              />
              <Checkbox
                checked={permissionsForm.canAccessExpenses}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessExpenses: e.target.checked })}
                label="Can access expenses"
              />
              <Checkbox
                checked={permissionsForm.canAccessReports}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessReports: e.target.checked })}
                label="Can access reports"
              />
              <Checkbox
                checked={permissionsForm.canManageUsers}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canManageUsers: e.target.checked })}
                label="Can manage users"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Permissions Modal */}
      <Modal
        isOpen={isEditUserOpen}
        onClose={() => setIsEditUserOpen(false)}
        title="Edit User Permissions"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePermissions}>
              Update Permissions
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Editing permissions for: <strong>{selectedUser?.displayName}</strong>
          </p>
          <Checkbox
            checked={permissionsForm.canManipulateStock}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canManipulateStock: e.target.checked })}
            label="Can manipulate stock"
          />
          <Checkbox
            checked={permissionsForm.canAccessSuppliers}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessSuppliers: e.target.checked })}
            label="Can access suppliers"
          />
          <Checkbox
            checked={permissionsForm.canAccessPurchases}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessPurchases: e.target.checked })}
            label="Can access purchases"
          />
          <Checkbox
            checked={permissionsForm.canAccessExpenses}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessExpenses: e.target.checked })}
            label="Can access expenses"
          />
          <Checkbox
            checked={permissionsForm.canAccessReports}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canAccessReports: e.target.checked })}
            label="Can access reports"
          />
          <Checkbox
            checked={permissionsForm.canManageUsers}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPermissionsForm({ ...permissionsForm, canManageUsers: e.target.checked })}
            label="Can manage users"
          />
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={isPasswordOpen}
        onClose={() => {
          setIsPasswordOpen(false)
          setPasswordForm({ newPassword: '', confirmPassword: '' })
        }}
        title="Change Password"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePassword}>
              Update Password
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Changing password for: <strong>{selectedUser?.displayName}</strong>
          </p>
          <Input
            label="New Password *"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="Min 6 characters"
            autoFocus
          />
          <Input
            label="Confirm Password *"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="Re-enter password"
          />
        </div>
      </Modal>
    </div>
  )
}
