import { initDb, run, closeDb } from '../config/db.js';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  await initDb();
  
  const rawPassword = process.env.ADMIN_PASSWORD;
  if (!rawPassword && process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: En producción es obligatorio definir ADMIN_PASSWORD en las variables de entorno.');
    process.exit(1);
  }

  const passwordToHash = rawPassword || 'test-admin-password';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(passwordToHash, salt);
  const adminName = process.env.ADMIN_NAME || 'Administrador';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';

  try {
    await run(
      `INSERT INTO students (name, username, password, email, role, reserve_points) VALUES (?, ?, ?, ?, ?, ?)`,
      [adminName, adminUsername, hash, adminEmail, 'admin', 150]
    );
    console.log(`✅ Admin created with email: ${adminEmail}`);
  } catch (error) {
    // SQLite: "UNIQUE constraint failed"; PostgreSQL: "duplicate key value violates unique constraint"
    if (error.message && /unique constraint/i.test(error.message)) {
      console.log('⚠️ Admin user already exists.');
    } else {
      console.error('❌ Error creating admin user:', error);
    }
  }
}

seedAdmin()
  .catch((err) => {
    console.error('❌ Error en el seed del administrador:', err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
