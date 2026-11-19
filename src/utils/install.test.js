import { describe, expect, test, vi } from 'vitest'
import {
  detectInstallPlatform,
  installInstructions,
  isStandalone,
  runInstallPrompt,
} from './install'

describe('install helpers', () => {
  test('isStandalone recognises installed display modes', () => {
    expect(isStandalone({ displayModeStandalone: true })).toBe(true)
    expect(isStandalone({ navigatorStandalone: true })).toBe(true)
    expect(isStandalone({ displayModeStandalone: false, navigatorStandalone: false })).toBe(false)
  })

  test('detectInstallPlatform separates iPhone, Android and desktop', () => {
    expect(detectInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      'ios'
    )
    expect(detectInstallPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
    expect(detectInstallPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop')
  })

  test('installInstructions gives platform-specific steps', () => {
    expect(installInstructions('ios').steps.join(' ')).toMatch(/Share/i)
    expect(installInstructions('android').steps.join(' ')).toMatch(/menu/i)
    expect(installInstructions('desktop').steps.join(' ')).toMatch(/address bar/i)
  })

  test('runInstallPrompt reports accepted, dismissed and unavailable', async () => {
    const accepted = {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    }
    const dismissed = {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    }

    await expect(runInstallPrompt(accepted)).resolves.toBe('accepted')
    expect(accepted.prompt).toHaveBeenCalledOnce()
    await expect(runInstallPrompt(dismissed)).resolves.toBe('dismissed')
    await expect(runInstallPrompt(null)).resolves.toBe('unavailable')
  })
})
