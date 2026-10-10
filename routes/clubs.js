'use strict';
const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

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

// Helper to check if user is coordinator of a specific club (or HOD/Head Coordinator)
async function isCoordinatorOfClub(user, clubId) {
  if (!user) return false;
  const permissions = await getClubPermissions(user);
  if (permissions.canManageAll) return true;
  if (!permissions.facultyId) return false;
  const clubRes = await pool.query('SELECT faculty_coordinator_id FROM clubs WHERE id = $1', [clubId]);
  if (clubRes.rows.length === 0) return false;
  return Number(clubRes.rows[0].faculty_coordinator_id) === Number(permissions.facultyId);
}

// ─── GET /api/clubs/my-office-bearer-roles (Dynamic roles for current student) ─
router.get('/my-office-bearer-roles', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const academicYear = req.query.academicYear || '2026-27';

    const result = await pool.query(`
      SELECT cob.id, cob.club_id, cob.role, cob.academic_year, cob.assigned_at,
             c.name AS club_name, c.code AS club_code, c.category AS club_category, c.status AS club_status,
             c.description AS club_description
      FROM club_office_bearers cob
      JOIN clubs c ON c.id = cob.club_id
      LEFT JOIN students s ON s.id = cob.student_id
      WHERE (cob.user_id = $1 OR s.user_id = $1)
        AND cob.academic_year = $2
      ORDER BY cob.assigned_at DESC
    `, [userId, academicYear]);

    res.json({ roles: result.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching student office bearer roles:', err);
    res.status(500).json({ error: 'Failed to fetch office bearer roles' });
  }
});

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

    // Only approved events are visible to students in the common activities view
    if (req.user?.role === 'student') {
      query += ` AND (ce.status = 'Approved' OR UPPER(ce.status) = 'APPROVED')`;
    } else if (req.query.status) {
      params.push(req.query.status);
      query += ` AND UPPER(ce.status) = UPPER($${params.length})`;
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

// ─── GET /api/clubs/:id/office-bearers (Get President & VP for Club) ──────────
router.get('/:id/office-bearers', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const academicYear = req.query.academicYear || '2026-27';

    const result = await pool.query(`
      SELECT cob.*,
             u.name AS student_name,
             u.email AS student_email,
             s.roll_no,
             s.enrollment_no AS prn,
             s.division,
             s.class_year,
             s.mobile,
             assigned_u.name AS assigned_by_name
      FROM club_office_bearers cob
      JOIN students s ON s.id = cob.student_id
      JOIN users u ON u.id = cob.user_id
      LEFT JOIN users assigned_u ON assigned_u.id = cob.assigned_by
      WHERE cob.club_id = $1 AND cob.academic_year = $2
      ORDER BY CASE WHEN cob.role = 'President' THEN 1 ELSE 2 END
    `, [clubId, academicYear]);

    res.json({ officeBearers: result.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching office bearers:', err);
    res.status(500).json({ error: 'Failed to fetch office bearers' });
  }
});

// ─── POST /api/clubs/:id/office-bearers (Assign President or VP) ─────────────
router.post('/:id/office-bearers', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const clubId = parseInt(req.params.id, 10);
    const isCoord = await isCoordinatorOfClub(req.user, clubId);
    if (!isCoord) {
      return res.status(403).json({ error: 'You are not authorized to manage office bearers for this club.' });
    }

    const { student_id, role, academic_year = '2026-27' } = req.body;
    if (!student_id || !role) {
      return res.status(400).json({ error: 'Student and role are required.' });
    }
    if (role !== 'President' && role !== 'Vice President') {
      return res.status(400).json({ error: 'Role must be either President or Vice President.' });
    }

    // Fetch student & user details
    const stRes = await client.query(`
      SELECT s.id, s.user_id, s.roll_no, s.enrollment_no, s.division, s.class_year, s.mobile,
             u.name, u.email
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [student_id]);

    if (stRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in records.' });
    }
    const student = stRes.rows[0];

    // Check: A student can hold only one office bearer role per club
    const existingStudentRole = await client.query(`
      SELECT role FROM club_office_bearers 
      WHERE club_id = $1 AND student_id = $2 AND academic_year = $3 AND role != $4
    `, [clubId, student_id, academic_year, role]);

    if (existingStudentRole.rows.length > 0) {
      return res.status(400).json({
        error: `This student is already designated as ${existingStudentRole.rows[0].role} for this club. A student can hold only one office bearer role per club.`
      });
    }

    await client.query('BEGIN');

    // Remove any previous bearer for this role in this club and academic year
    await client.query(`
      DELETE FROM club_office_bearers
      WHERE club_id = $1 AND role = $2 AND academic_year = $3
    `, [clubId, role, academic_year]);

    // Insert new office bearer
    const insRes = await client.query(`
      INSERT INTO club_office_bearers (
        club_id, student_id, user_id, role, academic_year, assigned_by, assigned_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [clubId, student.id, student.user_id, role, academic_year, req.user.id]);

    // Sync to clubs table columns
    const formattedDiv = student.division 
      ? (student.division.startsWith(student.class_year || 'TE') ? student.division : `${student.class_year || 'TE'}-${student.division}`)
      : 'TE-A';

    if (role === 'President') {
      await client.query(`
        UPDATE clubs SET
          student_lead_name = $1,
          student_lead_email = $2,
          student_lead_phone = $3,
          student_lead_division = $4,
          student_lead_prn = $5,
          updated_at = NOW()
        WHERE id = $6
      `, [student.name, student.email, student.mobile || null, formattedDiv, student.enrollment_no, clubId]);
    } else if (role === 'Vice President') {
      await client.query(`
        UPDATE clubs SET
          vice_president_name = $1,
          vice_president_phone = $2,
          vice_president_division = $3,
          vice_president_prn = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [student.name, student.mobile || null, formattedDiv, student.enrollment_no, clubId]);
    }

    // Also sync to club_members
    await client.query(`
      DELETE FROM club_members
      WHERE club_id = $1 AND academic_year = $2 AND role = $3
    `, [clubId, academic_year, role]);

    await client.query(`
      INSERT INTO club_members (
        club_id, student_id, student_name, roll_no, prn, division, class_year, role, academic_year, is_core, joined_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW())
    `, [clubId, student.id, student.name, student.roll_no, student.enrollment_no, formattedDiv, student.class_year || 'TE', role, academic_year]);

    await client.query('COMMIT');

    res.status(201).json({
      message: `${role} assigned successfully for this club.`,
      officeBearer: insRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clubs] Error assigning office bearer:', err);
    res.status(500).json({ error: err.message || 'Failed to assign office bearer' });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/clubs/:id/office-bearers/:bearerId (Revoke Role) ─────────────
router.delete('/:id/office-bearers/:bearerId', verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const clubId = parseInt(req.params.id, 10);
    const bearerId = parseInt(req.params.bearerId, 10);

    const isCoord = await isCoordinatorOfClub(req.user, clubId);
    if (!isCoord) {
      return res.status(403).json({ error: 'You are not authorized to revoke office bearers for this club.' });
    }

    const curRes = await client.query('SELECT * FROM club_office_bearers WHERE id = $1 AND club_id = $2', [bearerId, clubId]);
    if (curRes.rows.length === 0) {
      return res.status(404).json({ error: 'Office bearer record not found.' });
    }
    const current = curRes.rows[0];

    await client.query('BEGIN');

    await client.query('DELETE FROM club_office_bearers WHERE id = $1', [bearerId]);

    if (current.role === 'President') {
      await client.query(`
        UPDATE clubs SET
          student_lead_name = NULL,
          student_lead_email = NULL,
          student_lead_phone = NULL,
          student_lead_division = NULL,
          student_lead_prn = NULL,
          updated_at = NOW()
        WHERE id = $1
      `, [clubId]);
    } else if (current.role === 'Vice President') {
      await client.query(`
        UPDATE clubs SET
          vice_president_name = NULL,
          vice_president_phone = NULL,
          vice_president_division = NULL,
          vice_president_prn = NULL,
          updated_at = NOW()
        WHERE id = $1
      `, [clubId]);
    }

    // Remove role from club_members
    await client.query(`
      DELETE FROM club_members
      WHERE club_id = $1 AND academic_year = $2 AND role = $3
    `, [clubId, current.academic_year, current.role]);

    await client.query('COMMIT');

    res.json({ message: `${current.role} revoked successfully.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clubs] Error revoking office bearer:', err);
    res.status(500).json({ error: 'Failed to revoke office bearer' });
  } finally {
    client.release();
  }
});

// ─── POST /api/clubs/:id/propose-event (President / VP Submits Event) ─────────
router.post('/:id/propose-event', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // Verify user is President or Vice President of THIS club
    const bearerRes = await pool.query(`
      SELECT cob.*, c.name AS club_name
      FROM club_office_bearers cob
      JOIN clubs c ON c.id = cob.club_id
      LEFT JOIN students s ON s.id = cob.student_id
      WHERE (cob.user_id = $1 OR s.user_id = $1) AND cob.club_id = $2
    `, [userId, clubId]);

    if (bearerRes.rows.length === 0) {
      return res.status(403).json({ error: 'Only the President or Vice President of this club can propose events.' });
    }
    const bearer = bearerRes.rows[0];

    const {
      title,
      event_type,
      start_date,
      end_date,
      time,
      venue,
      mode = 'Offline',
      description,
      expected_participants = 60,
      speaker_or_trainer,
      academic_year = '2026-27'
    } = req.body;

    // Required field validation
    if (!title || !title.trim()) return res.status(400).json({ error: 'Event Title is required.' });
    if (!event_type) return res.status(400).json({ error: 'Event Type is required.' });
    if (!start_date) return res.status(400).json({ error: 'Event Date is required.' });
    if (!time || !time.trim()) return res.status(400).json({ error: 'Event Time is required.' });
    if (!venue || !venue.trim()) return res.status(400).json({ error: 'Event Venue / Platform is required.' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'Event Description is required.' });

    // Validate mode
    if (mode !== 'Offline' && mode !== 'Online') {
      return res.status(400).json({ error: 'Mode must be either Offline or Online.' });
    }

    // Validate description length
    if (description.trim().length > 2500) {
      return res.status(400).json({ error: 'Description must not exceed 2500 characters.' });
    }

    // Validate date cannot be in the past
    const todayStr = new Date().toISOString().split('T')[0];
    if (start_date < todayStr) {
      return res.status(400).json({ error: 'Event date cannot be in the past.' });
    }

    // Find student_id
    const stRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [userId]);
    const studentId = stRes.rows.length > 0 ? stRes.rows[0].id : bearer.student_id;

    const insRes = await pool.query(`
      INSERT INTO club_events (
        club_id, title, event_type, academic_year, start_date, end_date,
        time, venue, mode, description, expected_participants, speaker_or_trainer,
        status, submitted_by_student_id, submitted_by_user_id, submitted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', $13, $14, NOW(), NOW(), NOW())
      RETURNING *
    `, [
      clubId,
      title.trim(),
      event_type.trim(),
      academic_year,
      start_date,
      end_date || null,
      time.trim(),
      venue.trim(),
      mode,
      description.trim(),
      parseInt(expected_participants, 10) || 60,
      speaker_or_trainer ? speaker_or_trainer.trim() : null,
      studentId,
      userId
    ]);

    res.status(201).json({
      message: 'Event submitted successfully for Coordinator approval.',
      event: insRes.rows[0]
    });
  } catch (err) {
    console.error('[Clubs] Error proposing event:', err);
    res.status(500).json({ error: err.message || 'Failed to propose event' });
  }
});

// ─── GET /api/clubs/:id/my-club-events (For President/VP & Coordinator) ───────
router.get('/:id/my-club-events', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const academicYear = req.query.academicYear || '2026-27';

    // Verify access: Coordinator, HOD, or President/VP of this club
    const isCoord = await isCoordinatorOfClub(req.user, clubId);
    let isBearer = false;
    if (!isCoord) {
      const bRes = await pool.query(`
        SELECT cob.id FROM club_office_bearers cob
        LEFT JOIN students s ON s.id = cob.student_id
        WHERE (cob.user_id = $1 OR s.user_id = $1) AND cob.club_id = $2
      `, [userId, clubId]);
      isBearer = bRes.rows.length > 0;
    }

    if (!isCoord && !isBearer) {
      return res.status(403).json({ error: 'Access restricted to club office bearers and faculty coordinator.' });
    }

    const eventsRes = await pool.query(`
      SELECT ce.*, c.name AS club_name, c.code AS club_code,
             u_sub.name AS submitted_by_name,
             u_app.name AS approved_by_name
      FROM club_events ce
      JOIN clubs c ON c.id = ce.club_id
      LEFT JOIN users u_sub ON u_sub.id = ce.submitted_by_user_id
      LEFT JOIN users u_app ON u_app.id = ce.approved_by
      WHERE ce.club_id = $1 AND ce.academic_year = $2
      ORDER BY ce.created_at DESC
    `, [clubId, academicYear]);

    res.json({ events: eventsRes.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching my club events:', err);
    res.status(500).json({ error: 'Failed to fetch club events' });
  }
});

// ─── PUT /api/clubs/:id/events/:eventId/resubmit (Edit and Resubmit Event) ─────
router.put('/:id/events/:eventId/resubmit', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const eventId = parseInt(req.params.eventId, 10);
    const userId = req.user.id;

    // Verify user is President or Vice President of this club
    const bearerRes = await pool.query(`
      SELECT cob.id FROM club_office_bearers cob
      LEFT JOIN students s ON s.id = cob.student_id
      WHERE (cob.user_id = $1 OR s.user_id = $1) AND cob.club_id = $2
    `, [userId, clubId]);

    if (bearerRes.rows.length === 0) {
      return res.status(403).json({ error: 'Only club office bearers can edit and resubmit events.' });
    }

    const evRes = await pool.query('SELECT * FROM club_events WHERE id = $1 AND club_id = $2', [eventId, clubId]);
    if (evRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const {
      title,
      event_type,
      start_date,
      end_date,
      time,
      venue,
      mode = 'Offline',
      description,
      expected_participants = 60,
      speaker_or_trainer
    } = req.body;

    // Validation
    if (!title || !title.trim()) return res.status(400).json({ error: 'Event Title is required.' });
    if (!event_type) return res.status(400).json({ error: 'Event Type is required.' });
    if (!start_date) return res.status(400).json({ error: 'Event Date is required.' });
    if (!time || !time.trim()) return res.status(400).json({ error: 'Event Time is required.' });
    if (!venue || !venue.trim()) return res.status(400).json({ error: 'Event Venue / Platform is required.' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'Event Description is required.' });

    const todayStr = new Date().toISOString().split('T')[0];
    if (start_date < todayStr) {
      return res.status(400).json({ error: 'Event date cannot be in the past.' });
    }

    const updateRes = await pool.query(`
      UPDATE club_events SET
        title = $1,
        event_type = $2,
        start_date = $3,
        end_date = $4,
        time = $5,
        venue = $6,
        mode = $7,
        description = $8,
        expected_participants = $9,
        speaker_or_trainer = $10,
        status = 'PENDING',
        rejection_remark = NULL,
        coordinator_remarks = NULL,
        submitted_by_user_id = $11,
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = $12 AND club_id = $13
      RETURNING *
    `, [
      title.trim(),
      event_type.trim(),
      start_date,
      end_date || null,
      time.trim(),
      venue.trim(),
      mode,
      description.trim(),
      parseInt(expected_participants, 10) || 60,
      speaker_or_trainer ? speaker_or_trainer.trim() : null,
      userId,
      eventId,
      clubId
    ]);

    res.json({
      message: 'Event updated and resubmitted for Coordinator approval.',
      event: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[Clubs] Error resubmitting event:', err);
    res.status(500).json({ error: 'Failed to resubmit event' });
  }
});

// ─── GET /api/clubs/:id/event-approvals (Pending events for Coordinator) ──────
router.get('/:id/event-approvals', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const isCoord = await isCoordinatorOfClub(req.user, clubId);
    if (!isCoord) {
      return res.status(403).json({ error: 'You are not authorized to view event approvals for this club.' });
    }

    const result = await pool.query(`
      SELECT ce.*, c.name AS club_name, c.code AS club_code,
             u.name AS submitted_by_name, u.email AS submitted_by_email,
             s.roll_no AS submitted_by_roll_no, s.enrollment_no AS submitted_by_prn,
             s.division AS submitted_by_division
      FROM club_events ce
      JOIN clubs c ON c.id = ce.club_id
      LEFT JOIN users u ON u.id = ce.submitted_by_user_id
      LEFT JOIN students s ON s.user_id = u.id
      WHERE ce.club_id = $1 AND (ce.status = 'PENDING' OR ce.status = 'Submitted')
      ORDER BY ce.submitted_at ASC, ce.id ASC
    `, [clubId]);

    res.json({ pendingEvents: result.rows });
  } catch (err) {
    console.error('[Clubs] Error fetching pending event approvals:', err);
    res.status(500).json({ error: 'Failed to fetch pending event approvals' });
  }
});

// ─── PATCH /api/clubs/:id/events/:eventId/approval (Approve / Reject Event) ───
router.patch('/:id/events/:eventId/approval', verifyToken, async (req, res) => {
  try {
    const clubId = parseInt(req.params.id, 10);
    const eventId = parseInt(req.params.eventId, 10);

    const isCoord = await isCoordinatorOfClub(req.user, clubId);
    if (!isCoord) {
      return res.status(403).json({ error: 'You are not authorized to approve or reject events for this club.' });
    }

    const rawAction = (req.body.action || req.body.decision || '').toUpperCase();
    const action = rawAction === 'APPROVED' ? 'APPROVE' : (rawAction === 'REJECTED' ? 'REJECT' : rawAction);
    const { remark } = req.body;
    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({ error: 'Action must be either APPROVE or REJECT.' });
    }

    if (action === 'REJECT' && (!remark || !remark.trim())) {
      return res.status(400).json({ error: 'A remark is required when rejecting an event.' });
    }

    const evRes = await pool.query('SELECT * FROM club_events WHERE id = $1 AND club_id = $2', [eventId, clubId]);
    if (evRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const cleanRemark = remark ? remark.trim() : null;

    const updateRes = await pool.query(`
      UPDATE club_events SET
        status = $1,
        coordinator_remarks = $2,
        rejection_remark = $3,
        approved_by = $4,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $5 AND club_id = $6
      RETURNING *
    `, [newStatus, cleanRemark, cleanRemark, req.user.id, eventId, clubId]);

    res.json({
      message: `Event has been ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully.`,
      event: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[Clubs] Error processing event approval:', err);
    res.status(500).json({ error: 'Failed to process event approval' });
  }
});

module.exports = router;
