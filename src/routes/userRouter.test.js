const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testAdminAuthToken;
let userId;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

async function createAdminUser() {
    let user = { password: 'toomanysecretsformetoremember', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = `${user.name}@admin.com`;
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecretsformetoremember' };
}

beforeAll(async () => {
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    userId = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);

    const adminUser = await createAdminUser();
    const loginAdminRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecretsformetoremember' });
    testAdminAuthToken = loginAdminRes.body.token;
    expectValidJwt(testAdminAuthToken);
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

test('list users unauthorized', async () => {
    const res = await request(app).get('/api/user');
    expect(res.status).toBe(401);
});

test('list users forbidden', async () => {
    const res = await request(app).get('/api/user').set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'unauthorized' });
});

test('list users', async () => {
    const res = await request(app).get('/api/user?page=1&limit=10&name=*').set('Authorization', `Bearer ${testAdminAuthToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body).toHaveProperty('more');
    if (res.body.users.length) {
        expect(res.body.users[0]).toHaveProperty('roles');
    }
});

test('delete user unauthorized', async () => {
    const res = await request(app).delete('/api/user/9999');
    expect(res.status).toBe(401);
});

test('delete user forbidden', async () => {
    const res = await request(app).delete('/api/user/1').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'unauthorized' });
});

test('delete user not found', async () => {
    const res = await request(app).delete('/api/user/999999').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'not found' });
});

test('delete user', async () => {
    const deleteableUser = { name: 'delete me', email: `${randomName()}@t.com`, password: 'x' };
    const reg = await request(app).post('/api/auth').send(deleteableUser);
    const deleteableUserId = reg.body.user.id;

    const res = await request(app).delete(`/api/user/${deleteableUserId}`).set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(204);
});