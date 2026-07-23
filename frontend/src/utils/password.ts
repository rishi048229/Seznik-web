export interface PasswordRequirement {
  id: string
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', label: 'At least 8 characters', test: p => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: p => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: p => /[a-z]/.test(p) },
  { id: 'number', label: 'One number (0-9)', test: p => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$%^&*)', test: p => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
]

export function validatePassword(password: string): { isValid: boolean; failedRequirements: string[] } {
  const failed = PASSWORD_REQUIREMENTS.filter(req => !req.test(password)).map(req => req.label)
  return {
    isValid: failed.length === 0,
    failedRequirements: failed,
  }
}
