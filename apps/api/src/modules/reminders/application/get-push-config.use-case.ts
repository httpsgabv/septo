import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../../shared/env.js';

@Injectable()
export class GetPushConfigUseCase {
  constructor(@Inject(ENV) private readonly env: Env) {}

  execute() {
    return { publicKey: this.env.VAPID_PUBLIC_KEY };
  }
}
