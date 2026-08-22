import { describe, expect, it } from 'vitest'
import { resolveHubGate } from '../hubGate'

describe('resolveHubGate', () => {
  it('stays loading while auth is resolving', () => {
    expect(
      resolveHubGate({
        authLoading: true,
        hasSession: false,
        accessKnown: false,
        allowed: false,
      }),
    ).toBe('loading')
  })

  it('is signed_out without session', () => {
    expect(
      resolveHubGate({
        authLoading: false,
        hasSession: false,
        accessKnown: false,
        allowed: false,
      }),
    ).toBe('signed_out')
  })

  it('loads while allowlist check pending', () => {
    expect(
      resolveHubGate({
        authLoading: false,
        hasSession: true,
        accessKnown: false,
        allowed: false,
      }),
    ).toBe('loading')
  })

  it('authorizes allowlisted session', () => {
    expect(
      resolveHubGate({
        authLoading: false,
        hasSession: true,
        accessKnown: true,
        allowed: true,
      }),
    ).toBe('authorized')
  })

  it('denies non-allowlisted session', () => {
    expect(
      resolveHubGate({
        authLoading: false,
        hasSession: true,
        accessKnown: true,
        allowed: false,
      }),
    ).toBe('unauthorized')
  })
})
