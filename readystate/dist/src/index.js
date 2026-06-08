import * as dotenv from 'dotenv';
dotenv.config({ path: '/app/data/.env' });
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import * as crypto from 'crypto';
import YAML from 'yaml';
const app = new Hono();
import { PrismaClient } from '@prisma/client';
import { normalizeEnvironment } from './utils/envMapper.js';
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
        const rawEnvironment = payload.deployment?.environment || payload.environment;
        const environment = normalizeEnvironment(rawEnvironment);
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
        const repoFullName = payload.repository?.full_name;
        if (!repoFullName) {
            console.warn('Webhook: Missing repository.full_name in payload, skipping manifest fetch.');
            return c.json({ success: true, env, message: 'Environment saved but no repository found to fetch manifest.' }, 200);
        }
        const manifestUrl = `https://raw.githubusercontent.com/${repoFullName}/${sha}/readystate-manifest.yml`;
        console.log(`Fetching manifest from: ${manifestUrl}`);
        let capabilitiesCount = 0;
        try {
            const response = await fetch(manifestUrl);
            if (response.ok) {
                const manifestText = await response.text();
                const manifest = YAML.parse(manifestText);
                if (manifest.capabilities && Array.isArray(manifest.capabilities)) {
                    for (const cap of manifest.capabilities) {
                        if (cap.id && cap.description !== undefined) {
                            const annotationsStr = cap.annotations ? JSON.stringify(cap.annotations) : null;
                            await prisma.capability.upsert({
                                where: { capabilityId_environmentName: { capabilityId: cap.id, environmentName: environment } },
                                update: {
                                    description: cap.description,
                                    requiredFlag: cap.requiredFlag || null,
                                    annotations: annotationsStr
                                },
                                create: {
                                    capabilityId: cap.id,
                                    description: cap.description,
                                    requiredFlag: cap.requiredFlag || null,
                                    annotations: annotationsStr,
                                    environmentName: environment
                                }
                            });
                            capabilitiesCount++;
                        }
                    }
                }
            }
            else {
                console.warn(`Manifest not found or error fetching (${response.status}) at ${manifestUrl}`);
            }
        }
        catch (fetchErr) {
            console.error('Error fetching manifest:', fetchErr);
        }
        return c.json({ success: true, env, capabilitiesInserted: capabilitiesCount }, 200);
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
