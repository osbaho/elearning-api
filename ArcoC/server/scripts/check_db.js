import { initDb, get, closeDb } from '../config/db.js';
async function main() {
  await initDb();
  const row = await get("SELECT is_onboarded FROM students WHERE email = 'student@test.com'");
  console.log('is_onboarded:', row);
  await closeDb();
}
main();
