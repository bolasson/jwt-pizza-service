const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'test diner', email: 'reg@test.com', password: 'a' };
const testFranchise = { "name": "test franchise", "admins": [{ "email": "f@jwt.com" }] };

let testUserAuthToken;
let testAdminAuthToken;
let testAdminUser;

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

    const adminUser = await createAdminUser();
    const loginAdminRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecretsformetoremember' });
    expectValidJwt(loginAdminRes.body.token);

    testAdminUser = loginAdminRes.body.user;

    testAdminAuthToken = loginAdminRes.body.token;
    testFranchise.name = randomName();
    testFranchise.admins[0].email = adminUser.email;
    await request(app).post('/api/franchise').set('Authorization', `Bearer ${testAdminAuthToken}`).send(testFranchise);
});

test('get all franchises', async () => {
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(res.body.franchises.map(f => f.name)).toContain(testFranchise.name);
    expect(Array.isArray(res.body.franchises)).toBe(true);
});

test('get user franchises', async () => {
    const res = await request(app).get(`/api/franchise/${testAdminUser.id}`).set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map(f => f.name)).toContain(testFranchise.name);
    expect(res.body.map(f => f.admins).flat().map(a => a.email)).toContain(testFranchise.admins[0].email);
});