export async function isFlagActive(flagName: string, environment: string): Promise<boolean> {
  // Mock MVP logic
  if (flagName === 'mixpanel_checkout_active') {
    return true
  }
  
  return false
}
