const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const newMenuItem = { title: 'Hot Honey Barbecue Chicken & Ranch', image: 'pizza1.png', price: 0.042, description: 'A freakin\' delicious pizza' };

let testUserAuthToken;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

async function createAdminUser() {
    let user = { password: 'toomanysecretsformetoremember', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecretsformetoremember' };
}

beforeAll(async () => {
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
});

test('get pizza menu', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(['id', 'title', 'image', 'price', 'description'].sort());
    expect(res.body[0]).toEqual({
        id: expect.anything(),
        title: expect.anything(),
        image: expect.anything(),
        price: expect.anything(),
        description: expect.anything()
    });
});

test('add menu item without permission', async () => {
    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send(newMenuItem);
    expect(res.status).toBe(403);
    delete res.body.stack;
    expect(res.body).toEqual({ message: 'unable to add menu item' });
});

test('add menu item as admin', async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecretsformetoremember' });
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);
    const adminAuthToken = loginRes.body.token;
    newMenuItem.title = randomName();
    newMenuItem.description = randomName();
    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(newMenuItem);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.find(item => item.title === newMenuItem.title)).toEqual({
        id: expect.anything(),
        ...newMenuItem
    });
});

test('get user orders', async () => {
    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dinerId');

    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);

    if (res.body.orders.length > 0) {
        const order = res.body.orders[0];
        expect(order).toHaveProperty('id');
        expect(typeof order.id).toBe('number');
        expect(order).toHaveProperty('franchiseId');
        expect(typeof order.franchiseId).toBe('number');
        expect(order).toHaveProperty('storeId');
        expect(typeof order.storeId).toBe('number');
        expect(order).toHaveProperty('date');
        expect(typeof order.date).toBe('string');
        expect(order).toHaveProperty('items');
        expect(Array.isArray(order.items)).toBe(true);

        if (order.items.length > 0) {
            const item = order.items[0];
            expect(item).toHaveProperty('id');
            expect(typeof item.id).toBe('number');
            expect(item).toHaveProperty('menuId');
            expect(typeof item.menuId).toBe('number');
            expect(item).toHaveProperty('description');
            expect(typeof item.description).toBe('string');
            expect(item).toHaveProperty('price');
            expect(typeof item.price).toBe('number');
        }
    }

    expect(res.body).toHaveProperty('page');
});

test('create order', async () => {
    const orderData = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Hot Honey Barbecue Chicken & Ranch', price: 0.042 }] };
    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send(orderData);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
        order: {
            id: expect.anything(),
            franchiseId: orderData.franchiseId,
            storeId: orderData.storeId,
            items: orderData.items
        },
        jwt: expect.anything()
    });
    expectValidJwt(res.body.jwt);
});

test('create order fails when factory fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ reportUrl: 'http://factory.example.com/report/123' })
    });

    const orderData = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Hot Honey Barbecue Chicken & Ranch', price: 0.042 }] };
    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send(orderData);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
        message: 'Failed to fulfill order at factory',
        followLinkToEndChaos: 'http://factory.example.com/report/123'
    });

    global.fetch = originalFetch;
});