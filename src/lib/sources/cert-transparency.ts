import { EventEmitter } from "events";

export interface CertDomain {
  domain: string;
  registeredAt: Date;
  source: "cert-transparency";
  issuer?: string;
}

export class CertStreamMonitor extends EventEmitter {
  private ws: WebSocket | null = null;
  private keywords: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private reconnectDelay = 30000; // 30s

  start(keywords: string[]) {
    this.keywords = keywords.map(k => k.toLowerCase());
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.stopped) return;

    try {
      this.ws = new WebSocket("wss://certstream.calidog.io");

      this.ws.onopen = () => {
        console.log("[CertStream] Connected to certstream.calidog.io");
        this.emit("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.message_type !== "certificate_update") return;

          const domains: string[] = data.data?.leaf_cert?.all_domains || [];
          const registeredAt = new Date();
          const issuer = data.data?.leaf_cert?.issuer?.O || "";

          for (const domain of domains) {
            const clean = domain.toLowerCase().replace(/^\*\./, "");
            if (!clean.includes(".") || clean.length > 100) continue;

            const matches = this.keywords.some(kw => clean.includes(kw));
            if (!matches) continue;

            const result: CertDomain = { domain: clean, registeredAt, source: "cert-transparency", issuer };
            this.emit("domain", result);
          }
        } catch { /* ignore parse errors */ }
      };

      this.ws.onerror = (err) => {
        console.warn("[CertStream] WebSocket error:", err);
        this.emit("error", err);
      };

      this.ws.onclose = () => {
        console.log(`[CertStream] Disconnected. Reconnecting in ${this.reconnectDelay / 1000}s...`);
        this.emit("disconnected");
        if (!this.stopped) {
          this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    } catch (err) {
      console.error("[CertStream] Failed to connect:", err);
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
      }
    }
  }
}

// Singleton instance
export const certStreamMonitor = new CertStreamMonitor();

/**
 * Collect CertStream domains for a fixed duration.
 * Useful for cron-based collection: run for N seconds, return found domains.
 */
export function collectCertDomains(
  keywords: string[],
  durationMs = 60000
): Promise<CertDomain[]> {
  return new Promise((resolve) => {
    const found: CertDomain[] = [];
    const monitor = new CertStreamMonitor();

    monitor.on("domain", (d: CertDomain) => found.push(d));
    monitor.start(keywords);

    setTimeout(() => {
      monitor.stop();
      resolve(found);
    }, durationMs);
  });
}
