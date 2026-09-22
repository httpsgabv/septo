export interface PushSubscriptionTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Web Push collapse key. It is transport metadata and is not sent to the service worker. */
  topic: string;
}

export type PushSendResult =
  | { kind: 'sent' }
  | { kind: 'gone'; statusCode: 404 | 410 }
  | { kind: 'transient'; statusCode?: number }
  | { kind: 'permanent'; statusCode: number };

export abstract class PushSender {
  abstract send(
    subscription: PushSubscriptionTarget,
    payload: PushPayload,
  ): Promise<PushSendResult>;
}
