const bcrypt = require('bcrypt');

const passwords = [
    { user: 'admin', pass: 'password' },
    { user: 'cashier1', pass: '1234' },
    { user: 'kitchen1', pass: '1234' }
];

passwords.forEach(async ({ user, pass }) => {
    const hash = await bcrypt.hash(pass, 10);
    console.log(`INSERT INTO users (username, password, role) VALUES ('${user}', '${hash}', '${user.includes('admin') ? 'admin' : user.includes('cashier') ? 'cashier' : 'kitchen'}');`);
});
