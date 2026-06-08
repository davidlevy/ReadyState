import { serve } from '@hono/node-server';
import { Hono } from 'hono';
const app = new Hono();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
app.get('/', (c) => {
    return c.text('Hello Hono!');
});
app.post('/webhooks/github', async (c) => {
    try {
        const payload = await c.req.json();
        const state = payload.deployment_status?.state || payload.state;
        const environment = payload.deployment?.environment || payload.environment;
        const sha = payload.deployment?.sha || payload.sha;
        if (state !== 'success') {
            return c.json({ message: 'Ignored, state is not success' }, 200);
        }
        if (!environment || !sha) {
            return c.json({ error: 'Missing environment or sha' }, 400);
        }
        const env = await prisma.environment.upsert({
            where: { name: environment },
            update: { currentSha: String(sha) },
            create: { name: environment, currentSha: String(sha) },
        });
        const capability = await prisma.capability.upsert({
            where: { id: 'api-checkout-v2' },
            update: { environmentName: environment },
            create: {
                id: 'api-checkout-v2',
                description: 'Checkout V2 API',
                requiredFlag: 'mixpanel_checkout_active',
                environmentName: environment
            }
        });
        return c.json({ success: true, env, capability }, 200);
    }
    catch (err) {
        console.error('Webhook Error:', err);
        return c.json({ error: 'Internal server error' }, 500);
    }
});
serve({
    fetch: app.fetch,
    port: 3000
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
