const request = require('supertest');
const version = require('./version.json');
const app = require('./service.js');

test('get docs', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(version.version);
    expect(res.body.config).toEqual(
        expect.objectContaining({
            factory: expect.any(String),
            db: expect.any(String),
        })
    );
    expect(Array.isArray(res.body.endpoints)).toBe(true);
});

test('get home', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'welcome to JWT Pizza', version: version.version });
});

test('get unknown endpoint', async () => {
    const res = await request(app).get('/nopizzaforyou');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'unknown endpoint' });
});