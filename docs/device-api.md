# Device API

The contract for the bathroom box (ESP32 + mmWave radar). No firmware ships in this repository. Until the box exists, `/demo` and `pnpm device:send` stand in for it.

## Endpoint

`POST /api/device/events`

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Device-Signature` | Lowercase hex of HMAC-SHA256(raw body, device secret) |

```json
{ "serial": "RI-DEMO-0001", "type": "FALL", "ts": 1793457697, "meta": {} }
```

| Field | Rule |
|---|---|
| `serial` | The box's serial number, 1–64 characters |
| `type` | One of the event types below |
| `ts` | Unix time in **seconds**. Rejected if more than 5 minutes from server time, in either direction |
| `meta` | Optional object. Never put personal or medical data here |

Sign the exact bytes you send. Any change after signing, including whitespace or key order, fails verification.

## Event types

| Type | When to send | Effect |
|---|---|---|
| `FALL` | Radar sees a fast drop to floor level, and no recovery | Opens an incident and alerts the whole circle. If one is already open, it is noted on that incident |
| `LONG_STAY` | In the bathroom far longer than usual, not moving, and no answer | Same as `FALL`, with type `LONG_STAY` |
| `VOICE_OK` | Answered "ไม่เป็นไร" | Recorded. Cancels only together with `STANDING`, in either order |
| `STANDING` | Radar sees the person upright | Recorded. Cancels only together with `VOICE_OK` |
| `VOICE_HELP` | Answered "ช่วยด้วย" | Escalates. Opens an incident first if none is open, and blocks self-cancellation |
| `NO_RESPONSE` | No answer and no movement | Escalates: everyone gets a 1669 button |
| `HEARTBEAT` | Every 5 minutes | Keeps the box online. After 15 silent minutes the family is told it dropped off |

The box must send `FALL` immediately, then ask its voice question. Alerts never wait for the answer.

Cancellation only applies while nobody has accepted. Once a helper is on the way they keep going, and the signals are logged.

## Responses

| Status | Body | Meaning | Box should |
|---|---|---|---|
| `200` | `{"ok":true,"incidentId":"…","created":true}` | Accepted | Carry on |
| `200` | `{"ok":true,"duplicate":true}` | Same `serial`, `ts` and `type` seen before | Treat as delivered |
| `400` | `{"error":"invalid body"}` | Malformed | Log it; do not retry unchanged |
| `401` | `{"error":"invalid signature"}` | Unknown serial or wrong signature | Log it; do not retry unchanged |
| `401` | `{"error":"stale timestamp"}` | Clock is off, or the message is old | Re-sync NTP, re-sign with a new `ts`, resend |
| `5xx` or timeout | | Server problem | Retry **with the same body and signature** until it succeeds or 5 minutes pass; then re-sign with a new `ts` |

A retry of the same signed body is safe: it is applied once. Replays are refused for the same reason. A replayed `STANDING` inside the 5-minute window could otherwise cancel a real incident.

The API answers within a second. LINE messages go out after the response.

## Clock

The box has no real-time clock, so it needs NTP at boot and periodically after that. A box whose clock drifts more than 5 minutes gets `stale timestamp` on everything, including a real fall. Treat that error as urgent on the device side.

## Secrets

Each box has its own secret, provisioned at the factory. On the server it is stored encrypted with AES-256-GCM under `DEVICE_SECRET_KEY`. It cannot be stored hashed, because verifying an HMAC requires the raw key.

Seeded boxes derive theirs from `DEVICE_SECRET_KEY` and the serial, so `pnpm device:send` can sign for them.

## Try it

With the dev server running:

```bash
pnpm device:send RI-DEMO-0001 FALL
pnpm device:send RI-DEMO-0001 VOICE_OK
pnpm device:send RI-DEMO-0001 STANDING
```

The same request by hand, for a box secret in `$SECRET`:

```bash
BODY=$(printf '{"serial":"RI-DEMO-0001","type":"FALL","ts":%s}' "$(date +%s)")
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}')
curl -X POST http://localhost:3000/api/device/events \
  -H 'Content-Type: application/json' \
  -H "X-Device-Signature: $SIG" \
  -d "$BODY"
```

## ESP32 pseudo-code

Illustrative only; this has not been compiled or run on hardware.

```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <mbedtls/md.h>

String hmacHex(const String& body, const char* secret) {
  uint8_t mac[32];
  const auto* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_hmac(info, (const uint8_t*)secret, strlen(secret),
                  (const uint8_t*)body.c_str(), body.length(), mac);
  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", mac[i]);
  return String(hex);
}

bool sendEvent(const char* type) {
  String body = String("{\"serial\":\"") + SERIAL_NO + "\",\"type\":\"" + type +
                "\",\"ts\":" + (uint32_t)time(nullptr) + "}";
  HTTPClient http;
  http.begin(secureClient, API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Signature", hmacHex(body, DEVICE_SECRET));
  int status = http.POST(body);
  http.end();
  return status == 200;
}

void loop() {
  if (radar.fallDetected()) {
    sendEvent("FALL");        // first, always
    askVoiceQuestion();       // flashes the LED as well
  }
  if (voice.heardOk())   sendEvent("VOICE_OK");
  if (voice.heardHelp()) sendEvent("VOICE_HELP");
  if (radar.isStanding() && incidentOpen) sendEvent("STANDING");
  if (noAnswerTimedOut() && !radar.movement()) sendEvent("NO_RESPONSE");
  if (millis() - lastBeat > 5 * 60 * 1000) { sendEvent("HEARTBEAT"); lastBeat = millis(); }
}
```
