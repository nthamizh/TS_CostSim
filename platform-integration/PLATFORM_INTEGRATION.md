# CostSimulator → Platform Integration

## 1. Copy files
```
platform-integration/api/src/modules/costsim/costsim.proxy.ts → platform-base/apps/api/src/modules/costsim/
platform-integration/web/src/pages/costsim/CostSimLoader.tsx  → platform-base/apps/web/src/pages/costsim/
```

## 2. platform-base/apps/api/src/routes/index.ts
```ts
import { costsimRouter } from "../modules/costsim/costsim.proxy.js";
v1Router.use("/costsim", costsimRouter);
```

## 3. platform-base/apps/api/src/config/env.ts — add to envSchema
```ts
COSTSIM_API_URL:       z.string().url().optional(),
COSTSIM_SHARED_SECRET: z.string().min(32).optional(),
```

## 4. Coolify — platform-base env vars
```
COSTSIM_API_URL=http://costsim-api:4002
COSTSIM_SHARED_SECRET=<same secret as CostSim COSTSIM_SHARED_SECRET>
```

## 5. platform-base/apps/web/vite.config.ts — federation remotes
```ts
costsim: { external: "/costsim-remote/assets/remoteEntry.js", format: "esm", from: "vite" },
```

## 6. platform-base/apps/web/src/App.tsx — add route
```tsx
import { CostSimLoader } from "./pages/costsim/CostSimLoader";
// Inside EnterpriseAppShell Route:
<Route path="/costsim/*" element={<CostSimLoader />} />
```

## 7. Platform DB — module + roles
```sql
INSERT INTO modules (key,name,description) VALUES
  ('cost_simulator','Cost Simulator','Oracle HCM Payroll costing simulator')
ON CONFLICT (key) DO NOTHING;

INSERT INTO roles (key,name,type) VALUES
  ('costsim_view',       'CostSim – View',       'system'),
  ('costsim_enterprise', 'CostSim – Enterprise', 'system'),
  ('costsim_agency',     'CostSim – Agency',     'system')
ON CONFLICT (key) DO NOTHING;

-- role_permissions (get role/module UUIDs first):
-- costsim_view:       {"view_simulate":true,"view_interagency":true,"manage_data":false}
-- costsim_enterprise: {"view_simulate":true,"view_interagency":true,"manage_data":true}
-- costsim_agency:     {"view_simulate":false,"view_interagency":true,"manage_data":false}
```

## 8. Traefik — update yourdomain.com in docker-compose.coolify.yml
Edit the HostRegexp label in costsim-web to your actual domain.
