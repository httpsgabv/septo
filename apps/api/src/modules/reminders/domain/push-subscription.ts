import { DomainError } from '../../../shared/domain-error.js';

export const PUSH_ENDPOINT_MAX_LENGTH = 2_048;
export const P256DH_MAX_LENGTH = 256;
export const AUTH_MAX_LENGTH = 128;

type PushSubscriptionProps = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PushSubscriptionInput = Pick<
  PushSubscriptionProps,
  'endpoint' | 'p256dh' | 'auth' | 'expirationTime'
>;

export class InvalidPushSubscriptionError extends DomainError {
  readonly code = 'INVALID_PUSH_SUBSCRIPTION';
  readonly kind = 'invalid';

  constructor() {
    super('Invalid push subscription');
  }
}

export class PushSubscription {
  #props: PushSubscriptionProps;

  private constructor(props: PushSubscriptionProps) {
    this.#props = props;
  }

  static create(input: PushSubscriptionInput, now: Date) {
    assertValid(input);
    return new PushSubscription({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: PushSubscriptionProps) {
    assertValid(props);
    return new PushSubscription(props);
  }

  get id() {
    return this.#props.id;
  }
  get endpoint() {
    return this.#props.endpoint;
  }
  get p256dh() {
    return this.#props.p256dh;
  }
  get auth() {
    return this.#props.auth;
  }
  get expirationTime() {
    return this.#props.expirationTime;
  }
  get createdAt() {
    return this.#props.createdAt;
  }
  get updatedAt() {
    return this.#props.updatedAt;
  }

  /** Protects capability URLs and keys if an entity is accidentally returned by a controller. */
  toJSON() {
    return { id: this.id };
  }
}

function assertValid(input: PushSubscriptionInput) {
  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    throw new InvalidPushSubscriptionError();
  }

  if (
    input.endpoint.length > PUSH_ENDPOINT_MAX_LENGTH ||
    endpoint.protocol !== 'https:' ||
    !validBase64Url(input.p256dh, P256DH_MAX_LENGTH) ||
    !validBase64Url(input.auth, AUTH_MAX_LENGTH) ||
    (input.expirationTime !== null && Number.isNaN(input.expirationTime.getTime()))
  ) {
    throw new InvalidPushSubscriptionError();
  }
}

function validBase64Url(value: string, maxLength: number) {
  return value.length > 0 && value.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(value);
}
