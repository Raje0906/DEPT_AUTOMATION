const pool = require('./pool');
const path = require('path');
const { pathToFileURL } = require('url');

async function seedMagazines() {
  const client = await pool.connect();
  try {
    console.log('[Seed Magazines] Starting database update for magazine section only...');

    // 1. Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS magazines (
        id            VARCHAR(100) PRIMARY KEY,
        title         VARCHAR(255) NOT NULL,
        issue_number  INTEGER NOT NULL,
        academic_year VARCHAR(50) NOT NULL,
        semester      VARCHAR(50) DEFAULT 'Annual',
        department    VARCHAR(200) DEFAULT 'Department of Computer Engineering',
        period        VARCHAR(150),
        description   TEXT,
        status        VARCHAR(50) NOT NULL DEFAULT 'Draft',
        template      VARCHAR(100) DEFAULT 'modern-academic',
        published_date DATE,
        cover_color   VARCHAR(50) DEFAULT '#1E2D5A',
        cover_image   TEXT,
        total_pages   INTEGER DEFAULT 0,
        tagline       TEXT,
        sections      JSONB DEFAULT '{}'::jsonb,
        section_data  JSONB DEFAULT '{}'::jsonb,
        review_comment TEXT,
        created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_magazines_status ON magazines(status);
      CREATE INDEX IF NOT EXISTS idx_magazines_academic_year ON magazines(academic_year);
    `);

    // 2. Load demo data dynamically
    const demoModulePath = path.resolve(__dirname, '../client/src/utils/demoMagazineData.js');
    const demoDataMod = await import(pathToFileURL(demoModulePath).href);
    const { DEMO_MAGAZINE_METADATA, DEMO_MAGAZINE_SECTION_DATA } = demoDataMod;

    const magazinesToSeed = [
      {
        ...DEMO_MAGAZINE_METADATA,
        section_data: DEMO_MAGAZINE_SECTION_DATA,
      },
      {
        id: 'MAG-2025-32',
        title: 'Reflection',
        issueNumber: 32,
        academicYear: '2025–26',
        semester: 'Annual',
        department: 'Computer Engineering',
        period: 'June – December 2025',
        description: 'The annual departmental magazine capturing student achievements, academic milestones, and departmental events of the first half of academic year 2025–26.',
        status: 'Published',
        template: 'modern-academic',
        publishedDate: '2026-01-15',
        coverColor: '#1E2D5A',
        totalPages: 20,
        tagline: 'Knowledge grows when it is shared with others',
        sections: {
          cover: { completed: true },
          message: { completed: true },
          toppers: { completed: true },
          events: { completed: true },
          workshops: { completed: true },
          lectures: { completed: true },
          achievements: { completed: true },
          coe: { completed: true },
          staffAchievements: { completed: true },
          fdpSttp: { completed: true },
          publications: { completed: true },
        },
        section_data: {},
      },
      {
        id: 'MAG-2024-31',
        title: 'Reflection',
        issueNumber: 31,
        academicYear: '2024–25',
        semester: 'Annual',
        department: 'Computer Engineering',
        period: 'January – May 2025',
        description: 'Departmental magazine for the second semester of academic year 2024–25.',
        status: 'Published',
        template: 'editorial',
        publishedDate: '2025-06-10',
        coverColor: '#6B2737',
        totalPages: 18,
        tagline: 'Excellence in Engineering, Innovation in Thought',
        sections: {
          cover: { completed: true },
          message: { completed: true },
          toppers: { completed: true },
          events: { completed: true },
          workshops: { completed: true },
          lectures: { completed: true },
          achievements: { completed: true },
          coe: { completed: true },
          staffAchievements: { completed: true },
          fdpSttp: { completed: true },
          publications: { completed: true },
        },
        section_data: {},
      },
      {
        id: 'MAG-2024-30',
        title: 'Reflection',
        issueNumber: 30,
        academicYear: '2024–25',
        semester: 'Semester I',
        department: 'Computer Engineering',
        period: 'June – December 2024',
        description: 'First-semester edition covering departmental achievements and academic highlights.',
        status: 'Archived',
        template: 'institutional-premium',
        publishedDate: '2025-01-20',
        coverColor: '#3B6B47',
        totalPages: 16,
        tagline: '',
        sections: {
          cover: { completed: true },
          message: { completed: true },
          toppers: { completed: true },
          events: { completed: true },
          workshops: { completed: true },
          lectures: { completed: true },
          achievements: { completed: true },
          coe: { completed: true },
          staffAchievements: { completed: true },
          fdpSttp: { completed: true },
          publications: { completed: true },
        },
        section_data: {},
      },
    ];

    for (const mag of magazinesToSeed) {
      const query = `
        INSERT INTO magazines (
          id, title, issue_number, academic_year, semester, department, period,
          description, status, template, published_date, cover_color, cover_image,
          total_pages, tagline, sections, section_data, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          issue_number = EXCLUDED.issue_number,
          academic_year = EXCLUDED.academic_year,
          semester = EXCLUDED.semester,
          department = EXCLUDED.department,
          period = EXCLUDED.period,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          template = EXCLUDED.template,
          published_date = EXCLUDED.published_date,
          cover_color = EXCLUDED.cover_color,
          cover_image = EXCLUDED.cover_image,
          total_pages = EXCLUDED.total_pages,
          tagline = EXCLUDED.tagline,
          sections = EXCLUDED.sections,
          section_data = CASE 
            WHEN jsonb_typeof(EXCLUDED.section_data) = 'object' AND EXCLUDED.section_data != '{}'::jsonb 
            THEN EXCLUDED.section_data 
            ELSE magazines.section_data 
          END,
          updated_at = NOW();
      `;

      await client.query(query, [
        mag.id,
        mag.title,
        mag.issueNumber,
        mag.academicYear,
        mag.semester || 'Annual',
        mag.department || 'Department of Computer Engineering',
        mag.period || '',
        mag.description || '',
        mag.status || 'Draft',
        mag.template || 'modern-academic',
        mag.publishedDate || null,
        mag.coverColor || '#1E2D5A',
        mag.coverImage || null,
        mag.totalPages || 0,
        mag.tagline || '',
        JSON.stringify(mag.sections || {}),
        JSON.stringify(mag.section_data || {}),
      ]);
      console.log(`[Seed Magazines] Synced magazine: ${mag.id} (${mag.title} Issue ${mag.issueNumber})`);
    }

    const countRes = await client.query('SELECT COUNT(*) FROM magazines');
    console.log(`[Seed Magazines] Completed! Total magazines in database: ${countRes.rows[0].count}`);
  } catch (err) {
    console.error('[Seed Magazines] Error:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedMagazines()
    .then(() => {
      console.log('[Seed Magazines] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Magazines] Failed:', err);
      process.exit(1);
    });
}

module.exports = { seedMagazines };
