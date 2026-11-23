import { initDb, run, saveDb } from '../config/db.js';

async function resetOnboarding() {
  await initDb();
  await run("UPDATE students SET is_onboarded = 0, face_descriptor = NULL WHERE email = 'student@test.com'");
  await saveDb();
  console.log('Successfully reset onboarding for student@test.com');
  process.exit(0);
}

resetOnboarding().catch(err => {
  console.error(err);
  process.exit(1);
});
