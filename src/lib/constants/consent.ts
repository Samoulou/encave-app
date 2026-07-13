export const CONSENT_VERSION = '1';
export const CONSENT_COOKIE_NAME = 'encave_consent';

export const AGE_GATE_VERSION = '1';

// P-08 (US-220): version of the no-show policy the client accepts at checkout.
// Persisted on the booking alongside noShowFeeCentsSnapshot so the charge and
// email #13 can cite the exact terms accepted. Bump when the policy wording
// materially changes.
export const NO_SHOW_POLICY_VERSION = '1';
