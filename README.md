# ReachIn

**ReachIn รู้ทันการล้ม คนถึงตัวไว ลูกหลานสบายใจ**

When an older adult falls in the bathroom, a box asks for help on their behalf. Everyone in their trusted circle is alerted at once through LINE. The first person to accept gets the job and a step-by-step guide, the rest stand by, and the family is told what is happening at each step.

This is a hackathon MVP for IIC Bootcamp 2026 (Silver Technology). All elder data is fictional. The bathroom box is not built here; `/demo` simulates it through the same code path a real box would use.

## Run the demo in under 5 minutes

You need Node 24+, pnpm and Docker. LINE is not required.

```bash
pnpm install
cp .env.example .env
# Fill in two values:
#   CRON_SECRET:        openssl rand -hex 32
#   DEVICE_SECRET_KEY:  openssl rand -base64 32

pnpm db:up
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

With `LINE_ENABLED=false` the whole site is an open demo: no password and no LINE account. Nobody can sign in as themselves in this mode, so everything on the site is fictional.

Open <http://localhost:3000>. Then:

1. Press **เริ่มสาธิต: คุณยายล้ม**. You become คุณสมชาย, and the alert arrives in a simulated LINE chat.
2. Press **รับงาน ไปช่วยเลย** in the chat, then **เปิดคู่มือช่วยเหลือ**.
3. On the route screen, press **ฉันถึงบ้านคุณยายแล้ว**. GPS is simulated at 50 m. **ลองกดจากที่ไกล 500 ม.** shows the rejection.
4. Work through the guide and send the summary.
5. Press **แชต LINE** in the top bar and switch people to see what each one received. ลูกสาว shows the family's side.
6. Press **แผงควบคุม** for the full activity feed.

The chat shows the same Flex cards the real system would send, and its buttons run the same code as a real LINE tap. It is a simulation, and is labelled as one. Phone buttons show a notice instead of dialling, so nobody calls 1669 by accident.

The site is shared: everyone uses the same data, and pressing the start button resets it for all visitors.

Other things to show from `/demo`:

- **Self-recovery:** FALL, then VOICE_OK alone (nothing cancels), then STANDING (cancels and tells the family).
- **Nobody accepts:** FALL, then **เร่งเวลา 60 นาที**. Everyone gets a 1669 button. The system never dials.
- **Helper doesn't arrive:** accept, then fast-forward. The job reopens for everyone else.
- **GPS rejection:** **ลองที่ระยะ 500 ม.** shows the Thai error.
- **Privacy:** act as อสม.นิด and open คุณยายสมศรี. No medications appear until they accept.

**รีเซ็ตข้อมูลสาธิต** restores the seed data at any time. It leaves real people who joined through an invite in their circles.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` | Production build |
| `pnpm typecheck && pnpm lint && pnpm test` | All checks. Needs `pnpm db:up` |
| `pnpm test:e2e` | Playwright smoke test. Needs `pnpm build` first, and `pnpm exec playwright install chromium` once. On a slow connection, point `PW_CHROMIUM_PATH` at a Chromium you already have |
| `pnpm device:send RI-DEMO-0001 FALL` | Send a signed event, as the box would |

The local database lives in memory: stopping the container erases it. To get it back, run `pnpm db:up`, `pnpm exec prisma migrate deploy` and `pnpm db:seed`.

## Deploy

### Neon

1. Create a project in the Singapore region.
2. Copy the **pooled** connection string to `DATABASE_URL`.
3. Copy the **direct** connection string to `DIRECT_URL`. Migrations need it, because the pooler cannot hold their lock.
4. Run the migrations and seed from your machine, with those two values in `.env`:

   ```bash
   pnpm exec prisma migrate deploy
   pnpm db:seed
   ```

### Vercel

1. Import the repository. The framework is detected as Next.js.
2. Add every variable from `.env.example` for Production. `APP_BASE_URL` is your deployment URL with no trailing slash.
3. Deploy. A missing or invalid variable stops the server at start and logs its name.

**Cron:** Vercel's Hobby plan runs cron once a day, and a more frequent schedule makes the deployment fail. `vercel.json` therefore ships with a daily run, which means the 3- and 10-minute timers and the heartbeat check **do not run unattended on Hobby**. On stage, use the buttons in `/demo`.

For real timers, either:

- On Pro, set the schedule in `vercel.json` to `* * * * *`.
- Call `/api/cron/tick` from another scheduler with `Authorization: Bearer <CRON_SECRET>`.

Polling every minute keeps Neon's compute awake, which uses up the free plan's monthly hours early.

### LINE

Everything lives under one **provider**. This matters: LINE issues a different user ID per provider, so a Login channel under another provider would give IDs the Messaging API rejects.

**1. Messaging API channel**

1. In the [LINE Developers Console](https://developers.line.biz/console/), create a provider, then a Messaging API channel. LINE now creates these through a LINE Official Account.
2. On **Basic settings**, copy the channel secret to `LINE_CHANNEL_SECRET`.
3. On **Messaging API**, issue a long-lived channel access token and copy it to `LINE_CHANNEL_ACCESS_TOKEN`.
4. Set the webhook URL to `https://<your-domain>/api/line/webhook`, press **Verify**, and turn on **Use webhook**.
5. Turn on **Webhook redelivery**. It is off by default.
6. In the Official Account settings, turn off auto-reply and greeting messages so they don't compete with the bot.

**2. LINE Login channel and LIFF app**

1. Under the same provider, create a LINE Login channel. Copy its Channel ID to `LINE_LOGIN_CHANNEL_ID`.
2. In **LIFF**, add an app:
   - Size: **Full**
   - Endpoint URL: `https://<your-domain>`, the bare domain with **no path**. LINE appends the rest, so both `/liff/*` and `/invite/*` work
   - Scopes: **openid** and **profile**
   - Add friend option: **On (aggressive)**, so helpers can receive pushes
3. Copy the LIFF ID to `NEXT_PUBLIC_LIFF_ID`.
4. Publish the channel. An unpublished channel only works for its developers.

**3. Switch it on**

Set `LINE_ENABLED=true`, redeploy, and add the Official Account as a friend on each test phone.

This also closes the open demo: `/demo` then needs `DEMO_SECRET`, and an empty `DEMO_SECRET` turns it off.

Seeded people have fake LINE IDs, so nothing is sent to them; those messages show as **จำลอง** in the feed. To receive real messages, join through an invite: act as ลูกสาว in `/demo`, open the elder's **วงคนช่วย** tab, create a link, and open it on your phone in LINE.

**Rich menu (optional):** point a button at `https://liff.line.me/<LIFF_ID>/liff/home`.

### Real use with no box

Without the box, a person starts every incident: anyone in the circle opens the elder's page and presses **แจ้งเหตุ**. Family registers a real elder at `/liff/register`, and helpers join through invite links. Real accounts get real GPS checks and working call buttons; the simulation only applies to the fictional elders.

Nothing detects a fall by itself in this mode, so it only helps when someone already knows. An elder alone on the floor still depends on the box.

### Real LINE without an Official Account

You only need a LINE Login channel and a LIFF app. Keep `LINE_ENABLED=false`.

1. In the LIFF app, set the Endpoint URL to your bare domain and the scopes to **openid** and **profile**.
2. On the **LIFF** tab, click **shareTargetPicker**, accept the agreement and click **Enable**. This is once per channel.
3. Publish the Login channel, or add your testers. An unpublished channel only works for its developers.
4. Set `NEXT_PUBLIC_LIFF_ID` and `LINE_LOGIN_CHANNEL_ID` in Vercel and deploy. The LIFF ID is built into the page, so it needs a new deployment.
5. Open `https://liff.line.me/<LIFF_ID>` in LINE, press start, then press **ส่งแจ้งเตือนเข้า LINE จริง** and pick friends or a group.

Each person who opens the card signs in with their real LINE account, joins คุณยายสมศรี's demo circle, and can race for the job.

What this cannot do: **the server cannot message anyone.** A person must press the button, so nothing arrives by itself, and standby, family and summary updates stay inside the app. Automatic alerts need the Messaging API. Cards are sent from the presser's own account and say they are a demo.

### Message quota

Push and multicast count toward the Official Account plan, once per recipient. Replies are free, so the accepter's confirmation uses one.

| Plan (Thailand, before VAT) | Monthly fee | Messages | Extra |
|---|---|---|---|
| Free | ฿0 | 300 | Not available |
| Basic | ฿1,280 | 15,000 | ฿0.10 each |
| Pro | ฿1,780 | 35,000 | ฿0.06 each |

One clean run with five real phones uses about 15 messages, so rehearsals can drain the Free plan. When the quota runs out LINE returns 429. The incident flow keeps working, and the messages stay visible in the `/demo` feed. If LINE fails on stage, set `LINE_ENABLED=false` and redeploy, or just present from the feed.

## How it works

```
Box or /demo ──▶ /api/device/events ──▶ lib/incident/service ──▶ lib/incident/machine (pure)
LINE postback ─▶ /api/line/webhook ───▶         │                 decides next state + side effects
LIFF screens ──▶ /api/liff/* ─────────▶         │
Cron or /demo ─▶ /api/cron/tick ──────▶         ▼
                                       lib/incident/dispatcher (pure)
                                       turns side effects into messages
                                                │
                                                ▼
                                       OutboundMessage (outbox and feed)
                                                │
                                                ▼
                                       LineTransport or ConsoleTransport
```

- **`lib/incident/machine.ts`** is the only place a status can change, and it has no I/O. Routes never set a status themselves.
- **Exactly one accepter:** every event on an incident takes a row lock in a transaction, so concurrent accepts run in turn and only the first finds `ALERTING`.
- **One open incident per elder** is a partial unique index in the database.
- **The outbox** is written in the same transaction as the state change, so a crash cannot lose a fall alert. `/api/cron/tick` retries anything still pending.
- **`lib/views.ts`** is the only reader of medical data, and both pages and API routes use it. Fields a viewer may not see are left out of the response entirely.

Device details are in [docs/device-api.md](docs/device-api.md).

## Privacy and safety

- Medical and key-holder details are visible to FAMILY, INNER, and whoever has accepted an open incident. BACKUP helpers see them only after accepting, and lose them when the incident closes.
- Identity comes from a LINE ID token verified by LINE. A user ID sent by the client is ignored.
- Personal and medical data stays out of postback data, alt text and logs. Two required links are the exception: the Google Maps link contains the house coordinates and goes only to the accepter, and `tel:` buttons contain a phone number. Map tile requests also reveal the map area to OpenStreetMap.
- The arrival check uses GPS reported by the phone, which a determined person can spoof. It confirms good-faith arrival; it is not proof.
- **All guide content in `content/guide.th.ts` must be reviewed by a physiotherapist or nurse before real use.**
- The system never calls 1669. It gives people a button and a script.

## Not built

**Future work:** real radar firmware, payments and subscriptions, government (B2G) integration, automatic 1669 calls, a paid on-demand helper marketplace, and multiple languages.

**Also not in this MVP:** editing an elder's details after registration, removing someone from a circle, and the phone-call escalation described in the pitch document.
