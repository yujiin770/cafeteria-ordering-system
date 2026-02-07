const bcrypt = require('bcrypt');
const mysql = require('mysql2');

async function createUsers() {
    console.log('🔄 Connecting to database...');
    
    const db = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'cafeteria_db'
    });

    // Connect first
    db.connect((err) => {
        if (err) {
            console.error('❌ DB Connection failed:', err.message);
            return;
        }
        console.log('✅ Connected to MySQL');

        // Delete old users
        db.query('DELETE FROM users WHERE 1=1', (err) => {
            if (err) console.error('Delete error:', err);
            console.log('🗑️  Old users deleted');

            // Create new users
            const users = [
                {username: 'admin', password: 'password', role: 'admin'},
                {username: 'cashier1', password: '1234', role: 'cashier'},
                {username: 'kitchen1', password: '1234', role: 'kitchen'}
            ];

            let completed = 0;
            users.forEach(async (user) => {
                const hash = await bcrypt.hash(user.password, 10);
                
                db.query(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 
                    [user.username, hash, user.role], 
                    (err, result) => {
                        if (err) {
                            console.error(`❌ ${user.username} error:`, err.message);
                        } else {
                            console.log(`✅ ${user.username} (${user.role}) CREATED - ID: ${result.insertId}`);
                        }
                        
                        completed++;
                        if (completed === users.length) {
                            console.log('🎉 ALL USERS CREATED!');
                            console.log('\n📝 LOGIN CREDENTIALS:');
                            console.log('admin / password');
                            console.log('cashier1 / 1234');
                            console.log('kitchen1 / 1234');
                            db.end();
                        }
                    }
                );
            });
        });
    });
}

createUsers();
