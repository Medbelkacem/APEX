import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Exempt a route from CSRF checks.
 *
 * Only for endpoints that carry their own proof of origin and are not
 * authenticated by cookie — a provider webhook verified by signature, say.
 * Anything a browser can be tricked into sending with the user's cookies
 * attached must not use this.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
