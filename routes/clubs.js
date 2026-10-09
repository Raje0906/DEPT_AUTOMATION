'use strict';
const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { auditRecord } = require('../middleware/auditLogger');

const router = express.Router();

// Helper to determine user permissions
async function getClubPermissions(user) {
  if (!user) return { canManageAll: false, isClubCoordinator: false, isHOD: false, isAssignedFaculty: false, facultyId: null, assignedClubs: [] };
  const isHOD = user.role === 'hod';
  let isClubCoordinator = !!user.is_club_coordinator;
  let facultyId = user.faculty_id || null;

  if (user.role === 'faculty') {
    const facRes = await pool.query(
      `SELECT f.id, f.is_club_coordinator,
              (SELECT COUNT(*) > 0 FROM coordinator_assignments ca 
               WHERE ca.faculty_id = f.id AND ca.role_type = 'CLUB_HEAD_COORDINATOR' AND ca.is_active = TRUE) as is_assigned_coord
       FROM faculty f WHERE f.user_id = $1`,
      [user.id]
    );
    if (facRes.rows.length > 0) {
      facultyId = facRes.rows[0].id;
      isClubCoordinator = isClubCoordinator || facRes.rows[0].is_club_coordinator || facRes.rows[0].is_assigned_coord;
    }
  }

  let assignedClubs = [];
  if (facultyId) {
    const assignedRes = await pool.query(
      `SELECT id, name, code, category FROM clubs WHERE faculty_coordinator_id = $1 ORDER BY id`,
      [facultyId]
    );
    assignedClubs = assignedRes.rows;
  }

  const isAssignedFaculty = assignedClubs.length > 0;
  const canManageAll = isHOD || isClubCoordinator;

  return {
    isHOD,
    isClubCoordinator,
    isAssignedFaculty,
    canManageAll,
    facultyId,
    assignedClubs
  };
}

// ─── GET /api/clubs/faculty-list ──────────────────────────────────────────────
router.get('/faculty-list', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.id, u.name, f.designation, u.email, f.employee_id
      FROM faculty f
      JOIN users u ON u.id = f.user_id
      WHERE u.is_active = TRUE
      ORDER BY u.name ASC
    `);
    res.json({ faculty: result.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching faculty list:', err);
    res.status(500).json({ error: 'Failed to fetch faculty list' });
  }
});

// ─── GET /api/clubs/student-lookup ───────────────────────────────────────────
router.get('/student-lookup', verifyToken, async (req, res) => {
  try {
    const q = (req.query.q || req.query.query || '').trim();
    if (!q) {
      return res.json({ students: [] });
    }

    const result = await pool.query(`
      SELECT 
        s.id,
        s.enrollment_no AS prn,
        s.roll_no,
        s.division,
        s.class_year,
        u.name AS student_name,
        u.email AS student_email,
        COALESCE(NULLIF(s.mobile, ''), NULLIF(sgm.mobile, ''), NULLIF(pgm.mobile_no, ''), '') AS mobile
      FROM students s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN (
        SELECT prn, mobile FROM seminar_group_members WHERE mobile IS NOT NULL AND mobile != '' GROUP BY prn, mobile
      ) sgm ON (
        UPPER(TRIM(sgm.prn)) = UPPER(TRIM(s.enrollment_no)) 
        OR UPPER(TRIM(sgm.prn)) = UPPER(TRIM(s.roll_no))
      )
      LEFT JOIN (
        SELECT student_name, mobile_no FROM project_group_members WHERE mobile_no IS NOT NULL AND mobile_no != '' GROUP BY student_name, mobile_no
      ) pgm ON (
        UPPER(TRIM(pgm.student_name)) = UPPER(TRIM(u.name))
      )
      WHERE 
        UPPER(TRIM(s.enrollment_no)) ILIKE $1
        OR UPPER(TRIM(s.roll_no)) = $2
        OR u.name ILIKE $3
      ORDER BY 
        CASE WHEN UPPER(TRIM(s.enrollment_no)) = UPPER($4) THEN 1 
             WHEN UPPER(TRIM(s.roll_no)) = UPPER($4) THEN 2 
             ELSE 3 END,
        u.name ASC
      LIMIT 15
    `, [`%${q}%`, q, `%${q}%`, q]);

    res.json({ students: result.rows });
  } catch (err) {
    console.error('[Clubs] Error looking up student:', err);
    res.status(500).json({ error: 'Failed to lookup student' });
  }
});

// ─── GET /api/clubs ───────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const academicYear = req.query.academicYear || '2026-27';
    const permissions = await getClubPermissions(req.user);

    // Fetch clubs with faculty coordinator details, mentor details, and event/member stats
    const clubsRes = await pool.query(`
      SELECT 
        c.*,
        u.name AS faculty_name,
        u.email AS faculty_email,
        f.designation AS faculty_designation,
        u_mentor.name AS mentor_faculty_name,
        u_mentor.email AS mentor_faculty_email,
        f_mentor.designation AS mentor_faculty_designation,
        COALESCE(u_mentor.name, c.mentor_name) AS effective_mentor_name,
        COALESCE(u_mentor.email, c.mentor_email) AS effective_mentor_email,
        COALESCE(f_mentor.designation, c.mentor_designation) AS effective_mentor_designation,
        (SELECT COUNT(*)::int FROM club_events ce WHERE ce.club_id = c.id AND ce.academic_year = $1) AS event_count,
        (SELECT COUNT(*)::int FROM club_members cm WHERE cm.club_id = c.id AND cm.academic_year = $1) AS member_count,
        (SELECT COUNT(*)::int FROM club_events ce WHERE ce.club_id = c.id AND ce.academic_year = $1 AND ce.status = 'Approved' AND ce.start_date >= CURRENT_DATE) AS upcoming_events_count
      FROM clubs c
      LEFT JOIN faculty f ON f.id = c.faculty_coordinator_id
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN faculty f_mentor ON f_mentor.id = c.mentor_faculty_id
      LEFT JOIN users u_mentor ON u_mentor.id = f_mentor.user_id
      ORDER BY c.status = 'Active' DESC, c.id ASC
    `, [academicYear]);

    // Active Head Coordinator info
    const headCoordRes = await pool.query(`
      SELECT ca.id, ca.faculty_id, ca.academic_year, ca.appointed_at, ca.notes,
             u.name AS faculty_name, u.email AS faculty_email, f.designation
      FROM coordinator_assignments ca
      JOIN faculty f ON f.id = ca.faculty_id
      JOIN users u ON u.id = f.user_id
      WHERE ca.role_type = 'CLUB_HEAD_COORDINATOR' AND ca.academic_year = $1 AND ca.is_active = TRUE
      LIMIT 1
    `, [academicYear]);

    // Overall KPI statistics
    const statsRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT c.id)::int AS total_clubs,
        COUNT(DISTINCT CASE WHEN c.status = 'Active' THEN c.id END)::int AS active_clubs,
        COALESCE(SUM(ce_agg.event_count), 0)::int AS total_events,
        COALESCE(SUM(ce_agg.upcoming_count), 0)::int AS upcoming_events,
        COALESCE(SUM(cm_agg.member_count), 0)::int AS total_members,
        COALESCE(SUM(ce_agg.approved_budget), 0)::numeric AS total_budget_approved
      FROM clubs c
      LEFT JOIN (
        SELECT club_id, 
               COUNT(*)::int AS event_count, 
               COUNT(CASE WHEN status = 'Approved' AND start_date >= CURRENT_DATE THEN 1 END)::int AS upcoming_count,
               SUM(approved_budget)::numeric AS approved_budget
        FROM club_events
        WHERE academic_year = $1
        GROUP BY club_id
      ) ce_agg ON ce_agg.club_id = c.id
      LEFT JOIN (
        SELECT club_id, COUNT(*)::int AS member_count
        FROM club_members
        WHERE academic_year = $1
        GROUP BY club_id
      ) cm_agg ON cm_agg.club_id = c.id
    `, [academicYear]);

    res.json({
      academicYear,
      permissions,
      headCoordinator: headCoordRes.rows[0] || null,
      stats: statsRes.rows[0] || {
        total_clubs: 0,
        active_clubs: 0,
        total_events: 0,
        upcoming_events: 0,
        total_members: 0,
        total_budget_approved: 0
      },
      clubs: clubsRes.rows
    });
  } catch (err) {
    console.error('[Clubs] Error fetching clubs overview:', err);
    res.status(500).json({ error: 'Failed to fetch clubs overview' });
  }
});

// ─── POST /api/clubs (Create Club) ───────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  try {
    const permissions = await getClubPermissions(req.user);
    if (!permissions.canManageAll) {
      return res.status(403).json({ error: 'Only the Club Head Coordinator or HOD can register new clubs.' });
    }

    const {
      name,
      code,
      category,
      department = 'Computer Engineering',
      description,
      faculty_coordinator_id,
      student_lead_name,
      student_lead_email,
      student_lead_phone,
      student_lead_division,
      student_lead_prn,
      vice_president_name,
      vice_president_prn,
      vice_president_phone,
      vice_president_division,
      academic_year = '2026-27',
      status = 'Active',
      founded_year = new Date().getFullYear().toString(),
      website_or_link
    } = req.body;

    if (!name || !code || !category) {
      return res.status(400).json({ error: 'Club Name, Code/Acronym, and Category are required.' });
    }

    const insertRes = await pool.query(`
      INSERT INTO clubs (
        name, code, category, department, description, faculty_coordinator_id,
        student_lead_name, student_lead_email, student_lead_phone, student_lead_division,
        student_lead_prn, vice_president_name, vice_president_prn, vice_president_phone, vice_president_division,
        academic_year, status, founded_year, website_or_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      name.trim(),
      code.trim().toUpperCase(),
      category,
      department,
      description || null,
      faculty_coordinator_id || null,
      student_lead_name || null,
      student_lead_email || null,
      student_lead_phone || null,
      student_lead_division || null,
      student_lead_prn || null,
      vice_president_name || null,
      vice_president_prn || null,
      vice_president_phone || null,
      vice_president_division || null,
      academic_year,
      status,
      founded_year,
      website_or_link || null
    ]);

    await auditRecord({
      tableName: 'clubs',
      recordId: insertRes.rows[0].id,
      changedBy: req.user.id,
      action: 'CREATE_CLUB',
      oldValue: null,
      newValue: insertRes.rows[0],
      reason: `Registered new club: ${name} (${code})`
    });

    res.status(201).json({ message: 'Club created successfully', club: insertRes.rows[0] });
  } catch (err) {
    console.error('[Clubs] Error creating club:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: `A club with code '${req.body.code}' already exists.` });
    }
    res.status(500).json({ error: 'Failed to create club' });
  }
});

// ─── PUT /api/clubs/:id (Update Club) ─────────────────────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const permissions = await getClubPermissions(req.user);

    const existingRes = await pool.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }
    const current = existingRes.rows[0];

    // Allowed if canManageAll OR if user is the assigned faculty advisor for this club
    const isAdvisor = permissions.facultyId && permissions.facultyId === current.faculty_coordinator_id;
    if (!permissions.canManageAll && !isAdvisor) {
      return res.status(403).json({ error: 'You do not have permission to edit this club.' });
    }

    const {
      name,
      code,
      category,
      department,
      description,
      motto,
      logo_url,
      faculty_coordinator_id,
      student_lead_name,
      student_lead_email,
      student_lead_phone,
      student_lead_division,
      student_lead_prn,
      vice_president_name,
      vice_president_prn,
      vice_president_phone,
      vice_president_division,
      status,
      founded_year,
      website_or_link
    } = req.body;

    const updateRes = await pool.query(`
      UPDATE clubs SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        category = COALESCE($3, category),
        department = COALESCE($4, department),
        description = COALESCE($5, description),
        faculty_coordinator_id = CASE WHEN $6::int IS NOT NULL THEN $6::int ELSE faculty_coordinator_id END,
        student_lead_name = $7,
        student_lead_email = $8,
        student_lead_phone = $9,
        student_lead_division = $10,
        student_lead_prn = $11,
        vice_president_name = $12,
        vice_president_prn = $13,
        vice_president_phone = $14,
        vice_president_division = $15,
        status = COALESCE($16, status),
        founded_year = COALESCE($17, founded_year),
        website_or_link = $18,
        motto = COALESCE($19, motto),
        logo_url = COALESCE($20, logo_url),
        updated_at = NOW()
      WHERE id = $21
      RETURNING *
    `, [
      name ? name.trim() : null,
      code ? code.trim().toUpperCase() : null,
      category || null,
      department || null,
      description || null,
      faculty_coordinator_id !== undefined ? faculty_coordinator_id : null,
      student_lead_name !== undefined ? student_lead_name : current.student_lead_name,
      student_lead_email !== undefined ? student_lead_email : current.student_lead_email,
      student_lead_phone !== undefined ? student_lead_phone : current.student_lead_phone,
      student_lead_division !== undefined ? student_lead_division : current.student_lead_division,
      student_lead_prn !== undefined ? student_lead_prn : current.student_lead_prn,
      vice_president_name !== undefined ? vice_president_name : current.vice_president_name,
      vice_president_prn !== undefined ? vice_president_prn : current.vice_president_prn,
      vice_president_phone !== undefined ? vice_president_phone : current.vice_president_phone,
      vice_president_division !== undefined ? vice_president_division : current.vice_president_division,
      status || null,
      founded_year || null,
      website_or_link !== undefined ? website_or_link : current.website_or_link,
      motto !== undefined ? motto : null,
      logo_url !== undefined ? logo_url : null,
      clubId
    ]);

    await auditRecord({
      tableName: 'clubs',
      recordId: clubId,
      changedBy: req.user.id,
      action: 'UPDATE_CLUB',
      oldValue: current,
      newValue: updateRes.rows[0],
      reason: `Updated club details for ${updateRes.rows[0].name}`
    });

    res.json({ message: 'Club updated successfully', club: updateRes.rows[0] });
  } catch (err) {
    console.error('[Clubs] Error updating club:', err);
    res.status(500).json({ error: 'Failed to update club' });
  }
});

// ─── PUT /api/clubs/:id/assign-faculty ────────────────────────────────────────
router.put('/:id/assign-faculty', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const permissions = await getClubPermissions(req.user);
    if (!permissions.canManageAll) {
      return res.status(403).json({ error: 'Only the Club Head Coordinator or HOD can assign faculty in-charge.' });
    }

    const { faculty_id } = req.body;
    const clubRes = await pool.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
    if (clubRes.rows.length === 0) {
      return res.status(404).json({ error: 'Club or SIH unit not found' });
    }
    const currentClub = clubRes.rows[0];

    let facultyName = 'Unassigned';
    if (faculty_id) {
      const facRes = await pool.query(
        `SELECT f.id, u.name, f.designation FROM faculty f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
        [faculty_id]
      );
      if (facRes.rows.length === 0) {
        return res.status(400).json({ error: 'Selected faculty member not found.' });
      }
      facultyName = facRes.rows[0].name;
    }

    const updateRes = await pool.query(
      `UPDATE clubs SET faculty_coordinator_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [faculty_id || null, clubId]
    );

    await auditRecord({
      tableName: 'clubs',
      recordId: clubId,
      changedBy: req.user.id,
      action: 'ASSIGN_FACULTY_IN_CHARGE',
      oldValue: { faculty_coordinator_id: currentClub.faculty_coordinator_id },
      newValue: { faculty_coordinator_id: faculty_id, facultyName },
      reason: `Assigned ${facultyName} as Faculty In-Charge for ${currentClub.name} (${currentClub.code})`
    });

    res.json({
      message: `Assigned ${facultyName} as Faculty In-Charge for ${currentClub.name}`,
      club: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[Clubs] Error assigning faculty:', err);
    res.status(500).json({ error: 'Failed to assign faculty to club' });
  }
});

// ─── PUT /api/clubs/:id/assign-mentor ─────────────────────────────────────────
router.put('/:id/assign-mentor', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const permissions = await getClubPermissions(req.user);

    const clubRes = await pool.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
    if (clubRes.rows.length === 0) {
      return res.status(404).json({ error: 'Club or SIH unit not found' });
    }
    const currentClub = clubRes.rows[0];

    const isThisClubHead = permissions.facultyId && Number(permissions.facultyId) === Number(currentClub.faculty_coordinator_id);
    if (!permissions.canManageAll && !isThisClubHead) {
      return res.status(403).json({ error: 'Only the Club Head Coordinator or the Faculty In-Charge of this club can assign the club mentor.' });
    }

    const {
      mentor_faculty_id,
      mentor_name,
      mentor_email,
      mentor_designation,
      mentor_type = 'Faculty Mentor',
      mentor_phone
    } = req.body;

    let finalMentorName = mentor_name;
    let finalMentorEmail = mentor_email;
    let finalMentorDesig = mentor_designation;

    if (mentor_faculty_id) {
      const facRes = await pool.query(
        `SELECT f.id, u.name, u.email, f.designation FROM faculty f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
        [mentor_faculty_id]
      );
      if (facRes.rows.length > 0) {
        finalMentorName = facRes.rows[0].name;
        finalMentorEmail = facRes.rows[0].email;
        finalMentorDesig = facRes.rows[0].designation;
      }
    }

    const updateRes = await pool.query(`
      UPDATE clubs SET
        mentor_faculty_id = $1,
        mentor_name = $2,
        mentor_email = $3,
        mentor_designation = $4,
        mentor_type = $5,
        mentor_phone = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      mentor_faculty_id || null,
      finalMentorName || null,
      finalMentorEmail || null,
      finalMentorDesig || null,
      mentor_type || 'Faculty Mentor',
      mentor_phone || null,
      clubId
    ]);

    await auditRecord({
      tableName: 'clubs',
      recordId: clubId,
      changedBy: req.user.id,
      action: 'ASSIGN_CLUB_MENTOR',
      oldValue: { mentor_name: currentClub.mentor_name, mentor_faculty_id: currentClub.mentor_faculty_id },
      newValue: { mentor_name: finalMentorName, mentor_faculty_id, mentor_type },
      reason: `Assigned ${finalMentorName || 'Mentor'} as ${mentor_type} for ${currentClub.name} (${currentClub.code})`
    });

    res.json({
      message: `Assigned ${finalMentorName || 'Club Mentor'} successfully for ${currentClub.name}`,
      club: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[Clubs] Error assigning club mentor:', err);
    res.status(500).json({ error: 'Failed to assign club mentor' });
  }
});

// ─── DELETE /api/clubs/:id (Delete/Deactivate Club) ───────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const permissions = await getClubPermissions(req.user);
    if (!permissions.canManageAll) {
      return res.status(403).json({ error: 'Only the Club Head Coordinator or HOD can remove a club.' });
    }

    const currentRes = await pool.query('SELECT * FROM clubs WHERE id = $1', [clubId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    await pool.query('DELETE FROM clubs WHERE id = $1', [clubId]);

    await auditRecord({
      tableName: 'clubs',
      recordId: clubId,
      changedBy: req.user.id,
      action: 'DELETE_CLUB',
      oldValue: currentRes.rows[0],
      newValue: null,
      reason: `Removed club: ${currentRes.rows[0].name} (${currentRes.rows[0].code})`
    });

    res.json({ message: 'Club deleted successfully' });
  } catch (err) {
    console.error('[Clubs] Error deleting club:', err);
    res.status(500).json({ error: 'Failed to delete club' });
  }
});

// ─── GET /api/clubs/events (List Events) ───────────────────────────────────────
router.get('/events', verifyToken, async (req, res) => {
  try {
    const academicYear = req.query.academicYear || '2026-27';
    const clubId = req.query.clubId ? parseInt(req.query.clubId, 10) : null;
    const userId = req.user ? req.user.id : null;

    let query = `
      SELECT ce.*, c.name AS club_name, c.code AS club_code, c.category AS club_category,
             u.name AS created_by_name,
             (SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = ce.id) AS registered_count,
             (SELECT COUNT(*) > 0 FROM club_event_registrations cer WHERE cer.event_id = ce.id AND cer.user_id = $2) AS is_registered,
             (SELECT cer.status FROM club_event_registrations cer WHERE cer.event_id = ce.id AND cer.user_id = $2 LIMIT 1) AS registration_status,
             (SELECT cer.registered_at FROM club_event_registrations cer WHERE cer.event_id = ce.id AND cer.user_id = $2 LIMIT 1) AS registered_at
      FROM club_events ce
      JOIN clubs c ON c.id = ce.club_id
      LEFT JOIN faculty f ON f.id = ce.created_by_faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE ce.academic_year = $1
    `;
    const params = [academicYear, userId];

    if (clubId) {
      params.push(clubId);
      query += ` AND ce.club_id = $${params.length}`;
    }

    query += ` ORDER BY ce.start_date DESC, ce.id DESC`;

    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ─── POST /api/clubs/events/:id/register (Register for Event) ─────────────────
router.post('/events/:id/register', verifyToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // Verify event exists
    const evRes = await pool.query('SELECT * FROM club_events WHERE id = $1', [eventId]);
    if (evRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = evRes.rows[0];

    // Fetch student info
    const stRes = await pool.query(`
      SELECT s.id as student_id, s.enrollment_no, s.roll_no, s.division, s.class_year, s.mobile,
             u.name, u.email
      FROM users u
      LEFT JOIN students s ON s.user_id = u.id
      WHERE u.id = $1
    `, [userId]);

    const student = stRes.rows[0];
    const studentName = (req.body.student_name || student?.name || req.user.name || 'Student').trim();
    const prn = (req.body.prn || student?.enrollment_no || '').trim().toUpperCase();
    const rollNo = (req.body.roll_no || student?.roll_no || '').trim();
    const division = (req.body.division || student?.division || 'TE-A').trim();
    const classYear = (req.body.class_year || student?.class_year || 'TE').trim();
    const email = (req.body.email || student?.email || req.user.email || '').trim();
    const contactNo = (req.body.contact_no || student?.mobile || '').trim();
    const notes = req.body.notes ? req.body.notes.trim() : null;

    const insRes = await pool.query(`
      INSERT INTO club_event_registrations (
        event_id, user_id, student_id, student_name, prn, roll_no, division, class_year, email, contact_no, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Registered')
      ON CONFLICT (event_id, user_id) 
      DO UPDATE SET 
        student_name = EXCLUDED.student_name,
        contact_no = COALESCE(EXCLUDED.contact_no, club_event_registrations.contact_no),
        notes = EXCLUDED.notes,
        status = 'Registered'
      RETURNING *
    `, [
      eventId,
      userId,
      student?.student_id || null,
      studentName,
      prn,
      rollNo,
      division,
      classYear,
      email,
      contactNo,
      notes
    ]);

    // Update actual_participants count
    await pool.query(`
      UPDATE club_events 
      SET actual_participants = (SELECT COUNT(*)::int FROM club_event_registrations WHERE event_id = $1)
      WHERE id = $1
    `, [eventId]);

    res.status(201).json({
      message: `Successfully registered for "${event.title}"!`,
      registration: insRes.rows[0]
    });
  } catch (err) {
    console.error('[Clubs] Error registering for event:', err);
    res.status(500).json({ error: 'Failed to register for event' });
  }
});

// ─── DELETE /api/clubs/events/:id/register (Cancel Registration) ──────────────
router.delete('/events/:id/register', verifyToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM club_event_registrations WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    // Update actual_participants count
    await pool.query(`
      UPDATE club_events 
      SET actual_participants = (SELECT COUNT(*)::int FROM club_event_registrations WHERE event_id = $1)
      WHERE id = $1
    `, [eventId]);

    res.json({ message: 'Registration cancelled successfully' });
  } catch (err) {
    console.error('[Clubs] Error cancelling registration:', err);
    res.status(500).json({ error: 'Failed to cancel registration' });
  }
});

// ─── POST /api/clubs/events (Propose / Register Event) ────────────────────────
router.post('/events', verifyToken, async (req, res) => {
  try {
    const permissions = await getClubPermissions(req.user);
    const {
      club_id,
      title,
      event_type,
      academic_year = '2026-27',
      start_date,
      end_date,
      time,
      venue,
      mode = 'Offline',
      proposed_budget = 0,
      approved_budget = 0,
      expected_participants = 0,
      speaker_or_trainer,
      description,
      status = 'Approved',
      coordinator_remarks
    } = req.body;

    if (!club_id || !title || !event_type || !start_date || !venue) {
      return res.status(400).json({ error: 'Club, Title, Event Type, Start Date, and Venue are required.' });
    }

    // Default status: if Club Head Coordinator or HOD, can create directly as 'Approved'
    // If regular faculty advisor, defaults to 'Submitted' or 'Approved'
    const finalStatus = permissions.canManageAll ? (status || 'Approved') : 'Submitted';

    const insertRes = await pool.query(`
      INSERT INTO club_events (
        club_id, title, event_type, academic_year, start_date, end_date,
        time, venue, mode, proposed_budget, approved_budget, expected_participants,
        speaker_or_trainer, description, status, coordinator_remarks, created_by_faculty_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      club_id,
      title.trim(),
      event_type,
      academic_year,
      start_date,
      end_date || null,
      time || null,
      venue.trim(),
      mode,
      parseFloat(proposed_budget) || 0,
      parseFloat(approved_budget) || 0,
      parseInt(expected_participants, 10) || 0,
      speaker_or_trainer || null,
      description || null,
      finalStatus,
      coordinator_remarks || null,
      permissions.facultyId || null
    ]);

    await auditRecord({
      tableName: 'club_events',
      recordId: insertRes.rows[0].id,
      changedBy: req.user.id,
      action: 'CREATE_CLUB_EVENT',
      oldValue: null,
      newValue: insertRes.rows[0],
      reason: `Organized club event: ${title} (${event_type})`
    });

    res.status(201).json({ message: 'Event recorded successfully', event: insertRes.rows[0] });
  } catch (err) {
    console.error('[Clubs] Error creating event:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// ─── PUT /api/clubs/events/:id (Update / Approve Event) ───────────────────────
router.put('/events/:id', verifyToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const permissions = await getClubPermissions(req.user);

    const existingRes = await pool.query('SELECT * FROM club_events WHERE id = $1', [eventId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const current = existingRes.rows[0];

    const {
      title,
      event_type,
      start_date,
      end_date,
      time,
      venue,
      mode,
      proposed_budget,
      approved_budget,
      expected_participants,
      actual_participants,
      speaker_or_trainer,
      description,
      status,
      coordinator_remarks
    } = req.body;

    const updateRes = await pool.query(`
      UPDATE club_events SET
        title = COALESCE($1, title),
        event_type = COALESCE($2, event_type),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        time = COALESCE($5, time),
        venue = COALESCE($6, venue),
        mode = COALESCE($7, mode),
        proposed_budget = CASE WHEN $8::numeric IS NOT NULL THEN $8::numeric ELSE proposed_budget END,
        approved_budget = CASE WHEN $9::numeric IS NOT NULL THEN $9::numeric ELSE approved_budget END,
        expected_participants = CASE WHEN $10::int IS NOT NULL THEN $10::int ELSE expected_participants END,
        actual_participants = CASE WHEN $11::int IS NOT NULL THEN $11::int ELSE actual_participants END,
        speaker_or_trainer = COALESCE($12, speaker_or_trainer),
        description = COALESCE($13, description),
        status = COALESCE($14, status),
        coordinator_remarks = COALESCE($15, coordinator_remarks),
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
    `, [
      title ? title.trim() : null,
      event_type || null,
      start_date || null,
      end_date || null,
      time || null,
      venue ? venue.trim() : null,
      mode || null,
      proposed_budget !== undefined ? parseFloat(proposed_budget) : null,
      approved_budget !== undefined ? parseFloat(approved_budget) : null,
      expected_participants !== undefined ? parseInt(expected_participants, 10) : null,
      actual_participants !== undefined ? parseInt(actual_participants, 10) : null,
      speaker_or_trainer || null,
      description || null,
      status || null,
      coordinator_remarks || null,
      eventId
    ]);

    await auditRecord({
      tableName: 'club_events',
      recordId: eventId,
      changedBy: req.user.id,
      action: 'UPDATE_CLUB_EVENT',
      oldValue: current,
      newValue: updateRes.rows[0],
      reason: `Updated event status/details for ${updateRes.rows[0].title}`
    });

    res.json({ message: 'Event updated successfully', event: updateRes.rows[0] });
  } catch (err) {
    console.error('[Clubs] Error updating event:', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// ─── DELETE /api/clubs/events/:id (Delete Event) ─────────────────────────────
router.delete('/events/:id', verifyToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const existingRes = await pool.query('SELECT * FROM club_events WHERE id = $1', [eventId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await pool.query('DELETE FROM club_events WHERE id = $1', [eventId]);
    await auditRecord({
      tableName: 'club_events',
      recordId: eventId,
      changedBy: req.user.id,
      action: 'DELETE_CLUB_EVENT',
      oldValue: existingRes.rows[0],
      newValue: null,
      reason: `Deleted event: ${existingRes.rows[0].title}`
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('[Clubs] Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ─── GET /api/clubs/:id/members (Get Members) ─────────────────────────────────
router.get('/:id/members', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const academicYear = req.query.academicYear || '2026-27';

    const result = await pool.query(`
      SELECT cm.*, COALESCE(cm.prn, s.enrollment_no, cm.roll_no) AS prn, s.roll_no AS student_roll_no, s.enrollment_no
      FROM club_members cm
      LEFT JOIN students s ON (
        s.id = cm.student_id
        OR (cm.prn IS NOT NULL AND cm.prn != '' AND LOWER(TRIM(s.enrollment_no)) = LOWER(TRIM(cm.prn)))
        OR (cm.prn IS NOT NULL AND cm.prn != '' AND LOWER(TRIM(s.roll_no)) = LOWER(TRIM(cm.prn)))
      )
      WHERE cm.club_id = $1 AND cm.academic_year = $2
      ORDER BY cm.is_core DESC, cm.role ASC, cm.student_name ASC
    `, [clubId, academicYear]);

    res.json({ members: result.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching club members:', err);
    res.status(500).json({ error: 'Failed to fetch club members' });
  }
});

// ─── POST /api/clubs/:id/members (Add Member / Committee) ─────────────────────
router.post('/:id/members', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const {
      student_name,
      roll_no,
      prn,
      division,
      class_year = 'TE',
      role = 'Member',
      academic_year = '2026-27',
      is_core = false
    } = req.body;

    if (!student_name) {
      return res.status(400).json({ error: 'Student name is required.' });
    }

    // Try finding matching student ID & details if PRN or roll_no provided
    let studentId = null;
    let finalDivision = division ? division.trim() : '';
    let finalClassYear = class_year || 'TE';
    const searchPrn = prn || roll_no;

    if (searchPrn) {
      const stRes = await pool.query(
        `SELECT s.id, s.division, s.class_year, s.roll_no, s.enrollment_no, u.name as user_name
         FROM students s
         LEFT JOIN users u ON u.id = s.user_id
         WHERE LOWER(TRIM(s.enrollment_no)) = LOWER($1) OR LOWER(TRIM(s.roll_no)) = LOWER($1)`,
        [searchPrn.trim()]
      );

      if (stRes.rows.length > 0) {
        const st = stRes.rows[0];
        studentId = st.id;

        // Auto-detect & normalize division from DB if not explicitly customized
        if (!finalDivision || finalDivision === 'TE-A') {
          const yr = (st.class_year || 'TE').toUpperCase().trim();
          let div = (st.division || '').toUpperCase().trim();
          if (div.startsWith(yr)) {
            div = div.slice(yr.length).replace(/^[-_\s]+/, '').trim();
          }
          if (div === '1' || div === 'I') div = 'A';
          else if (div === '2' || div === 'II') div = 'B';
          else if (div === '3' || div === 'III') div = 'C';
          else if (div === '4' || div === 'IV') div = 'D';
          finalDivision = div ? `${yr}-${div}` : yr;
          finalClassYear = yr;
        }
      } else if (!finalDivision || finalDivision === 'TE-A') {
        // Fallback pattern detection if student not in DB
        const fMatch = searchPrn.trim().toUpperCase().match(/^([FS])(\d{2})(\d{2})?(\d)?/);
        if (fMatch) {
          const admYear = parseInt(fMatch[2], 10);
          const divDigit = fMatch[4];
          let year = 'TE';
          if (admYear === 22) year = 'BE';
          else if (admYear === 23) year = 'TE';
          else if (admYear === 24) year = 'SE';
          else if (admYear === 25) year = 'FE';
          else if (admYear <= 21) year = 'BE';

          let div = 'A';
          if (divDigit === '1') div = 'A';
          else if (divDigit === '2') div = 'B';
          else if (divDigit === '3') div = 'C';

          finalDivision = `${year}-${div}`;
          finalClassYear = year;
        }
      }
    }

    if (!finalDivision) {
      finalDivision = 'TE-A';
    }

    const insertRes = await pool.query(`
      INSERT INTO club_members (
        club_id, student_id, student_name, roll_no, prn, division, class_year, role, academic_year, is_core
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      clubId,
      studentId,
      student_name.trim(),
      roll_no ? roll_no.trim().toUpperCase() : null,
      searchPrn ? searchPrn.trim().toUpperCase() : null,
      finalDivision,
      finalClassYear,
      role.trim(),
      academic_year,
      is_core
    ]);

    // Automatically sync leadership role to clubs table
    const cleanRole = (role || '').trim();
    if (cleanRole === 'President') {
      await pool.query(`
        UPDATE clubs 
        SET student_lead_name = $1, student_lead_prn = $2, student_lead_division = $3
        WHERE id = $4
      `, [student_name.trim(), searchPrn ? searchPrn.trim().toUpperCase() : null, finalDivision, clubId]);
    } else if (cleanRole === 'Vice President') {
      await pool.query(`
        UPDATE clubs 
        SET vice_president_name = $1, vice_president_prn = $2, vice_president_division = $3
        WHERE id = $4
      `, [student_name.trim(), searchPrn ? searchPrn.trim().toUpperCase() : null, finalDivision, clubId]);
    }

    res.status(201).json({ message: 'Member added successfully', member: insertRes.rows[0] });
  } catch (err) {
    console.error('[Clubs] Error adding member:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// ─── DELETE /api/clubs/members/:id (Remove Member) ────────────────────────────
router.delete('/members/:id', verifyToken, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id, 10);
    const memRes = await pool.query('SELECT * FROM club_members WHERE id = $1', [memberId]);
    if (memRes.rows.length > 0) {
      const m = memRes.rows[0];
      if (m.role === 'President') {
        await pool.query('UPDATE clubs SET student_lead_name = NULL, student_lead_prn = NULL, student_lead_phone = NULL, student_lead_division = NULL WHERE id = $1', [m.club_id]);
      } else if (m.role === 'Vice President') {
        await pool.query('UPDATE clubs SET vice_president_name = NULL, vice_president_prn = NULL, vice_president_phone = NULL, vice_president_division = NULL WHERE id = $1', [m.club_id]);
      }
    }

    await pool.query('DELETE FROM club_members WHERE id = $1', [memberId]);
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('[Clubs] Error removing member:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
