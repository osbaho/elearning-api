import { initDb, run, closeDb } from '../config/db.js';

async function resetOnboarding() {
  await initDb();
  await run("UPDATE students SET is_onboarded = 0, face_descriptor = NULL WHERE email = 'student@test.com'");
  await closeDb();
  console.log('Successfully reset onboarding for student@test.com');
  process.exit(0);
}

resetOnboarding().catch(err => {
  console.error(err);
  process.exit(1);
});
