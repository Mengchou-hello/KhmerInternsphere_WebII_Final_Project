/* api-client.js - Member 3
   Shared helpers for restful-api.dev. Load AFTER config.js.

   HOW TO USE (Member 4, read this):
     const apps = await apiGet('application');             // list: only our team's records
     const rec  = await apiPost('application', {...});     // create -> returns { id, name, data }
     await apiPut(rec.id, 'application', {...newData});    // update (send the full data object)
     await apiDelete(rec.id);                              // delete
   'type' is a short word such as 'saved' or 'application'.
   The team prefix is added for you (name becomes "KIS-application").
   Each record looks like: { id, name, data: {...your data...} }
   Every helper throws an Error with a readable message, so wrap calls in try/catch. */

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
  return res.json();
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
