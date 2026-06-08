export async function isFlagActive(flagName, environment) {
    // Mock MVP logic
    if (flagName === 'mixpanel_checkout_active') {
        return true;
    }
    return false;
}
