const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let userId;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

beforeAll(async () => {
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    userId = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);
});

test('get authenticated user', async () => {
    const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: testUser.name, email: testUser.email, roles: [{ role: 'diner' }] });
    expect(res.body).toHaveProperty('id');
});

test('update user', async () => {
    const newName = 'papa john totino murphy  ' + randomName();
    const newEmail = randomName() + '@test.com';
    const res = await request(app).put(`/api/user/${userId}`).send({ name: newName, email: newEmail, password: 'a' }).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expectValidJwt(res.body.token);
    expect(res.body.user).toMatchObject({ name: newName, email: newEmail, roles: [{ role: 'diner' }] });
    expect(res.body.user).toHaveProperty('id');
});

test('unauthorized user update', async () => {
    const res = await request(app).put(`/api/user/${userId * 42}`).send({ name: 'hamburger', email: randomName() + '@test.com', password: randomName() }).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'unauthorized' });
});