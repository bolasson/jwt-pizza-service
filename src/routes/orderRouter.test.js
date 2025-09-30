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