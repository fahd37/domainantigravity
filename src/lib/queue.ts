import type { PrismaClient } from "@prisma/client";

export const KILL_SWITCH = { active: false };

export interface QueueItem {
  id: string;
  domain: string;
  score: number;
  niche: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  addedAt: Date;
  processedAt?: Date;
  error?: string;
  price?: number;
}

export interface PurchaseSettings {
  apiUser: string;
  apiKey: string;
  sandbox: boolean;
  maxPerDay: number;
  dailyBudget: number;
  cfApiToken?: string;
  resendApiKey?: string;
  prisma?: PrismaClient;
}

class PurchaseQueue {
  private items: QueueItem[] = [];
  private dailyCount = 0;
  private dailySpend = 0;
  private lastResetDate = new Date().toISOString().split('T')[0];
  private isProcessing = false;

  private checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastResetDate) {
      this.dailyCount = 0;
      this.dailySpend = 0;
      this.lastResetDate = today;
    }
  }

  public addToQueue(item: Omit<QueueItem, 'id' | 'status' | 'addedAt'>) {
    const newItem: QueueItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      status: 'pending',
      addedAt: new Date()
    };
    this.items.push(newItem);
    return newItem;
  }

  public getQueueStatus() {
    this.checkDailyReset();
    return {
      items: this.items,
      dailyCount: this.dailyCount,
      dailySpend: this.dailySpend,
      killSwitchActive: KILL_SWITCH.active
    };
  }

  public clearCompleted() {
    this.items = this.items.filter(
      i => i.status === 'pending' || i.status === 'processing'
    );
  }

  public async processQueue(settings: PurchaseSettings) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        this.checkDailyReset();

        if (KILL_SWITCH.active) {
          console.log("Purchase queue halted: KILL_SWITCH active.");
          break;
        }

        const pendingItems = this.items.filter(i => i.status === 'pending');
        if (pendingItems.length === 0) break;

        const item = pendingItems[0];
        item.status = 'processing';

        if (this.dailyCount >= settings.maxPerDay) {
          item.status = 'skipped';
          item.error = "Max daily count limit reached";
          item.processedAt = new Date();
          continue;
        }

        if (this.dailySpend >= settings.dailyBudget) {
          item.status = 'skipped';
          item.error = "Daily budget limit reached";
          item.processedAt = new Date();
          continue;
        }

        // Import dynamically to avoid circular dependencies if queue is imported broadly
        const { purchaseDomain } = await import('./namecheap');
        
        console.log(`[Queue] Attempting purchase of ${item.domain}...`);
        const result = await purchaseDomain(item.domain, settings.apiUser, settings.apiKey, settings.sandbox);

        item.processedAt = new Date();
        
        if (result.success) {
          item.status = 'completed';
          this.dailyCount++;
          const assumedPrice = 10;
          this.dailySpend += assumedPrice;
          item.price = assumedPrice;

          // Post-purchase: Cloudflare + email + content pipeline (non-blocking)
          if (settings.cfApiToken) {
            import('./cloudflare').then(({ createZone }) => {
              createZone(item.domain, settings.cfApiToken!)
                .then(({ zoneId }) => {
                  if (settings.prisma) {
                    settings.prisma.domain.updateMany({
                      where: { name: item.domain },
                      data: { cloudflareZoneId: zoneId },
                    }).catch(console.error);
                  }
                })
                .catch(console.error);
            }).catch(console.error);
          }

          if (settings.resendApiKey) {
            import('./email').then(({ sendPurchaseEmail }) => {
              sendPurchaseEmail(
                item.domain,
                item.score,
                item.niche,
                assumedPrice,
                {},
                settings.resendApiKey!
              ).catch(console.error);
            }).catch(console.error);
          }

          // Trigger post-buy content pipeline
          if (settings.prisma) {
            import('./post-buy/pipeline').then(({ runPostBuyPipeline }) => {
              runPostBuyPipeline(item.domain, item.niche, {
                prisma: settings.prisma!,
                cfApiToken: settings.cfApiToken,
                resendApiKey: settings.resendApiKey,
              }).catch(console.error);
            }).catch(console.error);
          }
        } else {
          item.status = 'failed';
          item.error = result.error;
        }

        // 30 second delay between purchases as requested
        if (this.items.some(i => i.status === 'pending') && !KILL_SWITCH.active) {
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const queue = new PurchaseQueue();
