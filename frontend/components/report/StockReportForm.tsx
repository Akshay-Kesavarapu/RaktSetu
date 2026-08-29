'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { queueUpdate, getPendingCount } from '@/lib/offline-db'
import { syncPendingUpdates, setupOnlineListener } from '@/lib/sync'
import { SyncStatus } from '@/components/report/SyncStatus'
import type { BloodBank, BloodGroup, BloodComponent, SyncStatus as SyncStatusType, StockLookupResponse } from '@/lib/types'

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const COMPONENTS: BloodComponent[] = ['Whole Blood', 'Packed Red Cells', 'Fresh Frozen Plasma', 'Platelets', 'Cryoprecipitate']

function normalizeBankRef(code?: string | null): string {
  if (!code) return ''
  return code.replace(/[\s\-_]/g, '').toUpperCase()
}

export function StockReportForm() {
  const [mode, setMode] = useState<'create' | 'correct'>('create')

  // Create Mode States
  const [banks, setBanks] = useState<BloodBank[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [bankIdentifier, setBankIdentifier] = useState<string>('')
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+')
  const [component, setComponent] = useState<BloodComponent>('Whole Blood')
  const [units, setUnits] = useState<number>(5)
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [lastSubmittedRef, setLastSubmittedRef] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [banksError, setBanksError] = useState(false)

  // Correction Mode States
  const [lookupRefInput, setLookupRefInput] = useState<string>('')
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupData, setLookupData] = useState<StockLookupResponse | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  
  const [corrBloodGroup, setCorrBloodGroup] = useState<BloodGroup>('O+')
  const [corrComponent, setCorrComponent] = useState<BloodComponent>('Whole Blood')
  const [corrUnits, setCorrUnits] = useState<number>(5)
  const [isSubmittingCorr, setIsSubmittingCorr] = useState(false)
  const [corrSuccessData, setCorrSuccessData] = useState<{ newRef: string; origRef: string } | null>(null)
  const [corrError, setCorrError] = useState<string | null>(null)

  // Dynamic Bank Identifier Validation (Re-validates instantly on input or dropdown change)
  const selectedBank = banks.find((b) => String(b.id) === selectedBankId)
  const normalizedInput = normalizeBankRef(bankIdentifier)
  const normalizedSelectedRef = normalizeBankRef(selectedBank?.bank_ref_code)
  const isBankIdValid = Boolean(normalizedInput && normalizedSelectedRef && normalizedInput === normalizedSelectedRef)
  const hasBankIdMismatch = Boolean(bankIdentifier.trim().length > 0 && !isBankIdValid)

  const doSync = useCallback(async () => {
    setSyncStatus('syncing')
    setStatusMessage('Syncing queued updates…')
    const { synced, failed } = await syncPendingUpdates()
    const count = await getPendingCount()
    setPendingCount(count)

    if (failed > 0) {
      setSyncStatus('error')
      setStatusMessage(`${failed} update(s) failed to sync. Will retry.`)
    } else if (count === 0 && synced > 0) {
      setSyncStatus('synced')
      setStatusMessage(`Synced ${synced} queued update(s) to server.`)
      setTimeout(() => {
        setSyncStatus('idle')
        setStatusMessage(null)
      }, 3500)
    } else {
      setSyncStatus(count > 0 ? 'queued' : 'idle')
      setStatusMessage(null)
    }
  }, [])

  useEffect(() => {
    async function loadBanks() {
      try {
        const data = await api.bloodBanks()
        setBanks(data)
        if (data.length > 0) setSelectedBankId(String(data[0].id))
      } catch {
        setBanksError(true)
      }
    }
    loadBanks()

    async function checkPending() {
      const count = await getPendingCount()
      setPendingCount(count)
      if (count > 0 && navigator.onLine) doSync()
      else if (count > 0) setSyncStatus('queued')
    }
    checkPending()

    const unlisten = setupOnlineListener(checkPending)
    return () => unlisten()
  }, [doSync])

  const adjustUnits = (delta: number) => {
    setUnits((prev) => Math.max(0, Math.min(9999, prev + delta)))
  }

  const adjustCorrUnits = (delta: number) => {
    setCorrUnits((prev) => Math.max(0, Math.min(9999, prev + delta)))
  }

  const queueOffline = async (payload: Parameters<typeof api.updateStock>[0], reasonMsg?: string) => {
    await queueUpdate(payload)
    const count = await getPendingCount()
    setPendingCount(count)
    setSyncStatus('queued')
    setStatusMessage(reasonMsg || 'Offline: Saved in IndexedDB queue')
    setUnits(5)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBankId || !isBankIdValid) return
    setError(null)
    setLastSubmittedRef(null)

    const payload = {
      bank_id: parseInt(selectedBankId, 10),
      bank_identifier: bankIdentifier.trim(),
      blood_group: bloodGroup,
      component,
      units,
    }

    if (navigator.onLine) {
      setSyncStatus('syncing')
      setStatusMessage('Sending update to API…')
      try {
        const response = await api.updateStock(payload)
        setSyncStatus('synced')
        setStatusMessage(response.message || 'Stock updated successfully')
        if (response.reference_id) {
          setLastSubmittedRef(response.reference_id)
        }
        setUnits(5)
      } catch (err: any) {
        const apiError = err.message || 'Online submit failed.'
        setError(apiError)
        await queueOffline(payload, `Queued locally (${apiError})`)
      }
    } else {
      await queueOffline(payload, 'Offline: Queued in IndexedDB')
    }
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupRefInput.trim()) return
    setIsLookingUp(true)
    setLookupError(null)
    setLookupData(null)
    setCorrSuccessData(null)
    setCorrError(null)

    try {
      const data = await api.lookupStock(lookupRefInput.trim())
      setLookupData(data)
      setCorrBloodGroup(data.blood_group)
      setCorrComponent(data.component)
      setCorrUnits(data.units)
    } catch (err: any) {
      setLookupError(err.message || 'Failed to lookup reference ID.')
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lookupData) return
    setIsSubmittingCorr(true)
    setCorrError(null)

    try {
      const response = await api.correctStock({
        reference_id: lookupData.reference_id,
        blood_group: corrBloodGroup,
        component: corrComponent,
        units: corrUnits,
      })
      setCorrSuccessData({
        newRef: response.new_reference_id,
        origRef: response.original_reference_id,
      })
      setLookupData(null)
    } catch (err: any) {
      setCorrError(err.message || 'Failed to submit correction.')
    } finally {
      setIsSubmittingCorr(false)
    }
  }

  const formatRemainingTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${mins}m remaining in 24h correction window`
    return `${mins}m remaining in 24h correction window`
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 btn-interactive ${
              mode === 'create'
                ? 'bg-light-navy text-white shadow-xs'
                : 'text-slate-600 hover:text-light-navy hover:bg-slate-100'
            }`}
          >
            New Stock Update
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('correct')
              if (lastSubmittedRef && !lookupRefInput) {
                setLookupRefInput(lastSubmittedRef)
              }
            }}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 active:scale-95 btn-interactive ${
              mode === 'correct'
                ? 'bg-light-accent text-white shadow-xs'
                : 'text-slate-600 hover:text-light-navy hover:bg-slate-100'
            }`}
          >
            <span>✏</span>
            <span>Correct Previous Update</span>
          </button>
        </div>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
          {/* Blood Group Button-Grid Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              1. Select Blood Group
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {BLOOD_GROUPS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setBloodGroup(bg)}
                  className={`py-3 rounded-xl text-sm font-black border transition-all duration-200 pill-interactive ${
                    bloodGroup === bg
                      ? 'bg-light-accent text-white border-light-accent shadow-md scale-[1.03]'
                      : 'bg-white text-light-navy border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* Component Button-Grid / Segmented Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">
              2. Select Component
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COMPONENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setComponent(c)}
                  className={`px-3.5 py-3 rounded-xl text-xs font-bold border text-left transition-all duration-200 pill-interactive ${
                    component === c
                      ? 'bg-light-navy text-white border-light-navy shadow-md scale-[1.02]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Group & Quantity Stepper Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xs">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-xs">
                <span className="text-2xl font-black text-light-accent leading-none">{bloodGroup}</span>
                <span className="text-[10px] font-bold text-slate-400 mt-1 truncate max-w-[55px]">
                  {component.split(' ')[0]}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Active Selection</p>
                <p className="text-sm font-bold text-light-navy">{bloodGroup} · {component}</p>
              </div>
            </div>

            {/* Quantity Stepper */}
            <div className="space-y-1 text-center sm:text-right">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Units to Add</p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => adjustUnits(-1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-300 bg-white text-light-navy font-black text-lg hover:bg-slate-100 active:scale-90 shadow-xs transition-all btn-interactive"
                >
                  −
                </button>
                <span className="text-3xl font-black text-light-navy w-14 text-center">{units}</span>
                <button
                  type="button"
                  onClick={() => adjustUnits(1)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-300 bg-white text-light-navy font-black text-lg hover:bg-slate-100 active:scale-90 shadow-xs transition-all btn-interactive"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 3. Target Blood Bank Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              3. Target Blood Centre
            </label>
            {banksError ? (
              <p className="text-xs text-light-accent font-semibold">
                Unable to load blood banks. You can still submit an update offline.
              </p>
            ) : (
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-3 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-light-navy focus:ring-1 focus:ring-light-navy transition-colors"
                required
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name} — {bank.city}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 4. Verify Blood Centre ID (New Authentication & Access Field) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                4. Verify Blood Centre ID
              </label>
              {isBankIdValid && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-scaleIn shadow-2xs">
                  <span>✓</span> Verified ID
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={bankIdentifier}
                onChange={(e) => setBankIdentifier(e.target.value)}
                placeholder="Enter your centre's ID (e.g. BB007)"
                className={`w-full border rounded-xl px-3.5 py-3 text-sm font-mono font-bold focus:outline-none transition-all duration-200 ${
                  isBankIdValid
                    ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 focus:ring-2 focus:ring-emerald-500/20'
                    : hasBankIdMismatch
                    ? 'border-red-400 bg-red-50/20 text-slate-900 focus:ring-2 focus:ring-red-400/20'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-light-navy focus:ring-2 focus:ring-light-navy/20'
                }`}
                required
              />
              {isBankIdValid && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-base animate-scaleIn">
                  ✓
                </div>
              )}
            </div>
            {hasBankIdMismatch && (
              <p className="text-xs text-light-accent font-medium mt-1.5 flex items-center gap-1 animate-fadeIn">
                <span>⚠</span>
                <span>This ID doesn&apos;t match the selected centre. Please check and try again.</span>
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-light-accent/30 rounded-xl p-3.5 text-xs text-light-accent animate-fadeIn">
              {error}
            </div>
          )}

          {/* Reference ID Callout with 24h Guarantee */}
          {lastSubmittedRef && (
            <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-5 space-y-2 animate-fadeIn shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Update submitted successfully.</span>
                </p>
                <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Update ID: {lastSubmittedRef}
                </span>
              </div>
              <p className="text-xs text-emerald-700">
                Save this ID to make corrections within 24 hours.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLookupRefInput(lastSubmittedRef)
                    setMode('correct')
                  }}
                  className="text-xs font-bold text-light-accent hover:underline flex items-center gap-1 active:scale-95 transition-transform"
                >
                  <span>Made a mistake? Correct this update now →</span>
                </button>
              </div>
            </div>
          )}

          {/* Submit + Sync Status */}
          <div className="space-y-3 pt-2">
            <SyncStatus status={syncStatus} pendingCount={pendingCount} customMessage={statusMessage} />
            <button
              type="submit"
              disabled={syncStatus === 'syncing' || !isBankIdValid}
              className="w-full bg-light-accent hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm tracking-widest py-3.5 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 uppercase flex items-center justify-center gap-2 btn-interactive"
            >
              {syncStatus === 'syncing' ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Submitting Stock Update…</span>
                </>
              ) : (
                <span>Done · Submit Stock Report →</span>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Correction Workflow View */
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-light-navy">24-Hour Stock Correction Workflow</p>
            <p className="text-xs text-slate-500">
              Enter the Update ID received during submission (e.g. <code className="font-mono font-bold text-light-navy bg-white px-1.5 py-0.5 rounded border border-slate-200">UPD-000213</code>) to adjust quantities or blood groups. Corrections maintain a complete audit trail without deleting history.
            </p>
          </div>

          {/* Step 1: Lookup Form */}
          <form onSubmit={handleLookup} className="space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
              1. Enter Original Update ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={lookupRefInput}
                onChange={(e) => setLookupRefInput(e.target.value.toUpperCase())}
                placeholder="e.g. UPD-000213"
                className="flex-grow border border-slate-300 rounded-lg px-3.5 py-2.5 bg-white text-slate-900 text-sm font-mono font-bold focus:outline-none focus:border-light-navy"
                required
              />
              <button
                type="submit"
                disabled={isLookingUp || !lookupRefInput.trim()}
                className="bg-light-navy text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap shadow-xs"
              >
                {isLookingUp ? 'Verifying…' : 'Lookup Update'}
              </button>
            </div>
          </form>

          {lookupError && (
            <div className="bg-red-50 border border-light-accent/30 rounded-xl p-4 text-xs text-light-accent space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>⚠</span>
                <span>Lookup Failed</span>
              </p>
              <p>{lookupError}</p>
            </div>
          )}

          {/* Display Original & Correction Fields */}
          {lookupData && (
            <form onSubmit={handleCorrectionSubmit} className="space-y-5 border-t border-slate-200 pt-5">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-light-navy">Original Record: {lookupData.reference_id}</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    lookupData.is_editable 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {lookupData.is_editable ? 'Editable' : 'Locked'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
                  <div>
                    <span className="block text-[10px]">Blood Centre:</span>
                    <strong className="text-light-navy">{lookupData.bank_name}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px]">Original Stock:</span>
                    <strong className="text-light-navy">{lookupData.blood_group} ({lookupData.component}) → {lookupData.units} units</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[10px]">Window Status:</span>
                    <span className="text-emerald-700 font-medium">
                      {formatRemainingTime(lookupData.remaining_seconds)}
                    </span>
                  </div>
                </div>
              </div>

              {lookupData.is_editable ? (
                <>
                  {/* Corrected Blood Group */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Corrected Blood Group
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {BLOOD_GROUPS.map((bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => setCorrBloodGroup(bg)}
                          className={`py-2.5 rounded-lg text-xs font-bold border transition-colors ${
                            corrBloodGroup === bg
                              ? 'bg-light-accent text-white border-light-accent shadow-xs'
                              : 'bg-white text-light-navy border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corrected Component */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Corrected Component
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {COMPONENTS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCorrComponent(c)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border text-left transition-all ${
                            corrComponent === c
                              ? 'bg-light-navy text-white border-light-navy shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corrected Units Stepper */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Adjusted Quantity</p>
                      <p className="text-xs font-bold text-light-navy">{corrBloodGroup} · {corrComponent}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => adjustCorrUnits(-1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-light-navy font-bold text-lg hover:bg-slate-100 transition-colors shadow-xs"
                      >
                        −
                      </button>
                      <span className="text-2xl font-black text-light-navy w-12 text-center">{corrUnits}</span>
                      <button
                        type="button"
                        onClick={() => adjustCorrUnits(1)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-light-navy font-bold text-lg hover:bg-slate-100 transition-colors shadow-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {corrError && (
                    <div className="bg-red-50 border border-light-accent/30 rounded-lg p-3 text-xs text-light-accent">
                      {corrError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingCorr}
                    className="w-full bg-light-accent text-white font-bold text-sm tracking-widest py-3.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity uppercase flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSubmittingCorr ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Saving Correction…
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        Submit Stock Correction
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>🔒</span>
                    <span>Correction Window Closed</span>
                  </p>
                  <p>{lookupData.message}</p>
                </div>
              )}
            </form>
          )}

          {/* Success Callout after correction */}
          {corrSuccessData && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <span>✓</span>
                <span>Correction submitted successfully.</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-emerald-700 block text-[10px]">Original Update ID:</span>
                  <span className="font-mono text-emerald-900 line-through">{corrSuccessData.origRef}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[10px]">New Update ID:</span>
                  <span className="font-mono font-bold text-emerald-900">{corrSuccessData.newRef}</span>
                </div>
              </div>
              <p className="text-[11px] text-emerald-700">
                The current inventory has been dynamically updated and the audit trail preserved.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
