/* api-client.js - Member 3
   Shared helpers for restful-api.dev. Load AFTER config.js.

   HOW TO USE (Member 4, read this):
     const apps = await apiGet('application');          // list: only our team's records
     const rec  = await apiPost('application', {...});  // create -> returns { id, name, data }
     await apiPut(rec.id, 'application', {...newData}); // update (send the full data object)
     await apiDelete(rec.id);                           // delete
   'type' is a short word such as 'saved' or 'application'.
   The team prefix is added for you (name becomes "KIS-application").
   Each record looks like: { id, name, data: {...your data...} }
   Every helper throws an Error with a readable message, so wrap calls in try/catch.

   INTERNSHIP FEED:
     const { jobs, notice } = await getInternshipFeed();                  // Cambodia (default)
     const { jobs, notice } = await getInternshipFeed({ source: 'remote' }); // Remotive, international
   Cambodia = data/internships.json (curated, each entry links to its original posting).
   Remotive is only requested when source is 'remote'. It caches the answer for 6 hours,
   because Remotive asks for at most 4 fetches a day and blocks more than 2 requests a minute.
   Remember to credit Remotive on the page. */

async function apiRequest(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let res;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw new Error(err.name === 'AbortError'
      ? 'The server took too long to respond. Please try again.'
      : 'Network error. Please check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}). Please try again.`);
  }
  const text = await res.text(); // some DELETE replies may be empty
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The server returned an invalid response. Please try again.');
  }
}

const API_JSON_HEADERS = { 'Content-Type': 'application/json' };
const apiName = (type) => `${CONFIG.TEAM_PREFIX}${type}`;

async function apiGet(type) {
  const all = await apiRequest(CONFIG.API_BASE);
  return all.filter((o) => typeof o.name === 'string' && o.name === apiName(type));
}

const apiPost = (type, data) =>
  apiRequest(CONFIG.API_BASE, {
    method: 'POST',
    headers: API_JSON_HEADERS,
    body: JSON.stringify({ name: apiName(type), data })
  });

const apiPut = (id, type, data) =>
  apiRequest(`${CONFIG.API_BASE}/${id}`, {
    method: 'PUT',
    headers: API_JSON_HEADERS,
    body: JSON.stringify({ name: apiName(type), data })
  });

const apiDelete = (id) =>
  apiRequest(`${CONFIG.API_BASE}/${id}`, { method: 'DELETE' });


/* ---------- Remotive (cached) ---------- */
async function fetchRemotiveJobs(params = {}) {
  const MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours
  const query = new URLSearchParams(params).toString();
  const key = `kis-remotive-${query}`;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(key)); } catch { /* no cache yet */ }
  if (cached && Date.now() - cached.time < MAX_AGE) return cached.jobs;

  try {
    const res = await fetch(`${CONFIG.REMOTIVE_URL}${query ? '?' + query : ''}`);
    if (!res.ok) throw new Error(`Remotive request failed (${res.status}).`);
    const payload = await res.json();
    const jobs = payload?.jobs;
    const list = Array.isArray(jobs) ? jobs : [];
    if (list.length) { // never cache an empty answer, or a bad response would stick for 6 hours
      try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), jobs: list })); }
      catch { /* storage full: just skip caching */ }
    }
    return list;
  } catch (err) {
    if (cached) return cached.jobs; // blocked or offline: show the older copy instead of an error
    throw err;
  }
}

function normalizeInternship(job) {
  return {
    id: String(job.id),
    title: job.title || 'Untitled internship',
    company: job.company_name || 'Company not listed',
    location: job.candidate_required_location || 'Remote',
    category: job.category || 'Other',
    jobType: job.job_type || 'Not specified',
    logo: job.company_logo_url || job.company_logo || '',
    url: job.url || '',
    description: job.description || '',
    date: job.publication_date || '',
    source: 'Remotive',
    origin: 'remote',
    applyLabel: 'Apply on Remotive'
  };
}

function isInternshipListing(job) {
  const searchableFields = [job.title, ...(Array.isArray(job.tags) ? job.tags : [])].join(' ');
  return /\bintern(ship)?\b|\btrainee\b|\bplacement\b/i.test(searchableFields)
    || String(job.job_type || '').toLowerCase() === 'internship';
}


/* ---------- Cambodia internships (primary source) ----------
   None of BongThom, JobNet, CamHR or Pelprek publishes a public API we are allowed to use,
   so data/internships.json is a hand-checked list. Rules for every entry:
   - url = the original posting/apply page (https only)
   - deadline = last day to apply (YYYY-MM-DD); entries past their deadline are hidden automatically
   - only facts printed on the original posting go in the entry */
const isHttpUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

function isStillOpen(item, now = new Date()) {
  if (!item.deadline) return true;
  const lastMoment = new Date(`${item.deadline}T23:59:59`);
  return !Number.isNaN(lastMoment.getTime()) && lastMoment >= now;
}

async function loadLocalInternships() {
  let list;
  try {
    const res = await fetch(CONFIG.LOCAL_INTERNSHIPS_URL);
    if (!res.ok) throw new Error(`status ${res.status}`);
    list = await res.json();
  } catch {
    throw new Error('Could not load the Cambodian internship list. Please try again.');
  }
  if (!Array.isArray(list)) throw new Error('The Cambodian internship list is not in the expected format.');
  const now = new Date();
  return list
    .filter((item) => item && item.title && item.company && isHttpUrl(item.url)
      && !/^\s*\[sample\]/i.test(item.title) && isStillOpen(item, now))
    .map((item) => ({
      id: `local-${item.id}`,
      title: item.title,
      company: item.company,
      location: item.location || 'Cambodia',
      category: item.category || 'Other',
      jobType: item.jobType || 'Internship',
      logo: item.logo || '',
      url: item.url,
      description: item.description || '',
      date: item.date || '',
      deadline: item.deadline || '',
      salary: item.salary || '',
      verifiedOn: item.verifiedOn || '',
      source: item.source || 'Original posting',
      origin: 'cambodia',
      applyLabel: `Apply on ${item.source || 'original posting'}`
    }));
}

async function loadRemoteInternships() {
  const raw = await fetchRemotiveJobs({ search: 'internship', limit: 100 });
  const jobs = raw.filter(isInternshipListing).map(normalizeInternship);
  if (jobs.length) {
    return { jobs, notice: 'International remote internships via Remotive. These are not based in Cambodia.' };
  }
  if (raw.length) { // Remotive answered but has no internships: show its newest listings, clearly labelled
    return {
      jobs: raw.slice(0, 12).map(normalizeInternship),
      notice: 'No remote internships were found right now, so these are the latest remote jobs from Remotive. They are not based in Cambodia.'
    };
  }
  return { jobs: [], notice: '' };
}

/* options.source: 'cambodia' (default, from CONFIG.DEFAULT_SOURCE) or 'remote'.
   The two sources are never mixed. */
async function getInternshipFeed(options = {}) {
  const source = options.source || CONFIG.DEFAULT_SOURCE;
  if (source === 'remote') return loadRemoteInternships();
  const jobs = await loadLocalInternships();
  return {
    jobs,
    notice: jobs.length ? '' : 'No open Cambodian internships are listed right now. Please check back soon, or switch Source to International Remote.'
  };
}
