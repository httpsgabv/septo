export type PushUiState = 'unsupported' | 'default' | 'denied' | 'enabled';
export type PushPermission = 'default' | 'denied' | 'granted';

export function supportsWebPush(features: {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
}) {
  return features.serviceWorker && features.pushManager && features.notification;
}

export function resolvePushState(input: {
  supported: boolean;
  permission: PushPermission;
  hasSubscription: boolean;
}): PushUiState {
  if (!input.supported) return 'unsupported';
  if (input.permission === 'denied') return 'denied';
  if (input.permission === 'granted' && input.hasSubscription) return 'enabled';
  return 'default';
}
