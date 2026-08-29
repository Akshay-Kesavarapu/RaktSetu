'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatLiveRelativeTime, useLiveTicker } from '@/lib/time'
import { 
  api, 
  getStoredBankToken, 
  getStoredBankInfo, 
  removeStoredBankSession 
} from '@/lib/api'
import type { 
  BloodBank, 
  BloodGroup, 
  BloodComponent, 
  BloodRequest, 
  BankLoginResponse,
  BankSilentAlertResponse,
  EmergencyAlert
} from '@/lib/types'

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const COMPONENTS: BloodComponent[] = [
  'Whole Blood', 
  'Packed Red Cells', 
  'Fresh Frozen Plasma', 
  'Platelets', 
  'Cryoprecipitate'
]

export default function BankPortalPage() {
  const router = useRouter()
  const currentTick = useLiveTicker(1000)
  const [bankInfo, setBankInfo] = useState<BankLoginResponse | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // 1-to-1 Data states
  const [allBanks, setAllBanks] = useState<BloodBank[]>([])
  const [incomingRequests, setIncomingRequests] = useState<BloodRequest[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<BloodRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Broadcast Emergency Alert states
  const [activeEmergencyAlerts, setActiveEmergencyAlerts] = useState<EmergencyAlert[]>([])
  const [myBroadcastAlerts, setMyBroadcastAlerts] = useState<EmergencyAlert[]>([])
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [bcastBloodGroup, setBcastBloodGroup] = useState<BloodGroup>('O-')
  const [bcastComponent, setBcastComponent] = useState<BloodComponent>('Packed Red Cells')
  const [bcastUnits, setBcastUnits] = useState<number>(5)
  const [bcastNote, setBcastNote] = useState<string>('')
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [bcastSuccess, setBcastSuccess] = useState<string | null>(null)
  const [bcastError, setBcastError] = useState<string | null>(null)
  const [resolvingAlertId, setResolvingAlertId] = useState<number | null>(null)
  const [dismissingAlertId, setDismissingAlertId] = useState<number | null>(null)

  // Silent Alert states
  const [silentAlert, setSilentAlert] = useState<BankSilentAlertResponse | null>(null)
  const [showSilentAlertModal, setShowSilentAlertModal] = useState(false)
  const [isAcknowledging, setIsAcknowledging] = useState(false)

  // 1-to-1 Form states
  const [targetBankId, setTargetBankId] = useState<string>('')
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+')
  const [component, setComponent] = useState<BloodComponent>('Whole Blood')
  const [units, setUnits] = useState<number>(2)
  const [note, setNote] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Action states
  const [respondingId, setRespondingId] = useState<number | null>(null)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)

  // Verify authentication
  useEffect(() => {
    const token = getStoredBankToken()
    const info = getStoredBankInfo()
    if (!token || !info) {
      router.replace('/bank/login')
      return
    }
    setBankInfo(info)
    setIsAuthenticated(true)
  }, [router])

  // Load all regular portal data
  const loadPortalData = useCallback(async () => {
    try {
      const [banksData, incomingData, outgoingData, silentAlertData, myBroadcastsData] = await Promise.all([
        api.bloodBanks(),
        api.getIncomingBloodRequests(),
        api.getOutgoingBloodRequests(),
        api.getBankSilentAlert().catch(() => ({ has_alert: false })),
        api.getMyBroadcastAlerts().catch(() => []),
      ])

      setAllBanks(banksData)
      setIncomingRequests(incomingData)
      setOutgoingRequests(outgoingData)
      setSilentAlert(silentAlertData)
      setMyBroadcastAlerts(myBroadcastsData)

      // Set default target bank (first other bank)
      const currentBankId = getStoredBankInfo()?.bank_id
      const otherBanks = banksData.filter((b) => b.id !== currentBankId)
      if (otherBanks.length > 0 && !targetBankId) {
        setTargetBankId(String(otherBanks[0].id))
      }

      // Check for pending incoming requests to show modal once per session
      const pendingIncoming = incomingData.filter((r) => r.status === 'pending')
      const modalShown = typeof window !== 'undefined' ? sessionStorage.getItem('vitals_incoming_modal_shown') : null
      if (pendingIncoming.length > 0 && !modalShown) {
        setShowEmergencyModal(true)
        sessionStorage.setItem('vitals_incoming_modal_shown', 'true')
      }

      // Check for silent bank alert
      const silentAlertDismissed = typeof window !== 'undefined' ? sessionStorage.getItem('vitals_silent_alert_dismissed') : null
      if (silentAlertData?.has_alert && !silentAlertDismissed) {
        setShowSilentAlertModal(true)
      }
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.toLowerCase().includes('unauthorized')) {
        removeStoredBankSession()
        router.replace('/bank/login')
      }
    } finally {
      setIsLoading(false)
    }
  }, [router, targetBankId])

  // Dedicated 30-Second Polling for Active Broadcast Alerts
  const loadActiveEmergencyAlerts = useCallback(async () => {
    try {
      const activeAlerts = await api.getActiveEmergencyAlerts()
      setActiveEmergencyAlerts(activeAlerts)
    } catch {
      // Ignore polling errors gracefully
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadPortalData()
      loadActiveEmergencyAlerts()

      // 7-second refresh for general portal data
      const generalInterval = setInterval(loadPortalData, 7000)
      // 30-second near-real-time polling for incoming broadcast emergency alerts
      const emergencyInterval = setInterval(loadActiveEmergencyAlerts, 30000)

      return () => {
        clearInterval(generalInterval)
        clearInterval(emergencyInterval)
      }
    }
  }, [isAuthenticated, loadPortalData, loadActiveEmergencyAlerts])

  const handleAcknowledgeSilentAlert = async () => {
    setIsAcknowledging(true)
    try {
      await api.acknowledgeSilentAlert()
      sessionStorage.setItem('vitals_silent_alert_dismissed', 'true')
      setShowSilentAlertModal(false)
      setSilentAlert({ has_alert: false })
    } catch {
      setShowSilentAlertModal(false)
    } finally {
      setIsAcknowledging(false)
    }
  }

  // Dismiss / Acknowledge incoming broadcast alert
  const handleDismissEmergencyAlert = async (alertId: number) => {
    setDismissingAlertId(alertId)
    try {
      await api.acknowledgeEmergencyAlert(alertId)
      setActiveEmergencyAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch {
      // Ignore
    } finally {
      setDismissingAlertId(null)
    }
  }

  // Create Broadcast Alert
  const handleCreateBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsBroadcasting(true)
    setBcastError(null)
    setBcastSuccess(null)

    try {
      const newAlert = await api.createEmergencyAlert({
        blood_group: bcastBloodGroup,
        component: bcastComponent,
        units: bcastUnits,
        note: bcastNote.trim() || undefined,
      })

      setBcastSuccess(`Broadcast alert ${newAlert.reference_id} sent to all registered centres!`)
      setBcastNote('')
      setMyBroadcastAlerts((prev) => [newAlert, ...prev])
      setTimeout(() => {
        setShowBroadcastModal(false)
        setBcastSuccess(null)
      }, 2000)
    } catch (err: any) {
      setBcastError(err.message || 'Failed to broadcast emergency alert')
    } finally {
      setIsBroadcasting(false)
    }
  }

  // Resolve Broadcast Alert (Originating Bank Only)
  const handleResolveBroadcastAlert = async (alertId: number) => {
    setResolvingAlertId(alertId)
    try {
      const res = await api.resolveEmergencyAlert(alertId)
      setMyBroadcastAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? res.alert : a))
      )
    } catch (err: any) {
      alert(err.message || 'Failed to resolve broadcast alert.')
    } finally {
      setResolvingAlertId(null)
    }
  }

  const handleLogout = () => {
    removeStoredBankSession()
    router.replace('/bank/login')
  }

  // 1-to-1 Request Handlers
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetBankId) return

    setIsSubmitting(true)
    setFormError(null)
    setRequestSuccess(null)

    try {
      const result = await api.createBloodRequest({
        target_bank_id: parseInt(targetBankId, 10),
        blood_group: bloodGroup,
        component: component,
        units: units,
        note: note.trim() || undefined,
      })

      setRequestSuccess(`Emergency requisition ${result.reference_id} sent to ${result.target_bank_name}!`)
      setNote('')
      setOutgoingRequests((prev) => [result, ...prev])
    } catch (err: any) {
      setFormError(err.message || 'Failed to send emergency blood request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRespond = async (requestId: number, newStatus: 'accepted' | 'declined') => {
    setRespondingId(requestId)
    try {
      const updated = await api.respondToBloodRequest(requestId, newStatus)
      setIncomingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? updated : r))
      )
    } catch (err: any) {
      alert(err.message || 'Failed to update request')
    } finally {
      setRespondingId(null)
    }
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6 bg-light-bg">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-light-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-semibold">Authenticating portal session…</p>
        </div>
      </div>
    )
  }

  const pendingIncomingCount = incomingRequests.filter((r) => r.status === 'pending').length
  const otherBanks = allBanks.filter((b) => b.id !== bankInfo?.bank_id)
  const activeMyBroadcasts = myBroadcastAlerts.filter((a) => a.status === 'active')

  return (
    <div className="min-h-[calc(100vh-56px)] bg-light-bg py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-red-50 text-light-accent border border-red-200 rounded-2xl flex items-center justify-center text-3xl font-black shrink-0 shadow-xs">
              🏥
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {bankInfo?.bank_ref_code}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Portal Session
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-light-navy tracking-tight">
                {bankInfo?.bank_name}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Location: <strong className="text-slate-700">{bankInfo?.city || 'Registered Centre'}</strong> · Emergency B2B Transfer Channel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-end md:self-center">
            {/* Prominent Broadcast Emergency Alert Button */}
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="text-xs font-bold bg-light-accent hover:bg-red-700 text-white px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5 active:scale-95 btn-interactive pulse-accent-glow"
            >
              <span>🚨</span>
              <span>Broadcast Alert</span>
            </button>

            {silentAlert?.has_alert && (
              <button
                type="button"
                onClick={() => setShowSilentAlertModal(true)}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 animate-pulse btn-interactive"
              >
                <span>⚠️</span>
                <span>24h Supply Alert</span>
              </button>
            )}
            {pendingIncomingCount > 0 && (
              <button
                type="button"
                onClick={() => setShowEmergencyModal(true)}
                className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 animate-bounce btn-interactive"
              >
                <span>🔔</span>
                <span>{pendingIncomingCount} Incoming Alert{pendingIncomingCount > 1 ? 's' : ''}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold text-slate-600 hover:text-light-accent bg-slate-100 hover:bg-red-50 border border-slate-200 px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 active:scale-95 shadow-2xs btn-interactive"
            >
              <span>Logout</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Incoming Broadcast Emergency Alerts Banner (If Active) */}
        {activeEmergencyAlerts.length > 0 && (
          <div className="bg-red-50 border-2 border-light-accent/80 rounded-2xl p-6 shadow-md space-y-4 animate-slideUp">
            <div className="flex items-center justify-between border-b border-red-200 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-light-accent text-white flex items-center justify-center text-lg font-black animate-pulse">
                  🚨
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-red-950 uppercase tracking-tight">
                    Active Emergency Broadcast Alert ({activeEmergencyAlerts.length})
                  </h2>
                  <p className="text-xs text-red-800">
                    System-wide urgent requirement broadcast to all centres.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activeEmergencyAlerts.map((alertItem) => (
                <div
                  key={alertItem.id}
                  className="bg-white border border-red-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                        {alertItem.reference_id}
                      </span>
                      <span className="text-xs font-bold text-light-navy">
                        From: <strong>{alertItem.source_bank_name}</strong> ({alertItem.source_bank_city || 'City'})
                      </span>
                      {alertItem.source_bank_ref_code && (
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          [{alertItem.source_bank_ref_code}]
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-light-accent">
                      Demanded: {alertItem.units} units of {alertItem.blood_group} ({alertItem.component})
                    </p>
                    {alertItem.note && (
                      <p className="text-xs text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-200">
                        &ldquo;{alertItem.note}&rdquo;
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Broadcast {formatLiveRelativeTime(alertItem.created_at, currentTick)}
                      {alertItem.source_bank_phone && ` · Contact Phone: ${alertItem.source_bank_phone}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {alertItem.source_bank_phone && (
                      <a
                        href={`tel:${alertItem.source_bank_phone}`}
                        className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-all btn-interactive"
                      >
                        📞 Call Centre
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={dismissingAlertId === alertItem.id}
                      onClick={() => handleDismissEmergencyAlert(alertItem.id)}
                      className="text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50 px-3.5 py-1.5 rounded-lg shadow-xs transition-all btn-interactive"
                    >
                      {dismissingAlertId === alertItem.id ? 'Dismissing…' : 'Dismiss Alert'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Grid: Request Form / Broadcasts + Incoming & Outgoing Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Broadcast Action + Request Blood Form (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Primary Action: Broadcast Emergency Alert Card */}
            <div className="bg-gradient-to-br from-red-50 via-white to-red-50/30 border-2 border-red-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🚨</span>
                <div>
                  <h2 className="text-base font-black text-light-navy tracking-tight">
                    BROADCAST EMERGENCY ALERT
                  </h2>
                  <p className="text-xs text-slate-500">
                    Notify all registered blood centres in the network at once.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="w-full bg-light-accent hover:bg-red-700 text-white font-bold text-xs tracking-widest uppercase py-3.5 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 btn-interactive pulse-accent-glow"
              >
                <span>🚨</span>
                <span>Broadcast Emergency Alert (All Centres)</span>
              </button>

              {/* My Active Broadcasts Section */}
              {activeMyBroadcasts.length > 0 && (
                <div className="pt-2 border-t border-red-100 space-y-2.5">
                  <p className="text-[11px] font-bold text-red-900 uppercase tracking-widest">
                    Your Active Broadcasts ({activeMyBroadcasts.length})
                  </p>
                  <div className="space-y-2">
                    {activeMyBroadcasts.map((myAlert) => (
                      <div
                        key={myAlert.id}
                        className="bg-white border border-red-200 rounded-xl p-3 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-light-navy">
                            {myAlert.reference_id}
                          </span>
                          <span className="text-[10px] font-bold text-light-accent bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            ● Active Broadcast
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">
                          {myAlert.units} units of {myAlert.blood_group} ({myAlert.component})
                        </p>
                        {myAlert.note && (
                          <p className="text-[11px] text-slate-500 italic">
                            &ldquo;{myAlert.note}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-slate-400">
                            {formatLiveRelativeTime(myAlert.created_at, currentTick)}
                          </span>
                          <button
                            type="button"
                            disabled={resolvingAlertId === myAlert.id}
                            onClick={() => handleResolveBroadcastAlert(myAlert.id)}
                            className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg shadow-xs transition-all btn-interactive"
                          >
                            {resolvingAlertId === myAlert.id ? 'Resolving…' : '✓ Mark Resolved'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 1-to-1 Blood Request Form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-light-navy uppercase tracking-widest">
                  One-to-One Requisition
                </span>
                <h2 className="text-lg font-black text-light-navy tracking-tight">
                  REQUEST BLOOD FROM CENTRE
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send a direct formal requisition to a single neighboring blood bank.
                </p>
              </div>

              {requestSuccess && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-xs text-emerald-800 space-y-1 animate-fadeIn">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Request Dispatched</span>
                  </p>
                  <p>{requestSuccess}</p>
                </div>
              )}

              {formError && (
                <div className="bg-red-50 border border-light-accent/30 rounded-xl p-3.5 text-xs text-light-accent flex items-start gap-2 animate-fadeIn">
                  <span className="font-bold">⚠</span>
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSendRequest} className="space-y-5">
                {/* 1. Target Blood Bank */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    1. Target Blood Centre
                  </label>
                  {otherBanks.length === 0 ? (
                    <p className="text-xs text-slate-400">No other registered blood banks found.</p>
                  ) : (
                    <select
                      value={targetBankId}
                      onChange={(e) => setTargetBankId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-3 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                      required
                    >
                      {otherBanks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} — {b.city || 'Registered Centre'} ({b.bank_ref_code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Blood Group Pills */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    2. Blood Group Required
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BLOOD_GROUPS.map((bg) => (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBloodGroup(bg)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all duration-150 pill-interactive ${
                          bloodGroup === bg
                            ? 'bg-light-accent text-white border-light-accent shadow-xs scale-[1.02]'
                            : 'bg-white text-light-navy border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Component */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    3. Blood Component
                  </label>
                  <select
                    value={component}
                    onChange={(e) => setComponent(e.target.value as BloodComponent)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 text-xs font-medium focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                  >
                    {COMPONENTS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Units Needed */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    4. Quantity Needed (Units)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={units}
                      onChange={(e) => setUnits(Math.max(1, parseInt(e.target.value || '1', 10)))}
                      className="w-24 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-black text-center bg-white text-slate-900 focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                      required
                    />
                    <span className="text-xs text-slate-500 font-medium">
                      Units of {bloodGroup} {component}
                    </span>
                  </div>
                </div>

                {/* 5. Optional Note */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    5. Clinical Note / Urgency (Optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Critical trauma unit in OT 2, needed within 2 hours"
                    rows={2}
                    className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-white text-slate-900 focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !targetBankId}
                  className="w-full bg-light-navy hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs tracking-widest uppercase py-3.5 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 btn-interactive"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Transmitting Requisition…</span>
                    </>
                  ) : (
                    <span>Send Requisition to Target Centre →</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Incoming & Outgoing Requests (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Section 2: Incoming Requests */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-light-navy tracking-tight flex items-center gap-2">
                    <span>INCOMING REQUESTS TO THIS CENTRE</span>
                    {pendingIncomingCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {pendingIncomingCount} Action Required
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Requisitions sent by other hospitals and blood banks directed to you.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {incomingRequests.length} Total
                </span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading incoming requests…</div>
              ) : incomingRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                  <p className="text-xs font-bold text-slate-600">No incoming blood requests</p>
                  <p className="text-[11px] text-slate-400">Your centre currently has no pending requests from partner hospitals.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((req) => (
                    <div 
                      key={req.id}
                      className={`border rounded-xl p-4 transition-all ${
                        req.status === 'pending'
                          ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                          : req.status === 'accepted'
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-slate-50/50 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-light-navy bg-white px-2 py-0.5 rounded border border-slate-200">
                              {req.reference_id}
                            </span>
                            <span className="text-xs font-bold text-light-navy">
                              From: {req.requesting_bank_name} ({req.requesting_bank_city || 'City'})
                            </span>
                            {req.requesting_bank_ref_code && (
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                [{req.requesting_bank_ref_code}]
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-light-accent mt-1">
                            Demanded: {req.units} units of {req.blood_group} ({req.component})
                          </p>
                          {req.note && (
                            <p className="text-xs text-slate-600 mt-1 italic bg-white/70 p-1.5 rounded border border-slate-100">
                              &ldquo;{req.note}&rdquo;
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1.5">
                            Received {formatLiveRelativeTime(req.created_at, currentTick)}
                            {req.requesting_bank_phone && ` · Contact: ${req.requesting_bank_phone}`}
                          </p>
                        </div>

                        {/* Status & Response Buttons */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {req.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={respondingId === req.id}
                                onClick={() => handleRespond(req.id, 'accepted')}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 flex items-center gap-1 active:scale-95 btn-interactive"
                              >
                                <span>✓</span>
                                <span>Accept</span>
                              </button>
                              <button
                                type="button"
                                disabled={respondingId === req.id}
                                onClick={() => handleRespond(req.id, 'declined')}
                                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs hover:shadow-md transition-all duration-200 flex items-center gap-1 active:scale-95 btn-interactive"
                              >
                                <span>✕</span>
                                <span>Decline</span>
                              </button>
                            </div>
                          ) : (
                            <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                              req.status === 'accepted'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              ● {req.status}
                            </span>
                          )}
                          {req.responded_at && (
                            <span className="text-[10px] text-slate-400">
                              Responded {formatLiveRelativeTime(req.responded_at, currentTick)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Outgoing Requests */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-light-navy tracking-tight">
                    OUTGOING REQUISITIONS DISPATCHED
                  </h2>
                  <p className="text-xs text-slate-500">
                    Emergency blood requests your centre has sent to partner centres.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {outgoingRequests.length} Total
                </span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading outgoing requests…</div>
              ) : outgoingRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                  <p className="text-xs font-bold text-slate-600">No outgoing requests sent yet</p>
                  <p className="text-[11px] text-slate-400">Use the form on the left to request blood from another bank in an emergency.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-light-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {req.reference_id}
                            </span>
                            <span className="text-xs font-bold text-light-navy">
                              To: {req.target_bank_name} ({req.target_bank_city || 'City'})
                            </span>
                          </div>
                          <p className="text-xs font-bold text-light-navy mt-1">
                            Requested: {req.units} units of {req.blood_group} ({req.component})
                          </p>
                          {req.note && (
                            <p className="text-xs text-slate-500 mt-1 italic">
                              &ldquo;{req.note}&rdquo;
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-1">
                            Sent {formatLiveRelativeTime(req.created_at, currentTick)}
                            {req.target_bank_phone && ` · Contact: ${req.target_bank_phone}`}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                            req.status === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : req.status === 'declined'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          }`}>
                            ● {req.status}
                          </span>
                          {req.responded_at && (
                            <span className="text-[10px] text-slate-400">
                              {req.status === 'accepted' ? 'Accepted' : 'Declined'} {formatLiveRelativeTime(req.responded_at, currentTick)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Emergency Alert Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-navy/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border-2 border-red-300 rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-red-100 text-light-accent flex items-center justify-center text-xl font-black shadow-2xs">
                  🚨
                </span>
                <div>
                  <h3 className="text-lg font-black text-light-navy tracking-tight">
                    BROADCAST EMERGENCY ALERT
                  </h3>
                  <p className="text-xs text-slate-500">
                    Instantly notifies ALL registered blood centres simultaneously.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-base rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {bcastSuccess && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-xs text-emerald-800 space-y-1 animate-fadeIn">
                <p className="font-bold flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Broadcast Dispatched</span>
                </p>
                <p>{bcastSuccess}</p>
              </div>
            )}

            {bcastError && (
              <div className="bg-red-50 border border-light-accent/30 rounded-xl p-3.5 text-xs text-light-accent flex items-start gap-2 animate-fadeIn">
                <span className="font-bold">⚠</span>
                <span>{bcastError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBroadcastAlert} className="space-y-4">
              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Blood Group Required
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {BLOOD_GROUPS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBcastBloodGroup(bg)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all duration-150 pill-interactive ${
                        bcastBloodGroup === bg
                          ? 'bg-light-accent text-white border-light-accent shadow-xs scale-[1.02]'
                          : 'bg-white text-light-navy border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Component */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Blood Component
                </label>
                <select
                  value={bcastComponent}
                  onChange={(e) => setBcastComponent(e.target.value as BloodComponent)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 text-xs font-medium focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                >
                  {COMPONENTS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Units */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Quantity Needed (Units)
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={bcastUnits}
                  onChange={(e) => setBcastUnits(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-black bg-white text-slate-900 focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                  required
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Urgency Note / Hospital Context (Optional)
                </label>
                <textarea
                  value={bcastNote}
                  onChange={(e) => setBcastNote(e.target.value)}
                  placeholder="e.g. Mass-casualty incident, urgent O-negative needed for multiple surgeries."
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-white text-slate-900 focus:outline-none focus:border-light-navy focus:ring-2 focus:ring-light-navy/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="bg-light-accent hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase px-6 py-3 rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all duration-200 flex items-center gap-2 btn-interactive"
                >
                  {isBroadcasting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Broadcasting…</span>
                    </>
                  ) : (
                    <span>🚨 Broadcast Alert Now</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incoming Requests Attention Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-navy/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border-2 border-amber-400 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
                🔔
              </div>
              <div>
                <h3 className="font-bold text-light-navy text-base">
                  Incoming Blood Requests ({pendingIncomingCount})
                </h3>
                <p className="text-xs text-slate-500">
                  Partner centres are requesting blood units from your bank.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {incomingRequests
                .filter((r) => r.status === 'pending')
                .map((req) => (
                  <div key={req.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-bold text-light-navy">
                      {req.requesting_bank_name} ({req.requesting_bank_city || 'City'})
                    </p>
                    <p className="text-xs font-black text-light-accent">
                      Demanded: {req.units} units of {req.blood_group} ({req.component})
                    </p>
                    {req.note && (
                      <p className="text-[11px] text-slate-500 italic">
                        &ldquo;{req.note}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="w-full bg-light-navy hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl transition-colors"
              >
                Review Requests in Portal →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Silent Bank Inventory Reminder Modal */}
      {showSilentAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-navy/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border-2 border-amber-400 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl font-bold shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-light-navy text-base">
                  Inventory Update Required
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your centre hasn&apos;t reported stock in over 24 hours.
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-950">
              <p className="font-semibold">
                Central Health Logistics Telemetry Alert
              </p>
              <p className="text-amber-900 leading-relaxed text-[11px]">
                Health coordinators have flagged this centre as silent. Please update your current stock levels via the Reporter view or SMS gateway to maintain verified public availability.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <Link
                href="/report"
                className="w-full sm:w-auto text-center bg-light-accent hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                Report Stock Now →
              </Link>
              <button
                type="button"
                disabled={isAcknowledging}
                onClick={handleAcknowledgeSilentAlert}
                className="w-full sm:w-auto text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                {isAcknowledging ? 'Acknowledging…' : 'I Understand · Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
