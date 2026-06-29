# Backend deployment — Fly.io

The backend is a Node + Express container with `nargo` (1.0.0-beta.9) and `bb` (0.87.0) baked in. It generates fresh UltraHonk proofs from user inputs and aggregates 4 of them into 1.

## One-time setup (you run these in your own terminal)

You need: a Fly.io account (free), the `flyctl` CLI, and a payment method on file (Fly requires it even for free-tier apps).

```bash
# 1. Install flyctl (Linux/WSL)
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"   # add to ~/.bashrc to persist

# 2. Log in (opens a browser to authenticate)
fly auth login

# 3. From the backend/ directory, create the app on Fly's side.
#    --no-deploy means just create the app record, don't push yet.
cd backend
fly launch --no-deploy --copy-config --name oneproof-backend --region iad
```

That last step reads the committed `fly.toml`, creates the app on Fly under your account, and reserves the `oneproof-backend.fly.dev` hostname. If `oneproof-backend` is taken, pick a different name and update `app = "..."` in `fly.toml`.

## Deploy

Every deploy: prep the build context (copy circuits + companions in) then push.

```bash
cd backend
./prepare.sh           # stages ../circuits/ and companion proofs
fly deploy
```

The first deploy is slow (~10 min) because Docker downloads nargo, bb, and builds the image. Subsequent deploys reuse layers and are ~2 min.

When the deploy finishes, Fly prints the public URL — something like `https://oneproof-backend.fly.dev`. Test it:

```bash
curl https://oneproof-backend.fly.dev/healthz
# {"ok":true,"ts":1719700000000}
```

## Connect the frontend

The frontend (Next.js in `web/`) reads `NEXT_PUBLIC_BACKEND_URL` to know where to send proving requests. Set it locally:

```bash
# web/.env.local
NEXT_PUBLIC_BACKEND_URL=https://oneproof-backend.fly.dev
```

…and in Vercel's project settings under Environment Variables.

## Companion proofs (one-time)

Mode 1 (solo demo) needs 3 pre-baked inner proofs the backend pads the user's proof with. Generate them once:

```bash
# Coming next: ./generate-companions.sh
# For now: place 3 JSON files matching the inner-proof wire format at
# web/public/example/inner-companions/companion-{1,2,3}.json
```

## Resource sizing

- **CPU:** `shared-cpu-2x` is enough for inner proofs (~5–15s each). The aggregator (~20–60s) wants more cores; if proofs are slow in production, bump to `performance-2x` in `fly.toml`.
- **Memory:** 4 GB is fine for inner. The aggregator over K=4 peaks at ~3 GB. If you see `oom-killed` in `fly logs`, bump `memory = "8gb"`.
- **Idle:** `auto_stop_machines = "stop"` means the machine sleeps after a few minutes of no traffic. First request after sleep adds ~30s cold-start. For demo day, run `fly machine start <id>` 5 min before showtime so it's warm.

## Logs + debugging

```bash
fly logs                          # live tail
fly ssh console                   # shell into the running machine
fly machine ls                    # list machines, status, region
fly status                        # app health overview
```

## Costs

Fly's free tier covers ~3 shared-cpu-1x VMs always-on, OR more bandwidth + a paid VM with auto-stop. The `auto_stop_machines = "stop"` setting in `fly.toml` is what keeps this cheap — the VM only runs while serving requests. Expect ~$0/mo if you're under their free hobby allowance, or a few dollars if you exceed it during a demo.
