const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'test diner', email: 'reg@test.com', password: 'a' };
const testFranchise = { "name": "test franchise", "admins": [{ "email": "f@jwt.com" }] };
const testFranchise2 = { "name": "test franchise 2", "admins": [{ "email": "f@jwt.com" }] };

let testUserAuthToken;
let testAdminAuthToken;

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
    testUser.id = registerRes.body.user.id;
    expectValidJwt(testUserAuthToken);

    const adminUser = await createAdminUser();
    const loginAdminRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecretsformetoremember' });
    expectValidJwt(loginAdminRes.body.token);

    testAdminAuthToken = loginAdminRes.body.token;
    testFranchise.name = randomName();
    testFranchise.admins[0].email = adminUser.email;
    testFranchise2.name = randomName();
    testFranchise2.admins[0].email = testUser.email;
    await request(app).post('/api/franchise').set('Authorization', `Bearer ${testAdminAuthToken}`).send(testFranchise);
    await request(app).post('/api/franchise').set('Authorization', `Bearer ${testAdminAuthToken}`).send(testFranchise2);
});

test('get all franchises', async () => {
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(res.body.franchises.map(f => f.name)).toContain(testFranchise2.name);
    expect(Array.isArray(res.body.franchises)).toBe(true);
});

test('get user franchises', async () => {
    const res = await request(app).get(`/api/franchise/${testUser.id}`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.map(f => f.name)).toContain(testFranchise2.name);
    expect(res.body.map(f => f.admins).flat().map(a => a.email)).toContain(testFranchise2.admins[0].email);
});

test('get user franchises as external user', async () => {
    const otherUser = { name: 'other user', email: randomName() + '@test.com', password: 'b' };
    const registerRes = await request(app).post('/api/auth').send(otherUser);
    const otherUserAuthToken = registerRes.body.token;
    expectValidJwt(otherUserAuthToken);
    const res = await request(app).get(`/api/franchise/${testUser.id}`).set('Authorization', `Bearer ${otherUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
});

test('post franchise without admin role', async () => {
    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'should not work', admins: [{ email: testUser.email }] });
    expect(res.status).toBe(403);
    delete res.body.stack;
    expect(res.body).toEqual({ message: 'unable to create a franchise' });
});

test('delete franchise', async () => {
    const resFranchises = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    const franchiseToDelete = resFranchises.body.franchises.find(f => f.name === testFranchise.name);
    expect(franchiseToDelete).toBeDefined();
    const deleteRes = await request(app).delete(`/api/franchise/${franchiseToDelete.id}`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ message: 'franchise deleted' });
    const resFranchisesAfter = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(resFranchisesAfter.body.franchises.find(f => f.name === testFranchise.name)).toBeUndefined();
});

test('post store', async () => {
    const resFranchises = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    const franchiseToAddStore = resFranchises.body.franchises.find(f => f.name === testFranchise2.name);
    expect(franchiseToAddStore).toBeDefined();
    const newStore = { name: randomName(), address: 'Bag End, Bagshot Row, Hobbiton, Westfarthing, the Shire, Middle-Earth', phone: '801-867-5309' };
    const storeRes = await request(app).post(`/api/franchise/${franchiseToAddStore.id}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send(newStore);
    expect(storeRes.status).toBe(200);
    expect(storeRes.body).toHaveProperty('id');
    expect(storeRes.body).toHaveProperty('franchiseId', franchiseToAddStore.id);
    expect(storeRes.body.name).toBe(newStore.name);
});

test('post store with invalid franchise id', async () => {
    const storeRes = await request(app).post(`/api/franchise/-1/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: 'should not work', address: 'nowhere', phone: '000-000-0000' });
    expect(storeRes.status).toBe(403);
    delete storeRes.body.stack;
    expect(storeRes.body).toEqual({ message: 'unable to create a store' });
});

test('delete store', async () => {
    const resFranchises = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
    const franchise = resFranchises.body.franchises.find(f => f.name === testFranchise2.name);
    expect(franchise).toBeDefined();
    const storeRes = await request(app).post(`/api/franchise/${franchise.id}/store`).set('Authorization', `Bearer ${testUserAuthToken}`).send({ name: randomName(), address: 'Bag End, Bagshot Row, Hobbiton, Westfarthing, the Shire, Middle-Earth', phone: '801-867-5309' });
    expect(storeRes.status).toBe(200);
    const storeId = storeRes.body.id;
    const deleteRes = await request(app).delete(`/api/franchise/${franchise.id}/store/${storeId}`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ message: 'store deleted' });
});

test('delete store with invalid franchise id', async () => {
    const deleteRes = await request(app).delete(`/api/franchise/-1/store/1`).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(deleteRes.status).toBe(403);
    delete deleteRes.body.stack;
    expect(deleteRes.body).toEqual({ message: 'unable to delete a store' });
});