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
        release: `admin-panel@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
        ],
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1.0,
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
