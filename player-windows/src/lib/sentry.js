import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
    if (!SENTRY_DSN) {
        console.warn('[Sentry] DSN not configured, skipping initialization');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        release: `player@${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}`,
        integrations: [
            Sentry.browserTracingIntegration(),
        ],
        tracesSampleRate: 0.3,
        beforeSend(event) {
            if (import.meta.env.DEV) {
                console.warn('[Sentry] Would send event:', event.exception?.values?.[0]?.value);
                return null;
            }
            return event;
        },
    });
}

export { Sentry };
