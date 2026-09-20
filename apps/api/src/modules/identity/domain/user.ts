import { InvalidDisplayNameError } from './errors.js';

export const DISPLAY_NAME_MAX_LENGTH = 50;

export type UserProps = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  /** Bumped to invalidate every token issued so far. */
  tokenVersion: number;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
};

export class User {
  private constructor(private props: UserProps) {}

  static create(input: { username: string; passwordHash: string }): User {
    return new User({
      id: crypto.randomUUID(),
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.username,
      tokenVersion: 0,
      lastLoginAt: null,
      lastLoginIp: null,
    });
  }

  /** Rebuilds a stored user; the data was validated when it was written. */
  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id() {
    return this.props.id;
  }
  get username() {
    return this.props.username;
  }
  get passwordHash() {
    return this.props.passwordHash;
  }
  get displayName() {
    return this.props.displayName;
  }
  get tokenVersion() {
    return this.props.tokenVersion;
  }
  get lastLoginAt() {
    return this.props.lastLoginAt;
  }
  get lastLoginIp() {
    return this.props.lastLoginIp;
  }

  rename(username: string) {
    this.props.username = username;
  }

  /** Receives an already hashed password; drops every other session. */
  changePassword(passwordHash: string) {
    this.props.passwordHash = passwordHash;
    this.revokeSessions();
  }

  revokeSessions() {
    this.props.tokenVersion += 1;
  }

  updateProfile(input: { displayName: string }) {
    const { displayName } = input;
    if (
      displayName.length < 1 ||
      displayName.length > DISPLAY_NAME_MAX_LENGTH ||
      displayName !== displayName.trim()
    ) {
      throw new InvalidDisplayNameError();
    }
    this.props.displayName = displayName;
  }

  recordLogin(ip: string, at: Date) {
    this.props.lastLoginAt = at;
    this.props.lastLoginIp = ip;
  }
}
