import { HTTPFetchError, messagingApi } from '@line/bot-sdk';
import { env } from '@/lib/env';
import type { LineMessage } from './flex';

export type SendResult =
  | { ok: true }
  | { ok: false; status: number | null; retriable: boolean };

export type SendContext = { template: string; incidentId: string | null };

/** All outbound LINE traffic goes through this, so a stage failure has a fallback. */
export interface MessageTransport {
  readonly live: boolean;
  reply(
    replyToken: string,
    messages: LineMessage[],
    context: SendContext,
  ): Promise<SendResult>;
  push(
    to: string,
    messages: LineMessage[],
    retryKey: string,
    context: SendContext,
  ): Promise<SendResult>;
  multicast(
    to: string[],
    messages: LineMessage[],
    retryKey: string,
    context: SendContext,
  ): Promise<SendResult>;
}

function toResult(error: unknown): SendResult {
  if (error instanceof HTTPFetchError) {
    // 409 means LINE already accepted this retry key: the message went out.
    if (error.status === 409) return { ok: true };
    return {
      ok: false,
      status: error.status,
      retriable: error.status === 429 || error.status >= 500,
    };
  }
  return { ok: false, status: null, retriable: true };
}

export class LineTransport implements MessageTransport {
  readonly live = true;
  private readonly client: messagingApi.MessagingApiClient;

  constructor(channelAccessToken: string) {
    this.client = new messagingApi.MessagingApiClient({ channelAccessToken });
  }

  async reply(replyToken: string, messages: LineMessage[]): Promise<SendResult> {
    try {
      await this.client.replyMessage({ replyToken, messages });
      return { ok: true };
    } catch (error) {
      return toResult(error);
    }
  }

  async push(
    to: string,
    messages: LineMessage[],
    retryKey: string,
  ): Promise<SendResult> {
    try {
      await this.client.pushMessage({ to, messages }, retryKey);
      return { ok: true };
    } catch (error) {
      return toResult(error);
    }
  }

  async multicast(
    to: string[],
    messages: LineMessage[],
    retryKey: string,
  ): Promise<SendResult> {
    try {
      await this.client.multicast({ to, messages }, retryKey);
      return { ok: true };
    } catch (error) {
      return toResult(error);
    }
  }
}

/**
 * Stands in when LINE_ENABLED=false. Logs the template and a count only: the
 * bodies carry names, and they are already readable in the demo feed.
 */
export class ConsoleTransport implements MessageTransport {
  readonly live = false;

  private log(kind: string, count: number, context: SendContext) {
    console.log(
      `[transport:console] ${kind} template=${context.template} incident=${context.incidentId ?? '-'} recipients=${count}`,
    );
    return { ok: true } as const;
  }

  async reply(_token: string, _messages: LineMessage[], context: SendContext) {
    return this.log('reply', 1, context);
  }

  async push(
    _to: string,
    _messages: LineMessage[],
    _retryKey: string,
    context: SendContext,
  ) {
    return this.log('push', 1, context);
  }

  async multicast(
    to: string[],
    _messages: LineMessage[],
    _retryKey: string,
    context: SendContext,
  ) {
    return this.log('multicast', to.length, context);
  }
}

let override: MessageTransport | undefined;

/** Tests inject a fake here. */
export function setTransportForTests(transport: MessageTransport | undefined) {
  override = transport;
}

export function getTransport(): MessageTransport {
  if (override) return override;
  const { LINE_ENABLED, LINE_CHANNEL_ACCESS_TOKEN } = env();
  return LINE_ENABLED
    ? new LineTransport(LINE_CHANNEL_ACCESS_TOKEN)
    : new ConsoleTransport();
}
