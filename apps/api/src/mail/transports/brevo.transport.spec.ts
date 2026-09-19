import { BrevoTransport } from './brevo.transport';
import { MailConfig } from '../../config/mail';

const config = (over: Partial<MailConfig> = {}): MailConfig => ({
  driver: 'brevo',
  smtp: { host: '', port: 1025, user: '', password: '', secure: false },
  sendgridApiKey: '',
  brevoApiKey: 'test-brevo-key',
  fromName: 'Apex Digital Lab',
  fromAddress: 'no-reply@apex-dental-solution.com',
  ...over,
});

const input = { to: 'dentist@example.test', subject: 'Confirm your email', html: '<p>hi</p>', text: 'hi' };

describe('BrevoTransport', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('refuses to construct without an API key', () => {
    expect(() => new BrevoTransport(config({ brevoApiKey: '' }))).toThrow('BREVO_API_KEY');
  });

  it('POSTs to the Brevo API with the api-key header and the message envelope', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    global.fetch = fetchMock as unknown as typeof fetch;

    await new BrevoTransport(config()).send(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('test-brevo-key');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual([{ email: input.to }]);
    expect(body.subject).toBe(input.subject);
    expect(body.sender).toEqual({ name: 'Apex Digital Lab', email: 'no-reply@apex-dental-solution.com' });
  });

  it('throws with the response body when Brevo rejects the request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"message":"invalid sender"}'),
    }) as unknown as typeof fetch;

    await expect(new BrevoTransport(config()).send(input)).rejects.toThrow('invalid sender');
  });

  it('times out rather than hanging when Brevo never responds', async () => {
    global.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;

    jest.useFakeTimers();
    const promise = new BrevoTransport(config()).send(input);
    const assertion = expect(promise).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
