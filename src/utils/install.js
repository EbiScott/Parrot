export function isStandalone({
  displayModeStandalone = typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches,
  navigatorStandalone = typeof navigator !== 'undefined' && navigator.standalone === true,
} = {}) {
  return Boolean(displayModeStandalone || navigatorStandalone)
}

export function detectInstallPlatform(userAgent = '') {
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  if (/android/i.test(userAgent)) return 'android'
  return 'desktop'
}

export function installInstructions(platform) {
  if (platform === 'ios') {
    return {
      title: 'Add Parrot to your Home Screen',
      steps: [
        'Open Parrot in Safari.',
        'Tap the Share button.',
        'Choose “Add to Home Screen”, then tap Add.',
      ],
    }
  }

  if (platform === 'android') {
    return {
      title: 'Install Parrot',
      steps: [
        'Open the browser menu.',
        'Choose “Install app” or “Add to Home screen”.',
        'Confirm the install.',
      ],
    }
  }

  return {
    title: 'Install Parrot',
    steps: [
      'Open Parrot over HTTPS in Chrome or Edge.',
      'Use the install icon in the address bar.',
      'Or open the browser menu and choose “Install Parrot”.',
    ],
  }
}

export async function runInstallPrompt(prompt) {
  if (!prompt) return 'unavailable'

  await prompt.prompt()
  const choice = await prompt.userChoice
  return choice?.outcome || 'dismissed'
}
