import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import { AuthConfig } from '../../config/auth.config';

/** Hashes this service can recognise when verifying. */
const ARGON2ID_PREFIX = '$argon2id$';
const BCRYPT_PREFIX = /^\$2[aby]\$/;

/** Cost settings, in the shape `@node-rs/argon2` expects. */
export type Argon2Costs = Pick<
  AuthConfig,
  'argon2MemoryCost' | 'argon2TimeCost' | 'argon2Parallelism'
>;

/**
 * Exported so the standalone seeder, which runs outside the Nest container and
 * cannot inject this service, still hashes at exactly the configured cost.
 */
export function argon2OptionsFrom(cfg: Argon2Costs) {
  return {
    algorithm: Algorithm.Argon2id,
    memoryCost: cfg.argon2MemoryCost,
    timeCost: cfg.argon2TimeCost,
    parallelism: cfg.argon2Parallelism,
  };
}

/**
 * Password hashing, and the migration off the algorithm that came before it.
 *
 * New hashes are Argon2id at the OWASP-recommended parameters. Existing hashes
 * are bcrypt, and a password hash is one-way — there is no batch migration that
 * could rewrite them, because the plaintext is not recoverable. So verification
 * accepts either format and reports whether the stored hash is stale; the only
 * moment a bcrypt hash can be upgraded is the one moment the plaintext is in
 * memory, which is a successful login.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(private readonly config: ConfigService) {}

  private get authCfg(): AuthConfig {
    return this.config.get<AuthConfig>('auth')!;
  }

  private get argon2Options() {
    return argon2OptionsFrom(this.authCfg);
  }

  hash(plain: string): Promise<string> {
    return argon2Hash(plain, this.argon2Options);
  }

  /**
   * Verify a password against a stored hash of either supported format.
   *
   * Returns false rather than throwing on a malformed or unrecognised hash: a
   * corrupt row must fail the login, not crash the request and disclose that
   * this particular account is different from the others.
   */
  async verify(storedHash: string, plain: string): Promise<boolean> {
    try {
      if (storedHash.startsWith(ARGON2ID_PREFIX)) {
        return await argon2Verify(storedHash, plain, this.argon2Options);
      }
      if (BCRYPT_PREFIX.test(storedHash)) {
        return await bcrypt.compare(plain, storedHash);
      }
      this.logger.error('Stored password hash is in an unrecognised format');
      return false;
    } catch (err) {
      this.logger.error(`Password verification failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return false;
    }
  }

  /**
   * Whether a hash that just verified should be replaced.
   *
   * True for every bcrypt hash, and for an Argon2id hash weaker than the
   * parameters currently configured — raising the cost factor is only a real
   * upgrade if existing accounts eventually move up to it.
   */
  needsRehash(storedHash: string): boolean {
    if (!storedHash.startsWith(ARGON2ID_PREFIX)) return true;

    const params = this.parseArgon2Params(storedHash);
    if (!params) return true;

    return (
      params.memoryCost < this.authCfg.argon2MemoryCost ||
      params.timeCost < this.authCfg.argon2TimeCost ||
      params.parallelism < this.authCfg.argon2Parallelism
    );
  }

  /** Pull `m`, `t` and `p` out of a PHC-format Argon2 hash string. */
  private parseArgon2Params(
    storedHash: string,
  ): { memoryCost: number; timeCost: number; parallelism: number } | null {
    // $argon2id$v=19$m=19456,t=2,p=1$<salt>$<digest>
    const segment = storedHash.split('$')[3];
    if (!segment) return null;

    const values = new Map<string, number>();
    for (const pair of segment.split(',')) {
      const [key, raw] = pair.split('=');
      const value = Number(raw);
      if (!key || !Number.isFinite(value)) return null;
      values.set(key, value);
    }

    const memoryCost = values.get('m');
    const timeCost = values.get('t');
    const parallelism = values.get('p');
    if (memoryCost === undefined || timeCost === undefined || parallelism === undefined) {
      return null;
    }
    return { memoryCost, timeCost, parallelism };
  }
}
