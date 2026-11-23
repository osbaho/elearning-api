import { test, expect } from '@playwright/test';
import { performLogin, resetStudentState } from '../helpers/loginHelper.js';

test.describe('Auth, Session & Payload Chaos Testing', () => {

  test('Rejects SQL injection payloads in login without revealing schema or crashing', async ({ request }) => {
    const maliciousPayloads = [
      { email: "' OR '1'='1", password: 'password123' },
      { email: "admin' OR 1=1 --", password: 'any' },
      { email: "student@test.com' UNION SELECT 1,2,3,4,5,6,7,8,9 --", password: 'pass' },
      { email: "'; DROP TABLE students; --", password: 'pass' }
    ];

    for (const payload of maliciousPayloads) {
      const res = await request.post('http://localhost:5000/api/login', { data: payload });
      expect(res.status()).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Credenciales inválidas');
    }
  });

  test('Rejects non-string and malformed types in login payload with 400 Bad Request', async ({ request }) => {
    const typeViolationPayloads = [
      { email: 12345, password: 'password123' },
      { email: true, password: 'password123' },
      { email: ['student@test.com'], password: 'password123' },
      { email: { address: 'student@test.com' }, password: 'password123' },
      { email: 'student@test.com', password: 987654 },
      { email: 'student@test.com', password: null },
      {}
    ];

    for (const payload of typeViolationPayloads) {
      const res = await request.post('http://localhost:5000/api/login', { data: payload });
      expect(res.status()).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    }
  });

  test('Non-existent email executes anti-timing comparison and returns 401', async ({ request }) => {
    const res = await request.post('http://localhost:5000/api/login', {
      data: {
        email: 'ghost_user_999999@doesnotexist.org',
        password: 'any_random_password'
      }
    });

    expect(res.status()).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Credenciales inválidas');
  });

  test('Rejects forged, expired, and garbage JWT tokens gracefully', async ({ request }) => {
    const invalidTokens = [
      'Bearer test_mock_invalid_header.test_mock_payload.test_mock_signature',
      'Bearer completely_random_garbage_string_12345',
      'Bearer ',
      'Basic test_mock_invalid_auth_credentials',
      'InvalidPrefix token123',
      ''
    ];

    for (const authHeader of invalidTokens) {
      const res = await request.get('http://localhost:5000/api/student/me', {
        headers: { Authorization: authHeader }
      });
      // 401 cuando no hay token, 403 cuando el token tiene firma inválida o corrupta
      expect([401, 403]).toContain(res.status());
      const json = await res.json();
      expect(json.error).toBeDefined();
    }
  });

  test('Logout cleanly clears HttpOnly session cookie', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);
    await expect(page).toHaveURL(/.*course/);

    // Ejecutar logout
    const logoutRes = await page.request.post('http://localhost:5000/api/logout');
    expect(logoutRes.status()).toBe(200);

    // Verificar que una llamada subsiguiente a /api/student/me sin cookie sea rechazada
    const meRes = await page.request.get('http://localhost:5000/api/student/me');
    expect(meRes.status()).toBe(401);
  });

  test('Onboarding biometric vector validation rejects non-128 lengths and non-numeric values', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    // 1. Vector con 127 elementos (falta 1)
    const shortVector = Array(127).fill(0.05);
    const shortRes = await page.request.post('http://localhost:5000/api/student/onboarding', {
      data: {
        id_number: '12345678',
        institution: 'Hospital Central',
        face_descriptor: shortVector
      }
    });
    expect(shortRes.status()).toBe(400);
    expect((await shortRes.json()).error).toContain('128 puntos');

    // 2. Vector con 129 elementos (excede 1)
    const longVector = Array(129).fill(0.05);
    const longRes = await page.request.post('http://localhost:5000/api/student/onboarding', {
      data: {
        id_number: '12345678',
        institution: 'Hospital Central',
        face_descriptor: longVector
      }
    });
    expect(longRes.status()).toBe(400);

    // 3. Vector con valores no numéricos
    const dirtyVector = Array(128).fill(0.05);
    dirtyVector[10] = 'HACK_STRING';
    const dirtyRes = await page.request.post('http://localhost:5000/api/student/onboarding', {
      data: {
        id_number: '12345678',
        institution: 'Hospital Central',
        face_descriptor: dirtyVector
      }
    });
    expect(dirtyRes.status()).toBe(400);
    expect((await dirtyRes.json()).error).toContain('numéricos inválidos');

    // 4. Campos de identificación en blanco o solo espacios
    const emptyIdRes = await page.request.post('http://localhost:5000/api/student/onboarding', {
      data: {
        id_number: '   ',
        institution: 'Hospital Central',
        face_descriptor: Array(128).fill(0.05)
      }
    });
    expect(emptyIdRes.status()).toBe(400);
    expect((await emptyIdRes.json()).error).toContain('número de identificación');
  });

  test('Biometric descriptor endpoint decrypts AES-256-GCM properly and matches original vector', async ({ page }) => {
    await performLogin(page, 'student@test.com', 'student123', true);

    const testVector = Array(128).fill(0).map((_, i) => Math.sin(i));
    const submitRes = await page.request.post('http://localhost:5000/api/student/onboarding', {
      data: {
        id_number: '987654321',
        id_type: 'CE',
        institution: 'Clínica Santa Fe',
        face_descriptor: testVector
      }
    });
    expect(submitRes.status()).toBe(200);

    // Consultar el endpoint seguro /api/student/descriptor
    const fetchDescRes = await page.request.get('http://localhost:5000/api/student/descriptor');
    expect(fetchDescRes.status()).toBe(200);
    const { descriptor } = await fetchDescRes.json();

    expect(descriptor).toHaveLength(128);
    // Comparar valores numéricos flotantes con precisión
    for (let i = 0; i < 128; i++) {
      expect(descriptor[i]).toBeCloseTo(testVector[i], 4);
    }
  });

});
