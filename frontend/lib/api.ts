import type { 
  BloodBank, SearchResponse, StockUpdatePayload, 
  StockUpdateResponse, StatsResponse, CoverageResponse,
  BloodGroup, BloodComponent, SMSWebhookPayload, SMSWebhookResponse, ActivityEvent,
  BloodRequest, BloodRequestPayload, BankLoginResponse,
  FlagSilentBanksResponse, BankSilentAlertResponse, AcknowledgeAlertResponse
} from './types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

export const AUTH_ADMIN_TOKEN_KEY = 'vitals_admin_jwt_token'
export const AUTH_BANK_TOKEN_KEY = 'vitals_bank_jwt_token'
export const AUTH_BANK_INFO_KEY = 'vitals_bank_session_info'

// Admin Token Utilities
export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(AUTH_ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredAdminToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTH_ADMIN_TOKEN_KEY, token)
  } catch {
    // Ignore storage failure
  }
}

export function removeStoredAdminToken(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AUTH_ADMIN_TOKEN_KEY)
  } catch {
    // Ignore storage failure
  }
}

// Bank Portal Token Utilities
export function getStoredBankToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(AUTH_BANK_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredBankInfo(): BankLoginResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(AUTH_BANK_INFO_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function setStoredBankSession(session: BankLoginResponse): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTH_BANK_TOKEN_KEY, session.token)
    localStorage.setItem(AUTH_BANK_INFO_KEY, JSON.stringify(session))
  } catch {
    // Ignore storage failure
  }
}

export function removeStoredBankSession(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(AUTH_BANK_TOKEN_KEY)
    localStorage.removeItem(AUTH_BANK_INFO_KEY)
    sessionStorage.removeItem('vitals_incoming_modal_shown')
  } catch {
    // Ignore storage failure
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders: Record<string, string> = {}

  // Route-aware token injection to prevent token collisions
  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const adminToken = getStoredAdminToken()
    if (adminToken) {
      authHeaders['Authorization'] = `Bearer ${adminToken}`
    }
  } else if (path.startsWith('/bank') && !path.startsWith('/bank/login')) {
    const bankToken = getStoredBankToken()
    if (bankToken) {
      authHeaders['Authorization'] = `Bearer ${bankToken}`
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { 
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers 
    },
    ...options,
  })
  
  if (!res.ok) {
    let errorDetail = `API error ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson.error || errJson.message || errJson.detail) {
        errorDetail = errJson.error || errJson.message || (typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail))
      }
    } catch {
      errorDetail = await res.text()
    }
    throw new Error(errorDetail)
  }
  return res.json()
}

export const api = {
  health: () => request<{status: string, timestamp: string}>('/health'),
  
  // Admin Auth
  adminLogin: (credentials: { username: string; password: string }) =>
    request<{ token: string; username: string; message: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  // Bank Portal Auth
  bankLogin: (credentials: { bank_identifier: string }) =>
    request<BankLoginResponse>('/bank/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getBankMe: () => request<BloodBank>('/bank/me'),

  // Emergency Blood Requests
  createBloodRequest: (payload: BloodRequestPayload) =>
    request<BloodRequest>('/bank/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getIncomingBloodRequests: () =>
    request<BloodRequest[]>('/bank/requests/incoming'),

  getOutgoingBloodRequests: () =>
    request<BloodRequest[]>('/bank/requests/outgoing'),

  respondToBloodRequest: (requestId: number, status: 'accepted' | 'declined') =>
    request<BloodRequest>(`/bank/requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  bloodBanks: (params?: {city?: string, state?: string}) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return request<BloodBank[]>(`/blood-banks${q ? '?' + q : ''}`)
  },
  
  updateStock: (payload: StockUpdatePayload) =>
    request<StockUpdateResponse>('/stock/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  lookupStock: (referenceId: string) =>
    request<import('./types').StockLookupResponse>(`/stock/lookup/${encodeURIComponent(referenceId)}`),

  correctStock: (payload: import('./types').StockCorrectionPayload) =>
    request<import('./types').StockCorrectionResponse>('/stock/correct', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendSimulatedSMS: (payload: SMSWebhookPayload) =>
    request<SMSWebhookResponse>('/sms/webhook', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    
  searchStock: (params: {lat: number, lon: number, blood_group?: BloodGroup, component?: BloodComponent, radius_km?: number}) => {
    const validParams = Object.fromEntries(
      Object.entries(params).filter(([,v]) => v !== undefined && v !== null && String(v) !== '')
    )
    const q = new URLSearchParams(validParams as Record<string, string>).toString()
    return request<SearchResponse>(`/stock/search?${q}`)
  },
  
  getPublicStats: () => request<StatsResponse>('/public-stats'),
  getStats: () => request<StatsResponse>('/admin/stats'),
  getCoverage: () => request<CoverageResponse>('/admin/coverage'),
  getActivity: (limit: number = 15) => request<ActivityEvent[]>(`/admin/activity?limit=${limit}`),
  flagSilentBanks: () =>
    request<FlagSilentBanksResponse>('/admin/flag-silent-banks', {
      method: 'POST',
    }),

  // Bank Portal Silent Alerts
  getBankSilentAlert: () =>
    request<BankSilentAlertResponse>('/bank/silent-alert'),

  acknowledgeSilentAlert: () =>
    request<AcknowledgeAlertResponse>('/bank/silent-alert/acknowledge', {
      method: 'POST',
    }),

  // Bank Portal Broadcast Emergency Alerts
  createEmergencyAlert: (payload: import('./types').EmergencyAlertPayload) =>
    request<import('./types').EmergencyAlert>('/bank/emergency-alert', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getActiveEmergencyAlerts: () =>
    request<import('./types').EmergencyAlert[]>('/bank/emergency-alerts/active'),

  getMyBroadcastAlerts: () =>
    request<import('./types').EmergencyAlert[]>('/bank/emergency-alerts/my-broadcasts'),

  acknowledgeEmergencyAlert: (alertId: number) =>
    request<import('./types').EmergencyAlertAcknowledgeResponse>(`/bank/emergency-alert/${alertId}/acknowledge`, {
      method: 'POST',
    }),

  resolveEmergencyAlert: (alertId: number) =>
    request<import('./types').EmergencyAlertResolveResponse>(`/bank/emergency-alert/${alertId}/resolve`, {
      method: 'POST',
    }),
}

