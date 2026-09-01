import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { QUERY_KEYS } from '@/constants/queryKeys'
import { useSettings } from '@/hooks/useSettings'
import * as settingsService from '@/services/settingsService'
import type { ReceiptConfig, UserSettings } from '@/types/settings.types'
import type { CustomReceiptTemplate } from '@/types/customReceipt'
import { createDefaultReceiptTemplate } from '@/types/customReceipt'
import {
  normalizeReceiptTemplates,
  resolveActiveFromTemplates,
} from '@/utils/ensureReceiptTemplates'

export function useReceiptBuilderSync() {
  const { user } = useAuth()
  const uid = user?.id || user?.uid || ''
  const qc = useQueryClient()
  const { data: settings, isLoading, refetch } = useSettings()
  const seededFingerprintRef = useRef('')

  const receiptConfig = useMemo(() => settings?.receiptConfig ?? ({} as ReceiptConfig), [settings?.receiptConfig])

  const normalized = useMemo(
    () =>
      normalizeReceiptTemplates(receiptConfig, {
        businessLogoURL: settings?.businessLogoURL,
        upiId: receiptConfig.upiId || settings?.upiId,
        businessType: user?.businessType,
      }),
    [receiptConfig, settings?.businessLogoURL, settings?.upiId, user?.businessType]
  )

  const customTemplates = normalized.customTemplates
  const activeCustomTemplateId = normalized.activeCustomTemplateId
  const activeTemplate = useMemo(
    () => resolveActiveFromTemplates(customTemplates, activeCustomTemplateId, user?.businessType),
    [customTemplates, activeCustomTemplateId, user?.businessType]
  )

  const patchMutation = useMutation({
    mutationFn: (patch: Partial<ReceiptConfig>) => settingsService.updateReceiptConfig(uid, patch),
    onSuccess: (updated: UserSettings) => {
      qc.setQueryData([QUERY_KEYS.SETTINGS, uid], updated)
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.SETTINGS] })
    },
  })

  // Send only the changed keys — the server merges them onto the stored config.
  // Posting the whole snapshot let a stale client value (e.g. an older logoURL)
  // overwrite a newer save, and stripping deletedTemplateIds meant the server
  // never learned about deletions and kept resurrecting the template.
  const saveReceiptPatch = useCallback(
    async (patch: Partial<ReceiptConfig>) =>
      patchMutation.mutateAsync({
        ...patch,
        receiptConfigUpdatedAt: new Date().toISOString(),
      } as Partial<ReceiptConfig>),
    [patchMutation]
  )

  // Seed cloud when templates are missing, outdated, or need logo sync.
  useEffect(() => {
    if (isLoading || !uid || !normalized.shouldPersist) return
    const fingerprint = JSON.stringify({
      templates: normalized.customTemplates.map((t) => ({
        id: t.id,
        updatedAt: t.updatedAt,
        images: t.entries.filter((e) => e.type === 'image').map((e) => (e.type === 'image' ? e.imageURL : undefined)),
      })),
      activeCustomTemplateId: normalized.activeCustomTemplateId,
    })
    if (seededFingerprintRef.current === fingerprint) return
    seededFingerprintRef.current = fingerprint
    saveReceiptPatch({
      customTemplates: normalized.customTemplates,
      activeCustomTemplateId: normalized.activeCustomTemplateId,
    }).catch(() => {
      seededFingerprintRef.current = ''
    })
  }, [
    isLoading,
    uid,
    normalized.shouldPersist,
    normalized.customTemplates,
    normalized.activeCustomTemplateId,
    saveReceiptPatch,
  ])

  const saveTemplate = useCallback(
    async (template: CustomReceiptTemplate) => {
      const updated = template.updatedAt ? template : { ...template, updatedAt: new Date().toISOString() }
      const list = customTemplates.some((t) => t.id === updated.id)
        ? customTemplates.map((t) => (t.id === updated.id ? updated : t))
        : [...customTemplates, updated]
      return saveReceiptPatch({ customTemplates: list })
    },
    [customTemplates, saveReceiptPatch]
  )

  const deleteTemplate = useCallback(
    async (id: string) => {
      const nextActive = activeCustomTemplateId === id ? null : activeCustomTemplateId
      return saveReceiptPatch({
        customTemplates: customTemplates.filter((t) => t.id !== id),
        activeCustomTemplateId: nextActive,
        deletedTemplateIds: [id],
      } as Partial<ReceiptConfig>)
    },
    [activeCustomTemplateId, customTemplates, saveReceiptPatch]
  )

  const duplicateTemplate = useCallback(
    async (id: string) => {
      const source = customTemplates.find((t) => t.id === id) || createDefaultReceiptTemplate()
      const now = new Date().toISOString()
      const cloned: CustomReceiptTemplate = {
        ...JSON.parse(JSON.stringify(source)),
        id: `receipt-tpl-${Date.now()}`,
        name: `${source.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
      }
      return saveReceiptPatch({ customTemplates: [...customTemplates, cloned] })
    },
    [customTemplates, saveReceiptPatch]
  )

  const setActiveTemplate = useCallback(
    async (id: string | null) => saveReceiptPatch({ activeCustomTemplateId: id }),
    [saveReceiptPatch]
  )

  const createTemplate = useCallback(
    async (name?: string) => {
      const tpl = createDefaultReceiptTemplate(name || `Custom Receipt ${customTemplates.length + 1}`)
      await saveReceiptPatch({ customTemplates: [...customTemplates, tpl] })
      return tpl
    },
    [customTemplates, saveReceiptPatch]
  )

  return {
    settings,
    receiptConfig,
    customTemplates,
    activeCustomTemplateId,
    activeTemplate,
    isLoading,
    isSaving: patchMutation.isPending,
    refetch,
    saveTemplate,
    deleteTemplate,
    duplicateTemplate,
    setActiveTemplate,
    createTemplate,
    saveReceiptPatch,
  }
}
