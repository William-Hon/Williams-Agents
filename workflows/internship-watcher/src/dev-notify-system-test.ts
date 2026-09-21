import './config/env.ts';
import { publishSystemAlert } from './notifications/publisher.ts';

async function runSystemTest() {
  console.log("\n==================================================");
  console.log("PHASE 5: SYSTEM ERROR NOTIFICATION TEST");
  console.log("==================================================\n");

  console.log("Sending a test critical alert to the system error topic...");

  await publishSystemAlert(
    'critical',
    'Watcher System Test',
    'WATCHER TEST ALERT',
    'System alert topic is configured correctly.'
  );

  console.log("Done.");
}

runSystemTest().catch(console.error);
