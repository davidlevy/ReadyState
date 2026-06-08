import * as dotenv from 'dotenv';
dotenv.config({ path: '/app/data/.env' });
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import * as crypto from 'crypto';
const app = new Hono();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
app.get('/', (c) => {
    return c.text('Hello Hono!');
});
app.post('/webhooks/github', async (c) => {
    try {
        const bodyText = await c.req.text();
        const signature = c.req.header('x-hub-signature-256');
        const secret = process.env.READYSTATE_WRITE_TOKEN;
        if (!secret) {
            return c.json({ error: 'Server not configured with WRITE_TOKEN' }, 500);
        }
        if (!signature) {
            return c.json({ error: 'Missing x-hub-signature-256' }, 401);
        }
        const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(bodyText).digest('hex')}`;
        const sigBuffer = Buffer.from(signature);
        const expectedSigBuffer = Buffer.from(expectedSignature);
        if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
            return c.json({ error: 'Unauthorized signature' }, 401);
        }
        const payload = JSON.parse(bodyText);
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
