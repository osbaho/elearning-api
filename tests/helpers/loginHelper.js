export async function performLogin(page, email = 'student@test.com', password = 'student123', reset = true) {
  if (reset) {
    try {
      await page.request.post('http://localhost:5000/api/test-reset', {
        data: { email, password },
        headers: {
          'x-test-secret': process.env.TEST_RESET_SECRET || 'test-reset-secret-local'
        }
      });
    } catch (e) {
      // Ignore if test-reset is unavailable
    }
  }

  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(course|onboarding|admin)/);
}

export async function resetStudentState(request, options = {}) {
  const {
    email = 'student@test.com',
    password = 'student123',
    reserve_points,
    exam_attempts,
    exam_score,
    is_onboarded,
    complete_course,
    pass_exam
  } = options;

  const res = await request.post('http://localhost:5000/api/test-reset', {
    data: {
      email,
      password,
      reserve_points,
      exam_attempts,
      exam_score,
      is_onboarded,
      complete_course,
      pass_exam
    },
    headers: {
      'x-test-secret': process.env.TEST_RESET_SECRET || 'test-reset-secret-local'
    }
  });
  return res.json();
}
