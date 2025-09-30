const request = require('supertest');
const app = require('../service');

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