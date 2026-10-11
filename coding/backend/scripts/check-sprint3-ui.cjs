const { chromium } = require(process.env.RUNAI_PLAYWRIGHT_PATH || 'playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../frontend');
const output = path.resolve(__dirname, '../../../outputs/sprint3');
const today = new Date().toISOString().slice(0, 10);
const goal = { goal_id: 1, status: 'active', achieved_at: new Date().toISOString(), target_distance: 10, target_duration_minutes: 50, target_date: today };
const session = { training_session_id: 1, session_date: today, training_type: 'Easy Run', target_distance: 5, target_duration_minutes: 30, status: 'completed' };
const plan = { training_plan_id: 1, goal_id: 1, version: 1, status: 'active', source: 'gemini', start_date: today, end_date: today, sessions: [session], calendar: [{ date: today, session }], pending_adjustment: null };
const analysis = { created_at: new Date().toISOString(), result_json: { source: 'gemini', summary: 'ผลวิเคราะห์สำหรับทดสอบหน้าจอ', recommendation: 'ฝึกตามแผนเดิมและพักตามตาราง' } };
const metrics = { recent: { count: 1, distance_km: 10, duration_minutes: 50, pace_minutes_per_km: 5 }, previous: { count: 0 } };
let completed = false;
const server = http.createServer((req, res) => {
  const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.RUNAI_BROWSER_CHANNEL || 'msedge' });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      completed = false; goal.status = 'active'; goal.achievement_choice = null;
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('runai_token', 'ui-fixture-token'));
      await page.route('http://localhost:4000/api/**', async (route) => {
        const url = new URL(route.request().url()).pathname;
        let body = {};
        if (url === '/api/dashboard') body = { user: { user_id: 'fixture', name: 'Runner', age: 25, weight: 65, height: 170, experience_level: 'beginner' }, goals: [goal], runs: [{ run_id: 1, run_date: today, distance: 10, duration_minutes: 50, run_type: 'Easy Run' }], active_plan: completed ? null : plan };
        if (url === '/api/insights') body = { analysis, metrics };
        if (url.endsWith('/continue')) goal.achievement_choice = 'continue';
        if (url.endsWith('/complete')) { completed = true; goal.status = 'completed'; }
        if (url === '/api/plan-history') body = { adjustments: [{ training_plan_id: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'accepted', reason: 'ทดสอบประวัติแผน', analysis: { source: 'gemini', previous_sessions: [session] }, proposed_sessions: [{ ...session, target_distance: 4 }] }] };
        await route.fulfill({ json: body });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/dashboard.html`);
      await page.locator('#insightsSummary').filter({ hasText: 'ผลวิเคราะห์' }).waitFor();
      await page.locator('#continueGoalButton').click();
      await page.waitForFunction(() => document.getElementById('continueGoalButton').hidden);
      await page.locator('#analyzeProgressButton').click();
      await page.locator('#insightsMessage').filter({ hasText: 'วิเคราะห์เรียบร้อยแล้ว' }).waitFor();
      await page.locator('#planHistoryDetails > summary').click();
      await page.locator('#planHistoryList details > summary').click();
      await page.locator('.running-insights').screenshot({ path: path.join(output, `insights-${viewport.width}.png`) });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page overflows viewport');
      assert.deepEqual(errors, []);
      await page.locator('#completeGoalButton').click();
      await page.waitForFunction(() => document.getElementById('goalAchievement').classList.contains('hidden'));
      console.log(`PASS ${viewport.width}px: achievement choices, analysis, history, no JS errors or page overflow`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
