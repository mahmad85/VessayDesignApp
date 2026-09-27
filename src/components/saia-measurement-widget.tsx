'use client';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from './ui/button';
import {
  isTrustedSaiaMessage,
  mapSaiaPersonToMillimeters,
  normalizeSaiaPublicKey,
  type SaiaPerson,
} from '@/integrations/3dlook';

type Props = {
  onCaptureStart: () => Promise<string>;
  onMeasurementsReady: (person: SaiaPerson, captureToken: string) => Promise<void>;
};

const SCRIPT_ID = 'saia-mtm-integration';
const SCRIPT_URL = 'https://mtm-widget.3dlook.me/integration.js';
const PUBLIC_KEY = normalizeSaiaPublicKey(process.env.NEXT_PUBLIC_3DLOOK_PUBLIC_KEY);
const HOST_ID = 'vessy-saia-widget-host';
const PARKING_ID = 'vessy-saia-widget-parking';
const SCRIPT_OWNER = 'vessy-persistent-host';
const LOAD_TIMEOUT_MS = 15_000;
const CAPTURE_TOKEN_KEY = 'vessy-saia-capture-token';
const STORED_RESULT_KEY = 'saia-pf-widget-data';

type WidgetStatus = 'loading' | 'ready' | 'error';

function parseStoredSaiaPerson(raw: string | null): SaiaPerson | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return null;
    const person = value as SaiaPerson;
    if (
      (typeof person.id !== 'string' && typeof person.id !== 'number') ||
      Object.keys(mapSaiaPersonToMillimeters(person)).length === 0
    )
      return null;
    return person;
  } catch {
    return null;
  }
}

function getParkingElement() {
  let parking = document.getElementById(PARKING_ID);
  if (!parking) {
    parking = document.createElement('div');
    parking.id = PARKING_ID;
    parking.hidden = true;
    parking.setAttribute('aria-hidden', 'true');
    document.body.appendChild(parking);
  }
  return parking;
}
function getPersistentHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'saia-widget-container';
  }
  return host;
}
function removeFailedInitialization(host: HTMLElement) {
  host.replaceChildren();
  document.querySelector('.saia-mtm-drop')?.remove();
  document.getElementById(SCRIPT_ID)?.remove();
}

export function SaiaMeasurementWidget({ onCaptureStart, onMeasurementsReady }: Props) {
  const ownerId = useId();
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleMeasurementsReady = useCallback(
    async (payload: SaiaPerson) => {
      const measurements = mapSaiaPersonToMillimeters(payload);
      const captureToken = sessionStorage.getItem(CAPTURE_TOKEN_KEY);
      if (Object.keys(measurements).length === 0 || !captureToken || payload.id == null) {
        setError('3DLOOK completed, but no supported measurements were returned. You can continue manually.');
        setStatus('error');
        return;
      }
      try {
        await onMeasurementsReady(payload, captureToken);
        localStorage.removeItem(STORED_RESULT_KEY);
        sessionStorage.removeItem(CAPTURE_TOKEN_KEY);
        setError(null);
        setStatus('ready');
      } catch {
        setError('Your result was received but could not be saved. Retry without starting another scan.');
        setStatus('error');
      }
    },
    [onMeasurementsReady],
  );

  useEffect(() => {
    const mountPoint = document.getElementById(`saia-route-mount-${ownerId.replace(/:/g, '')}`);
    if (!mountPoint) return;
    const host = getPersistentHost();
    mountPoint.appendChild(host);
    // This effect drives an imperative, non-React widget lifecycle (mounting
    // a persistent host, loading a third-party script, listening for a
    // postMessage result); resetting status here — not in a subscription
    // callback — is what "attempt" retries are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus('loading');
    setError(null);
    let launchAuthorized = false;
    const interceptLaunch = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('.saia-mtm-button') : null;
      if (!target || launchAuthorized) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void onCaptureStart()
        .then((captureToken) => {
          sessionStorage.setItem(CAPTURE_TOKEN_KEY, captureToken);
          localStorage.removeItem(STORED_RESULT_KEY);
          launchAuthorized = true;
          (target as HTMLButtonElement).click();
          launchAuthorized = false;
        })
        .catch(() => {
          setError('Vessy could not prepare secure result capture. Retry before starting the scan.');
          setStatus('error');
        });
    };
    host.addEventListener('click', interceptLaunch, true);

    const receiveTrustedResult = (event: MessageEvent) => {
      const iframe = document.querySelector<HTMLIFrameElement>('.saia-mtm-drop iframe');
      if (!isTrustedSaiaMessage(event, iframe?.contentWindow)) return;
      const person = (event.data as { data?: unknown }).data;
      if (!person || typeof person !== 'object') return;
      void handleMeasurementsReady(person as SaiaPerson);
    };
    window.addEventListener('message', receiveTrustedResult);

    const storedPerson = parseStoredSaiaPerson(localStorage.getItem(STORED_RESULT_KEY));
    if (storedPerson && sessionStorage.getItem(CAPTURE_TOKEN_KEY)) void handleMeasurementsReady(storedPerson);
    const recoveryInterval = window.setInterval(() => {
      if (!sessionStorage.getItem(CAPTURE_TOKEN_KEY)) {
        window.clearInterval(recoveryInterval);
        return;
      }
      const recovered = parseStoredSaiaPerson(localStorage.getItem(STORED_RESULT_KEY));
      if (recovered) {
        window.clearInterval(recoveryInterval);
        void handleMeasurementsReady(recovered);
      }
    }, 1_000);

    const markReady = () => {
      if (!host.querySelector('.saia-mtm-button')) return false;
      setStatus('ready');
      setError(null);
      return true;
    };

    if (markReady()) {
      return () => {
        const modal = document.querySelector('.saia-mtm-drop');
        modal?.classList.remove('active');
        const iframe = modal?.querySelector('iframe');
        if (iframe) iframe.src = '';
        getParkingElement().appendChild(host);
      };
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const isOwnedScript = script?.dataset.vessyOwner === SCRIPT_OWNER;
    if (script && !isOwnedScript) {
      removeFailedInitialization(host);
      script = null;
    } else if (script && PUBLIC_KEY && script.dataset.publicKey !== PUBLIC_KEY) {
      removeFailedInitialization(host);
      script = null;
    } else if (script?.dataset.loadFailed === 'true') {
      removeFailedInitialization(host);
      script = null;
    } else if (script?.dataset.loaded === 'true' && !host.querySelector('.saia-mtm-button')) {
      removeFailedInitialization(host);
      script = null;
    }

    (window as Window & { MTM_WIDGET_OPTIONS?: Record<string, unknown> }).MTM_WIDGET_OPTIONS = {
      buttonTitle: 'Start 3DLOOK measurement',
      onMeasurementsReady: () => {},
    };

    if (!script) {
      if (!PUBLIC_KEY) {
        setError('3DLOOK is not configured for this environment.');
        setStatus('error');
        return () => {
          host.removeEventListener('click', interceptLaunch, true);
          window.removeEventListener('message', receiveTrustedResult);
          window.clearInterval(recoveryInterval);
          getParkingElement().appendChild(host);
        };
      }
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = SCRIPT_URL;
      script.dataset.publicKey = PUBLIC_KEY;
      script.dataset.buttonTitle = 'Start 3DLOOK measurement';
      script.dataset.vessyOwner = SCRIPT_OWNER;
      script.onload = () => {
        if (script) script.dataset.loaded = 'true';
      };
      script.onerror = () => {
        if (script) script.dataset.loadFailed = 'true';
        setError('3DLOOK could not be loaded. Check your connection or continue with manual measurements.');
        setStatus('error');
      };
      document.body.appendChild(script);
    }

    const observer = new MutationObserver(() => {
      if (markReady()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => {
      if (markReady()) return;
      setError('3DLOOK did not finish loading. You can retry or continue with manual measurements.');
      setStatus('error');
    }, LOAD_TIMEOUT_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      window.clearInterval(recoveryInterval);
      host.removeEventListener('click', interceptLaunch, true);
      window.removeEventListener('message', receiveTrustedResult);
      const modal = document.querySelector('.saia-mtm-drop');
      modal?.classList.remove('active');
      const iframe = modal?.querySelector('iframe');
      if (iframe) iframe.src = '';
      getParkingElement().appendChild(host);
    };
  }, [attempt, handleMeasurementsReady, onCaptureStart, ownerId]);

  return (
    <div className="saia-widget">
      <div id={`saia-route-mount-${ownerId.replace(/:/g, '')}`} data-testid="saia-widget-container" />
      {status === 'loading' && (
        <div className="saia-widget-loading" role="status">
          <LoaderCircle size={16} className="spin" aria-hidden="true" />
          Loading secure measurement scan
        </div>
      )}
      {error && (
        <div className="saia-widget-error">
          <p role="alert">{error}</p>
          <Button
            variant="secondary"
            onClick={() => {
              const storedPerson = parseStoredSaiaPerson(localStorage.getItem(STORED_RESULT_KEY));
              if (storedPerson && sessionStorage.getItem(CAPTURE_TOKEN_KEY)) {
                void handleMeasurementsReady(storedPerson);
                return;
              }
              const host = getPersistentHost();
              if (!host.querySelector('.saia-mtm-button')) removeFailedInitialization(host);
              setAttempt((value) => value + 1);
            }}
          >
            <RotateCcw size={14} />
            {parseStoredSaiaPerson(localStorage.getItem(STORED_RESULT_KEY)) &&
            sessionStorage.getItem(CAPTURE_TOKEN_KEY)
              ? 'Retry saving result'
              : 'Retry 3DLOOK'}
          </Button>
        </div>
      )}
    </div>
  );
}
