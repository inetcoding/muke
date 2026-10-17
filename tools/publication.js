// Source-evidenced publication for the server migration. No business writes.
const STATES = new Set(['未开始', '进行中', '已停止', '已完成']);
const text = v => { const a = v?.value ?? v; return (Array.isArray(a) ? a : [a]).map(x => typeof x === 'string' || typeof x === 'number' ? String(x) : x?.name || x?.text || x?.link || '').filter(Boolean).join(','); };

async function collectPages(fetchPage, {limit = 30, key = 'record_id'} = {}) {
  const items = [], ids = new Set(), cursors = new Set(); let cursor = '';
  for (let page = 0; page < limit; page++) {
    const response = await fetchPage(cursor), data = response?.data;
    if ((response.code !== undefined && response.code !== 0) || !data || !Array.isArray(data.items) || typeof data.has_more !== 'boolean') throw Error('Incomplete source response');
    for (const item of data.items) {
      if (!item || typeof item[key] !== 'string' || !item[key] || ids.has(item[key])) throw Error('Missing or duplicate source identity');
      ids.add(item[key]); items.push(item);
    }
    if (!data.has_more) return items;
    if (!data.items.length || typeof data.page_token !== 'string' || !data.page_token || cursors.has(data.page_token)) throw Error('Incomplete source pagination');
    cursors.add(data.page_token); cursor = data.page_token;
  }
  throw Error('Source page limit reached');
}

function sourceSnapshot(rows, fields, titles) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(fields) || !Array.isArray(titles) || !titles.length) throw Error('Missing recruitment source');
  const status = fields.find(f => f.field_name === 'Status' && f.type === 3);
  const jobField = fields.find(f => f.field_name === 'Job-CN' && f.type === 3);
  if (!status?.field_id || !jobField?.field_id || ![...STATES].every(s => status.property?.options?.some(o => o.name === s))) throw Error('Recruitment status schema changed');
  const names = new Map();
  for (const row of titles) { const name = text(row.fields?.['Job-CN']); if (!name) continue; if (names.has(name)) throw Error('Duplicate position mapping'); names.set(name, row); }
  const records = rows.map(r => {
    if (!r?.record_id || !r.fields) throw Error('Invalid recruitment row');
    const state = text(r.fields.Status), job = text(r.fields['Job-CN']), goal = Number(text(r.fields.Goal));
    if (state && !STATES.has(state)) throw Error('Unknown recruitment status');
    if (state === '进行中' && (!names.has(job) || !Number.isInteger(goal) || goal < 1 || !text(names.get(job).fields.JID))) throw Error('Incomplete active requirement');
    return {id:r.record_id, job, state, goal:Number.isFinite(goal) ? goal : 0};
  }).sort((a,b) => a.id.localeCompare(b.id));
  if (new Set(records.map(r => r.id)).size !== records.length) throw Error('Duplicate requirement');
  return {version:1, statusField:status.field_id, jobField:jobField.field_id, records};
}

function validatePublication(previous, next, source, oldSource) {
  if (!source || source.version !== 1 || !Array.isArray(source.records) || !source.records.length || !next || !Array.isArray(next.jobs)) throw Error('Missing publication evidence');
  const active = new Map(), current = new Map(source.records.map(r => [r.id,r]));
  for (const r of source.records) if (r.state === '进行中') active.set(r.job, (active.get(r.job) || 0) + r.goal);
  if (next.jobs.length !== active.size || new Set(next.jobs.map(j => j.cn)).size !== next.jobs.length) throw Error('Published job count differs from source');
  for (const j of next.jobs) if (!active.has(j.cn) || j.open !== true || j.goal !== active.get(j.cn) || !j.jid || (!j.jd && !j.jdId)) throw Error('Published job differs from source');
  if (oldSource) {
    if (oldSource.version !== 1 || !Array.isArray(oldSource.records) || oldSource.statusField !== source.statusField || oldSource.jobField !== source.jobField) throw Error('Source identity changed');
    // Stopping records is supported. Deleting/reassigning previously open records needs review.
    for (const old of oldSource.records) {
      const now = current.get(old.id); if (!now) throw Error('Requirement disappeared; review source');
      if (old.state === '进行中' && (now.job !== old.job || !STATES.has(now.state))) throw Error('Previously active requirement lost its explicit status');
    }
  }
  const before = previous?.jobs || [];
  const removed = before.filter(j => !active.has(j.cn));
  // Establish the first baseline only while every previously published job remains accounted for.
  if (removed.length && !oldSource) throw Error('Retirement requires a prior verified source baseline');
  for (const j of removed) {
    const prior = oldSource.records.filter(r => r.job === j.cn && r.state === '进行中');
    if (!prior.length || !prior.every(r => ['未开始','已停止','已完成'].includes(current.get(r.id)?.state))) throw Error('Retirement has no explicit source evidence');
  }
  // JD erasure is not a stop instruction. Keep content-loss protection independently of job count.
  for (const j of next.jobs) { const old = before.find(p => p.cn === j.cn); if (old && ((old.jd && !j.jd) || (old.jdId && !j.jdId))) throw Error('Position description disappeared'); }
  return {openJobs:next.jobs.length, retiredJobs:removed.length, sourceRows:source.records.length};
}

module.exports = {collectPages, sourceSnapshot, validatePublication};
