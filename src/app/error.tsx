'use client';
import { Button } from '@/components/ui/button';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="center-state">
      <span className="wordmark">
        vessy<span>®</span>
      </span>
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load the studio. Your last saved draft is still there.</p>
      <Button onClick={reset}>Reload studio</Button>
    </main>
  );
}
