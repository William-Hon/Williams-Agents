import { NTFY_HOST_URL } from '../config/env.ts';

export type NtfyPriority = 1 | 2 | 3 | 4 | 5;

export interface NtfyAction {
  action: 'view' | 'http';
  label: string;
  url?: string;
  clear?: boolean;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

export interface NtfyPublishOptions {
  topic: string;
  title: string;
  message: string;
  priority?: NtfyPriority;
  tags?: string[];
  clickUrl?: string;
  actions?: NtfyAction[];
}

export class NtfyClient {
  private serverUrl: string;

  constructor(serverUrl: string = NTFY_HOST_URL) {
    // Ensure no trailing slash
    this.serverUrl = serverUrl.replace(/\/$/, '');
  }

  /**
   * Publishes a message to the ntfy server using the JSON API
   */
  async publish(options: NtfyPublishOptions): Promise<void> {
    if (!options.topic) {
      throw new Error("NTFY Topic is required");
    }

    const payload: any = {
      topic: options.topic,
      message: options.message,
      title: options.title,
    };

    if (options.priority) payload.priority = options.priority;
    if (options.tags && options.tags.length > 0) payload.tags = options.tags;
    if (options.clickUrl) payload.click = options.clickUrl;
    if (options.actions && options.actions.length > 0) payload.actions = options.actions;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ntfy server responded with HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      throw new Error(`Failed to publish to ntfy: ${err.message}`);
    }
  }
}
