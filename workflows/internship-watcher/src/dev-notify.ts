import './config/env.ts';
import { processJobNotifications } from './notifications/publisher.ts';

async function runNotify() {
  const isLive = process.argv.includes('--live');

  console.log("\n==================================================");
  console.log(`PHASE 5: NOTIFICATION PUBLISHER ${isLive ? '[LIVE]' : '[DRY RUN]'}`);
  console.log("==================================================\n");

  if (!isLive) {
    console.log("[INFO] Running in DRY RUN mode. No notifications will be sent to Ntfy, and DB statuses will not be updated.");
    console.log("[INFO] To run live, use: npm run dev:internship-notify-live\n");
  } else {
    console.log("[WARNING] LIVE MODE ACTIVE. Publishing real notifications to Ntfy...\n");
  }

  const startTime = Date.now();
  await processJobNotifications(isLive);
  console.log(`\n[INFO] Duration: ${Date.now() - startTime}ms`);
}

runNotify().catch(console.error);
