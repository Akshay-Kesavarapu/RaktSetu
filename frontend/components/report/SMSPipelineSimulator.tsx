'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { BloodBank, SMSWebhookResponse } from '@/lib/types'

export function SMSPipelineSimulator() {
  const [banks, setBanks] = useState<BloodBank[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [selectedRefCode, setSelectedRefCode] = useState<string>('BB007')
  const [fromNumber, setFromNumber] = useState<string>('')
  const [messageBody, setMessageBody] = useState<string>('UPDATE BB007 APOS 5')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<SMSWebhookResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadBanks() {
      try {
        const data = await api.bloodBanks()
        setBanks(data)
        if (data.length > 0) {
          const defaultBank = data.find((b) => b.bank_ref_code === 'BB007') || data[0]
          setSelectedBankId(String(defaultBank.id))
          const ref = defaultBank.bank_ref_code || `BB${String(defaultBank.id).padStart(3, '0')}`
          setSelectedRefCode(ref)
          setMessageBody(`UPDATE ${ref} APOS 5`)
          if (defaultBank.phone) setFromNumber(defaultBank.phone)
        }
      } catch {
        // Backend offline fallback defaults
      }
    }
    loadBanks()
  }, [])

  const handleBankChange = (bankId: string) => {
    setSelectedBankId(bankId)
    const bank = banks.find((b) => String(b.id) === bankId)
    if (bank) {
      const ref = bank.bank_ref_code || `BB${String(bank.id).padStart(3, '0')}`
      setSelectedRefCode(ref)
      setMessageBody(`UPDATE ${ref} APOS 5`)
      if (bank.phone) setFromNumber(bank.phone)
    }
  }

  const setPresetCommand = (group: string, units: number, hyphenated: boolean = false) => {
    const code = hyphenated 
      ? `${selectedRefCode.slice(0, 2)}-${selectedRefCode.slice(2)}` 
      : selectedRefCode
    setMessageBody(`UPDATE ${code} ${group} ${units}`)
  }

  const handleSendSMS = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResponse(null)
    setErrorMessage(null)

    try {
      const res = await api.sendSimulatedSMS({
        message_body: messageBody.trim(),
        from_number: fromNumber.trim() || undefined,
      })
      setResponse(res)
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch simulated SMS.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Simulator Description */}
      <div className="bg-light-bg border border-light-border rounded-md p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-light-navy/10 text-light-navy flex items-center justify-center shrink-0 font-mono text-sm">
          💬
        </div>
        <div className="text-xs space-y-1">
          <p className="text-light-muted leading-relaxed">
            Staff update stock via standard SMS command: <code className="bg-white px-1.5 py-0.5 rounded border border-light-border font-mono text-light-navy font-bold">UPDATE &lt;BANK_ID&gt; &lt;BLOODGROUP&gt; &lt;UNITS&gt;</code> (e.g. <code className="bg-white px-1.5 py-0.5 rounded border border-light-border font-mono text-light-navy font-bold">UPDATE BB007 APOS 5</code> or <code className="bg-white px-1.5 py-0.5 rounded border border-light-border font-mono text-light-navy font-bold">UPDATE BB-007 APOS 5</code>).
          </p>
        </div>
      </div>

      <form onSubmit={handleSendSMS} className="space-y-5">
        {/* Step 1: Select Target Blood Bank */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-light-muted uppercase tracking-widest">
            1. Target Blood Bank &amp; Reference Code
          </label>
          
          {banks.length > 0 && (
            <select
              value={selectedBankId}
              onChange={(e) => handleBankChange(e.target.value)}
              className="w-full border border-light-border rounded-md px-3 py-2 bg-light-surface text-light-body text-xs focus:outline-none focus:border-light-navy"
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.bank_ref_code || `BB${String(b.id).padStart(3, '0')}`}] {b.name} ({b.city || b.state})
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-light-muted">Active Bank Ref Code:</span>
            <span className="text-xs font-mono font-bold bg-light-navy/10 text-light-navy px-2 py-0.5 rounded">
              {selectedRefCode}
            </span>
          </div>
        </div>

        {/* Step 2: Message Body & Quick Templates */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-light-muted uppercase tracking-widest">
              2. SMS Payload (<code className="text-light-navy font-mono">message_body</code>)
            </label>
            <span className="text-[11px] text-light-muted font-mono">UPDATE &lt;BANK_ID&gt; &lt;GROUP&gt; &lt;UNITS&gt;</span>
          </div>

          {/* Quick paste pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPresetCommand('APOS', 5)}
              className="text-[11px] font-mono px-2 py-1 rounded border bg-light-bg text-light-body border-light-border hover:border-light-navy"
            >
              {selectedRefCode} A+ (5u)
            </button>
            <button
              type="button"
              onClick={() => setPresetCommand('APOS', 5, true)}
              className="text-[11px] font-mono px-2 py-1 rounded border bg-light-bg text-light-body border-light-border hover:border-light-navy"
            >
              Hyphen: {selectedRefCode.slice(0, 2)}-{selectedRefCode.slice(2)} A+ (5u)
            </button>
            <button
              type="button"
              onClick={() => setPresetCommand('OPOS', 12)}
              className="text-[11px] font-mono px-2 py-1 rounded border bg-light-bg text-light-body border-light-border hover:border-light-navy"
            >
              {selectedRefCode} O+ (12u)
            </button>
            <button
              type="button"
              onClick={() => setPresetCommand('BNEG', 3)}
              className="text-[11px] font-mono px-2 py-1 rounded border bg-light-bg text-light-body border-light-border hover:border-light-navy"
            >
              {selectedRefCode} B- (3u)
            </button>
            <button
              type="button"
              onClick={() => setMessageBody('UPDATE BB999 APOS 5')}
              className="text-[11px] font-mono px-2 py-1 rounded border bg-red-50 text-red-700 border-red-200 hover:border-red-400"
            >
              Test Invalid Bank (BB999)
            </button>
          </div>

          <input
            type="text"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="UPDATE BB007 APOS 5"
            className="w-full border border-light-border rounded-md px-3 py-2.5 bg-light-surface text-light-body text-base font-mono font-bold focus:outline-none focus:border-light-navy"
            required
          />

          <div className="bg-light-bg/60 border border-light-border rounded p-2.5 text-[11px] text-light-muted space-y-1">
            <p className="font-semibold text-light-navy">Supported Blood Group Codes:</p>
            <p className="font-mono text-[10px] text-light-body">
              APOS (A+) · ANEG (A-) · BPOS (B+) · BNEG (B-) · OPOS (O+) · ONEG (O-) · ABPOS (AB+) · ABNEG (AB-)
            </p>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-light-accent text-white font-bold text-sm tracking-widest py-3 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity uppercase flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Dispatching Webhook…
            </>
          ) : (
            <>
              <span>✉</span>
              Send SMS Update
            </>
          )}
        </button>
      </form>

      {/* Response Display Area */}
      {response && (
        <div className="bg-light-success/5 border border-light-success rounded-md p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-light-success">
              <span className="w-2 h-2 rounded-full bg-light-success" />
              SMS Webhook: HTTP 200 OK
            </span>
            <span className="text-[10px] font-mono font-bold bg-light-success/15 text-light-success px-2 py-0.5 rounded">
              Ref: {response.bank_ref_code}
            </span>
          </div>

          <p className="text-sm font-semibold text-light-navy">{response.message}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-light-success/20 text-xs">
            <div>
              <span className="text-light-muted block text-[10px]">Blood Bank</span>
              <span className="font-bold text-light-navy truncate block">{response.bank_name}</span>
            </div>
            <div>
              <span className="text-light-muted block text-[10px]">Group / Comp</span>
              <span className="font-bold text-light-navy">{response.blood_group} ({response.component?.split(' ')[0]})</span>
            </div>
            <div>
              <span className="text-light-muted block text-[10px]">Added Units</span>
              <span className="font-bold text-light-success text-sm">+{response.units} units</span>
            </div>
            <div>
              <span className="text-light-muted block text-[10px]">Update ID</span>
              <span className="font-mono text-light-navy">#{response.update_id}</span>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-light-accent rounded-md p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-light-accent">
            <span>⚠</span>
            <span>SMS Webhook Rejected</span>
          </div>
          <p className="text-xs text-light-body font-mono leading-relaxed">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
