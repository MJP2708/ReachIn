/**
 * Send a signed device event, as the box would.
 *   pnpm device:send RI-DEMO-0001 FALL [http://localhost:3000]
 */
import 'dotenv/config';
import { demoDeviceSecret, signDeviceBody } from '../lib/device/secret';

const [serial, type, base = 'http://localhost:3000'] = process.argv.slice(2);
if (!serial || !type) {
  console.error('usage: pnpm device:send <serial> <type> [baseUrl]');
  process.exit(1);
}

const body = JSON.stringify({ serial, type, ts: Math.floor(Date.now() / 1000) });
const res = await fetch(`${base}/api/device/events`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-device-signature': signDeviceBody(body, demoDeviceSecret(serial)),
  },
  body,
});
console.log(res.status, await res.text());
