import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiAs, type Envelope } from './helpers';

/**
 * Each test below asserts the SECURE expectation. A FAILING test here is a real
 * RBAC / data-disclosure vulnerability present in the running app — these are the
 * findings, not flaky tests. See the accompanying bug report.
 *
 * Root cause: the affected GET handlers call `withAuth(request)` with no `roles`
 * option and no ownership check, so any authenticated user (incl. student/parent)
 * can read data scoped to other people / classes / staff.
 */
test.describe('RBAC & data-leak expectations  (a FAILURE = a vulnerability)', () => {
  let admin: APIRequestContext;
  let student: APIRequestContext;
  let parent: APIRequestContext;
  let someClassId = '';
  let someTeacherId = '';

  test.beforeAll(async () => {
    admin = await apiAs('super_admin');
    student = await apiAs('student');
    parent = await apiAs('parent');

    const wl = (
      (await (await admin.get('/api/v1/workload')).json()) as Envelope<{
        teachers: Array<{ id: string }>;
        classes: Array<{ id: string }>;
      }>
    ).data!;
    someTeacherId = wl.teachers[0].id;
    someClassId = wl.classes[0].id;
  });
  test.afterAll(async () => {
    await admin.dispose();
    await student.dispose();
    await parent.dispose();
  });

  test('student cannot read an arbitrary class journal', async () => {
    const res = await student.get(`/api/v1/grading/class-journal?classId=${someClassId}`);
    expect(res.status(), 'student should be denied an arbitrary class journal').toBe(403);
  });

  test('parent cannot read an arbitrary class journal', async () => {
    const res = await parent.get(`/api/v1/grading/class-journal?classId=${someClassId}`);
    expect(res.status(), 'parent should be denied an arbitrary class journal').toBe(403);
  });

  test('student cannot read teacher load-transfer history (grades leak)', async () => {
    const res = await student.get(`/api/v1/workload/transfer?toTeacherId=${someTeacherId}`);
    expect(res.status(), 'workload/transfer GET must restrict by role/ownership').toBe(403);
  });

  test('student cannot list all staff (email/role disclosure)', async () => {
    const res = await student.get('/api/v1/teachers');
    expect(res.status(), 'student should not enumerate staff').toBe(403);
  });

  test('student cannot read the school-wide grading overview', async () => {
    const res = await student.get('/api/v1/grading/overview');
    expect(res.status(), 'student should not read the grading overview').toBe(403);
  });

  test('parent cannot list all fee invoices (finance leak)', async () => {
    const res = await parent.get('/api/v1/fee-invoices');
    expect(res.status(), 'generic invoice list must be staff-only; parents use /mine').toBe(403);
  });

  test('student cannot list all fee invoices (finance leak)', async () => {
    const res = await student.get('/api/v1/fee-invoices');
    expect(res.status(), 'generic invoice list must be staff-only; students use /mine').toBe(403);
  });

  test('parent /fee-invoices/mine returns only own children invoices', async () => {
    const res = await parent.get('/api/v1/fee-invoices/mine');
    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<Array<{ studentId: string }>>;
    expect(json.success).toBe(true);
    // все счета принадлежат детям этого родителя
    const me = (
      (await (await parent.get('/api/v1/me')).json()) as Envelope<{
        children?: Array<{ studentId: string }>;
      }>
    ).data!;
    const myIds = new Set((me.children ?? []).map((c) => c.studentId));
    for (const inv of json.data ?? []) {
      expect(myIds.has(inv.studentId), `invoice for foreign student ${inv.studentId}`).toBe(true);
    }
  });

  test('parent cannot register a payment', async () => {
    const res = await parent.post('/api/v1/payments', { data: { invoiceId: 'x', amount: 1 } });
    expect(res.status(), 'payments POST must be staff-only').toBe(403);
  });

  test('student cannot read finance summary', async () => {
    const res = await student.get('/api/v1/finance/summary');
    expect(res.status(), 'finance summary is owner/accountant-only').toBe(403);
  });
});
