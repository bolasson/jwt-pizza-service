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

describe('config picks database based on NODE_ENV', () => {
    const ORIGINAL_ENV = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_ENV;
        jest.resetModules();
    });

    test('use temp database when NODE_ENV=test', () => {
        process.env.NODE_ENV = 'test';
        jest.isolateModules(() => {
            const config = require('./config.js');
            expect(config.db.connection.database).toContain('temp');
        });
    });

    test('use regular database when NODE_ENV!=test', () => {
        process.env.NODE_ENV = 'development';
        jest.isolateModules(() => {
            const config = require('./config.js');
            expect(config.db.connection.database).not.toContain('temp');
        });
    });
});
