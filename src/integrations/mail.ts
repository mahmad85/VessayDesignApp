import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function sendOrderEmail(to: string, subject: string, message: string, url: string) {
  if (process.env.NODE_ENV !== 'production') {
    const dir = path.join(process.cwd(), '.data/mail');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(dir, `${Date.now()}-${crypto.randomUUID()}.json`),
      JSON.stringify({ to, subject, message, url }, null, 2),
      { mode: 0o600 },
    );
    return;
  }
  if (!process.env.MAIL_API_URL || !process.env.MAIL_API_TOKEN || !process.env.MAIL_FROM)
    throw new Error('Order email is not configured.');
  const response = await fetch(process.env.MAIL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MAIL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject,
      text: `${message}\n\n${url}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Order email delivery failed.');
}
export async function sendAccountEmail(to: string, subject: string, url: string) {
  if (process.env.MAIL_API_URL && process.env.MAIL_API_TOKEN && process.env.MAIL_FROM) {
    const result = await fetch(process.env.MAIL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MAIL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text: `${subject}\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) throw new Error('Account email delivery failed.');
    return;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Account email delivery is not configured.');
  const dir = path.join(process.cwd(), '.data/mail');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(
    path.join(dir, `${Date.now()}-${crypto.randomUUID()}.json`),
    JSON.stringify({ to, subject, url }, null, 2),
    { mode: 0o600 },
  );
}
