import axios from 'axios';

export interface DropFilter {
  minSupply?: number;
  maxMintPriceEth?: number;
  chainIds?: number[];
}

export class DropWatcher {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  public startWatching(intervalSeconds = 30, filter: DropFilter = {}) {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      try {
        await this.pollDrops(filter);
      } catch (err: any) {
        console.error(`Drop watcher poll error: ${err.message}`);
      }
    }, intervalSeconds * 1000);
  }

  public stopWatching() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  private async pollDrops(filter: DropFilter) {
    // Placeholder background polling logic connecting to OpenSea trending drops
  }

  /**
   * Dispatches alert notification via Telegram and/or Discord Webhook
   */
  public async sendAlert(title: string, message: string, collectionUrl?: string) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // Telegram Alert
    if (telegramToken && telegramChatId) {
      try {
        const text = `🚨 *${title}*\n\n${message}${collectionUrl ? `\n\n[OpenSea Collection](${collectionUrl})` : ''}`;
        await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          chat_id: telegramChatId,
          text,
          parse_mode: 'Markdown'
        });
      } catch (err: any) {
        console.warn(`Telegram alert failed: ${err.message}`);
      }
    }

    // Discord Alert
    if (discordWebhookUrl) {
      try {
        await axios.post(discordWebhookUrl, {
          embeds: [
            {
              title,
              description: message,
              color: 0xc8922a, // Gold accent #C8922A
              url: collectionUrl,
              timestamp: new Date().toISOString()
            }
          ]
        });
      } catch (err: any) {
        console.warn(`Discord webhook alert failed: ${err.message}`);
      }
    }
  }
}

export const dropWatcher = new DropWatcher();
