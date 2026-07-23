/**
 * Case submission, workflow, scoping, and file handling — end to end.
 *
 * The dentist-scoping assertions are the important ones here. Scoping is not
 * enforced by a guard; it lives inside CasesService as a query filter plus an
 * explicit access assertion, so only a request-level test proves a dentist
 * cannot reach another dentist's case.
 */
import { INestApplication } from '@nestjs/common';
import { CaseFileType } from '@dental/shared-types';
import { DentalCase } from '../src/database/entities/case.entity';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures, isoDate } from './support/factories';
import { api, login, Session } from './support/http';

/**
 * An ASCII STL. The validator accepts either a binary STL whose length matches
 * `84 + triangles * 50`, or a file whose first bytes spell `solid`.
 */
const STL = Buffer.from('solid test\nfacet normal 0 0 0\nendsolid test\n');
/** Real PNG magic bytes — the validator sniffs content and ignores Content-Type. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);

describe('Cases (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;

  // Rebuilt per test, since every test truncates.
  let catalog: Awaited<ReturnType<Fixtures['catalog']>>;
  let dentist: Awaited<ReturnType<Fixtures['dentist']>>;
  let dentistSession: Session;
  let adminSession: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.connection);
    catalog = await fixtures.catalog();
    dentist = await fixtures.dentist();
    const admin = await fixtures.admin();
    dentistSession = await login(app, dentist.user.email);
    adminSession = await login(app, admin.email);
  });

  const submit = (session: Session, body: Record<string, unknown> = {}) =>
    api(app)
      .post('/api/cases')
      .set('Cookie', session.cookie)
      .send({ caseTypeId: catalog.caseType.id, patientReference: 'PT-001', ...body });

  describe('POST /api/cases', () => {
    it('accepts a submission from a dentist and opens it at the entry status', async () => {
      const res = await submit(dentistSession);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        patientReference: 'PT-001',
        dentistId: dentist.dentist.id,
        // The write DTO calls this `caseStatusId`; the entity column is `currentStatusId`.
        currentStatusId: catalog.entryStatus.id,
      });
      expect(res.body.submittedAt).toBeTruthy();
      expect(res.body.completedAt).toBeNull();
    });

    it('allocates sequential, year-stamped references', async () => {
      const first = await submit(dentistSession);
      const second = await submit(dentistSession);

      const year = new Date().getFullYear();
      expect(first.body.reference).toBe(`CASE-${year}-0001`);
      expect(second.body.reference).toBe(`CASE-${year}-0002`);
    });

    it('seeds the timeline so a new case is never blank', async () => {
      const created = await submit(dentistSession);

      const res = await api(app)
        .get(`/api/cases/${created.body.id}/timeline`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ caseStatusId: catalog.entryStatus.id });
    });

    it('persists the optional clinical fields', async () => {
      const res = await submit(dentistSession, {
        toothRegion: 'UR6',
        material: 'Zirconia',
        shade: 'A2',
        deadline: isoDate(7),
        clinicalNotes: 'Handle with care.',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        toothRegion: 'UR6',
        material: 'Zirconia',
        shade: 'A2',
        clinicalNotes: 'Handle with care.',
      });
    });

    it('rejects a submission with no case type', async () => {
      const res = await api(app)
        .post('/api/cases')
        .set('Cookie', dentistSession.cookie)
        .send({ patientReference: 'PT-001' });

      expect(res.status).toBe(400);
    });

    it('rejects an empty patient reference', async () => {
      const res = await submit(dentistSession, { patientReference: '' });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed deadline', async () => {
      const res = await submit(dentistSession, { deadline: '07-2026-01' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown case type', async () => {
      const res = await submit(dentistSession, {
        caseTypeId: '00000000-0000-4000-8000-000000000000',
      });
      expect(res.status).toBe(404);
    });

    it('refuses a dentist-role user with no dentist profile', async () => {
      const orphan = await fixtures.user();
      const session = await login(app, orphan.email);

      const res = await submit(session);

      expect(res.status).toBe(403);
    });

    it('ignores a dentistId supplied by a dentist, binding the case to the caller', async () => {
      const other = await fixtures.dentist();

      const res = await submit(dentistSession, { dentistId: other.dentist.id });

      expect(res.status).toBe(201);
      // The caller's own profile wins — a dentist cannot file under another.
      expect(res.body.dentistId).toBe(dentist.dentist.id);
    });

    it('requires an admin to name the dentist they are filing for', async () => {
      const res = await api(app)
        .post('/api/cases')
        .set('Cookie', adminSession.cookie)
        .send({ caseTypeId: catalog.caseType.id, patientReference: 'PT-ADMIN' });

      expect(res.status).toBe(403);
    });

    it('lets an admin submit on behalf of a dentist', async () => {
      const res = await api(app)
        .post('/api/cases')
        .set('Cookie', adminSession.cookie)
        .send({
          caseTypeId: catalog.caseType.id,
          patientReference: 'PT-ADMIN',
          dentistId: dentist.dentist.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.dentistId).toBe(dentist.dentist.id);
    });
  });

  describe('dentist scoping', () => {
    it("returns 404 — not 403 — for another dentist's case, so ids stay unconfirmable", async () => {
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);
      const theirCase = await submit(otherSession);

      const res = await api(app)
        .get(`/api/cases/${theirCase.body.id}`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(404);
    });

    it('lists only the caller\'s own cases', async () => {
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);
      await submit(dentistSession, { patientReference: 'MINE' });
      await submit(otherSession, { patientReference: 'THEIRS' });

      const res = await api(app).get('/api/cases').set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientReference).toBe('MINE');
    });

    it('ignores a dentistId filter supplied by a dentist', async () => {
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);
      await submit(dentistSession, { patientReference: 'MINE' });
      await submit(otherSession, { patientReference: 'THEIRS' });

      const res = await api(app)
        .get('/api/cases')
        .query({ dentistId: other.dentist.id })
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientReference).toBe('MINE');
    });

    it('shows an admin every dentist\'s cases', async () => {
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);
      await submit(dentistSession, { patientReference: 'MINE' });
      await submit(otherSession, { patientReference: 'THEIRS' });

      const res = await api(app).get('/api/cases').set('Cookie', adminSession.cookie);

      expect(res.body.meta.total).toBe(2);
    });

    it("blocks a dentist from reading another dentist's timeline", async () => {
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);
      const theirCase = await submit(otherSession);

      const res = await api(app)
        .get(`/api/cases/${theirCase.body.id}/timeline`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(404);
    });

    it('forbids a dentist from driving the workflow', async () => {
      const own = await submit(dentistSession);

      const res = await api(app)
        .patch(`/api/cases/${own.body.id}/status`)
        .set('Cookie', dentistSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id });

      expect(res.status).toBe(403);
    });

    it('forbids a dentist from reassigning a case', async () => {
      const own = await submit(dentistSession);
      const other = await fixtures.dentist();

      const res = await api(app)
        .post(`/api/cases/${own.body.id}/reassign`)
        .set('Cookie', dentistSession.cookie)
        .send({ dentistId: other.dentist.id });

      expect(res.status).toBe(403);
    });
  });

  describe('workflow', () => {
    it('records a status change on the timeline', async () => {
      const created = await submit(dentistSession);

      const res = await api(app)
        .patch(`/api/cases/${created.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id, note: 'Finished milling' });

      expect(res.status).toBe(200);
      expect(res.body.currentStatusId).toBe(catalog.terminalStatus.id);

      const timeline = await api(app)
        .get(`/api/cases/${created.body.id}/timeline`)
        .set('Cookie', adminSession.cookie);
      expect(timeline.body).toHaveLength(2);
      expect(timeline.body.map((h: { note: string }) => h.note)).toContain('Finished milling');
    });

    it('stamps completedAt when the case reaches a terminal status', async () => {
      const created = await submit(dentistSession);

      const res = await api(app)
        .patch(`/api/cases/${created.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id });

      expect(res.body.completedAt).toBeTruthy();
    });

    it('clears completedAt when a completed case is reopened', async () => {
      const created = await submit(dentistSession);
      await api(app)
        .patch(`/api/cases/${created.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id });

      const reopened = await api(app)
        .patch(`/api/cases/${created.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.entryStatus.id });

      expect(reopened.body.completedAt).toBeNull();
    });

    it('rejects an unknown status', async () => {
      const created = await submit(dentistSession);

      const res = await api(app)
        .patch(`/api/cases/${created.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: '00000000-0000-4000-8000-000000000000' });

      expect(res.status).toBe(404);
    });

    it('moves a case to another dentist and logs it', async () => {
      const created = await submit(dentistSession);
      const other = await fixtures.dentist();

      const res = await api(app)
        .post(`/api/cases/${created.body.id}/reassign`)
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: other.dentist.id });

      expect(res.status).toBe(201);
      expect(res.body.dentistId).toBe(other.dentist.id);

      const timeline = await api(app)
        .get(`/api/cases/${created.body.id}/timeline`)
        .set('Cookie', adminSession.cookie);
      expect(timeline.body).toHaveLength(2);
    });

    it('rejects reassignment to a dentist that does not exist', async () => {
      const created = await submit(dentistSession);

      const res = await api(app)
        .post(`/api/cases/${created.body.id}/reassign`)
        .set('Cookie', adminSession.cookie)
        .send({ dentistId: '00000000-0000-4000-8000-000000000000' });

      expect(res.status).toBe(404);
    });
  });

  describe('files', () => {
    let caseId: string;

    beforeEach(async () => {
      const created = await submit(dentistSession);
      caseId = created.body.id;
    });

    it('accepts an STL upload and lists it', async () => {
      const upload = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', STL, 'model.stl');

      expect(upload.status).toBe(201);
      expect(upload.body).toHaveLength(1);
      expect(upload.body[0]).toMatchObject({
        originalFilename: 'model.stl',
        fileType: CaseFileType.STL,
        mimeType: 'model/stl',
      });

      const list = await api(app)
        .get(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie);
      expect(list.body).toHaveLength(1);
    });

    it('classifies by content, not by the extension alone', async () => {
      const upload = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', PNG, 'photo.png');

      expect(upload.status).toBe(201);
      expect(upload.body[0].fileType).toBe(CaseFileType.IMAGE);
    });

    it('streams the stored bytes back on download', async () => {
      const upload = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', STL, 'model.stl');

      const res = await api(app)
        .get(`/api/cases/${caseId}/files/${upload.body[0].id}`)
        .set('Cookie', dentistSession.cookie)
        .buffer()
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body).toEqual(STL);
    });

    it('refuses an executable disguised by its extension', async () => {
      const res = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', Buffer.from('MZ\x90\x00binary'), 'payload.exe');

      expect(res.status).toBe(400);
    });

    it('refuses content that contradicts an allowed extension', async () => {
      const res = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', Buffer.from('MZ\x90\x00this is a PE binary'), 'trojan.stl');

      expect(res.status).toBe(400);
    });

    it('refuses an upload with no file', async () => {
      const res = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .field('fileType', CaseFileType.STL);

      expect(res.status).toBe(400);
    });

    it('stops a dentist from passing work off as a lab deliverable', async () => {
      const res = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .field('fileType', CaseFileType.LAB_OUTPUT)
        .attach('files', STL, 'model.stl');

      expect(res.status).toBe(403);
    });

    it('lets an admin attach a lab deliverable', async () => {
      const res = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', adminSession.cookie)
        .field('fileType', CaseFileType.LAB_OUTPUT)
        .attach('files', STL, 'milled.stl');

      expect(res.status).toBe(201);
      expect(res.body[0].fileType).toBe(CaseFileType.LAB_OUTPUT);
    });

    it("blocks a dentist from downloading another dentist's file", async () => {
      const upload = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', STL, 'model.stl');

      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);

      const res = await api(app)
        .get(`/api/cases/${caseId}/files/${upload.body[0].id}`)
        .set('Cookie', otherSession.cookie);

      expect(res.status).toBe(404);
    });

    it('lets the uploader remove their own file', async () => {
      const upload = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie)
        .attach('files', STL, 'model.stl');

      const res = await api(app)
        .delete(`/api/cases/${caseId}/files/${upload.body[0].id}`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(200);
      const list = await api(app)
        .get(`/api/cases/${caseId}/files`)
        .set('Cookie', dentistSession.cookie);
      expect(list.body).toHaveLength(0);
    });

    it('stops a dentist deleting a lab deliverable', async () => {
      const upload = await api(app)
        .post(`/api/cases/${caseId}/files`)
        .set('Cookie', adminSession.cookie)
        .field('fileType', CaseFileType.LAB_OUTPUT)
        .attach('files', STL, 'milled.stl');

      const res = await api(app)
        .delete(`/api/cases/${caseId}/files/${upload.body[0].id}`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(403);
    });
  });

  describe('listing', () => {
    it('returns a pagination envelope', async () => {
      await submit(dentistSession);

      const res = await api(app)
        .get('/api/cases')
        .query({ page: 1, limit: 10 })
        .set('Cookie', dentistSession.cookie);

      expect(res.body.meta).toMatchObject({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });

    it('clamps an oversized page size to the maximum', async () => {
      await submit(dentistSession);

      const res = await api(app)
        .get('/api/cases')
        .query({ limit: 5000 })
        .set('Cookie', dentistSession.cookie);

      expect(res.body.meta.limit).toBe(100);
    });

    it('searches across the reference and patient fields', async () => {
      await submit(dentistSession, { patientReference: 'SMITH-01' });
      await submit(dentistSession, { patientReference: 'JONES-02' });

      const res = await api(app)
        .get('/api/cases')
        .query({ search: 'smith' })
        .set('Cookie', dentistSession.cookie);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientReference).toBe('SMITH-01');
    });

    it('separates active from completed cases', async () => {
      const open = await submit(dentistSession, { patientReference: 'OPEN' });
      const done = await submit(dentistSession, { patientReference: 'DONE' });
      await api(app)
        .patch(`/api/cases/${done.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id });

      const active = await api(app)
        .get('/api/cases')
        .query({ bucket: 'active' })
        .set('Cookie', dentistSession.cookie);
      const completed = await api(app)
        .get('/api/cases')
        .query({ bucket: 'completed' })
        .set('Cookie', dentistSession.cookie);

      expect(active.body.data.map((c: DentalCase) => c.id)).toEqual([open.body.id]);
      expect(completed.body.data.map((c: DentalCase) => c.id)).toEqual([done.body.id]);
    });

    it('summarises the caller\'s own workload', async () => {
      await submit(dentistSession);
      const done = await submit(dentistSession);
      await api(app)
        .patch(`/api/cases/${done.body.id}/status`)
        .set('Cookie', adminSession.cookie)
        .send({ caseStatusId: catalog.terminalStatus.id });

      const res = await api(app).get('/api/cases/summary').set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, active: 1, completed: 1 });
    });
  });
});
