# Khmer InternSphere

A web application that helps Cambodian students find, save and apply for internships in one place, instead of relying on social media, personal connections or university bulletin boards.

**Course:** INFO 251 001 - Web Development II
**University:** American University of Phnom Penh (AUPP)
**Instructor:** Ms. Monyrath Buntoun
**Repository:** https://github.com/Mengchou-hello/KhmerInternsphere_WebII_Final_Project

Khmer InternSphere started as a static site in INFO 250 (Web Development I). In this course we rebuilt it as a dynamic, JavaScript-driven web app that uses vanilla JavaScript (ES6), a hand-checked Cambodian internship list and three public services.

## Team (Group 7)

| Name |
|---|
| CHAMROUEN Sovanmealy |
| LY Mengchou |
| SOMANG Sochannimol |
| TAN Chanleaksmy |

### Responsibilities

| Member | Role | Main files |
|---|---|---|
| 1 | Listings, Companies, About | `internships.html`, `companies.html`, `about.html`, `js/internships.js`, `js/companies.js`, `css/internship.css`, `css/company.css`, `css/about.css` |
| 2 | Detail view, map, contact form | `js/detail-map.js`, `js/contact.js`, `css/modal_new.css`, `css/contact.css` |
| 3 | API client, bookmarks, home page, site consistency | `js/config.js`, `js/api-client.js`, `js/card.js`, `js/main.js`, `js/saved.js`, `js/latest.js`, `data/internships.json`, `css/style.css`, `css/nav.css`, `css/home.css`, `css/latest.css`, `css/saved.css`, `css/features.css`, `css/listing-fix.css`, `css/ui-fixes.css` |
| 4 | Applications, tracker, final report | `js/applications.js`, `js/tracker.js`, `css/tracker.css`, `README.md` |

## Features

### Pages

Home, Internships, Companies, About and Contact. All pages share the same header, navigation, active-link state and footer.

### Dynamic internship listings

- The default list is **Cambodia Internships**, loaded with `fetch()` and `async/await` from `data/internships.json`. Every entry links to its original posting, and entries past their deadline are hidden automatically.
- A **Source** dropdown switches to **International Remote**, which uses the Remotive API. The two sources are never mixed.
- Cards show the company logo, title, company, location and category, and are rendered with template literals (`js/card.js`).
- Keyword search (with a 300 ms debounce), location filter and category filter combine without reloading the page.
- Loading spinner, friendly error message with a Retry button, and an empty-state message.
- Cards can be opened through a deep link.

### Internship detail view with map

- Clicking a card opens a modal with the full description, company, location, category, date and an Apply link.
- A Leaflet map with an OpenStreetMap marker shows where the internship is based.
- Locations are converted to coordinates with Nominatim, cached by address and limited to 1 request per second. A failed lookup is retried the next time the modal opens.
- Locations that cannot be mapped (for example "Worldwide") show a fallback message instead of a map.

### Save / bookmark internships

- Save and unsave from the cards and from the detail modal (POST and DELETE).
- Saved items persist across page reloads (GET on page load).
- The button is disabled while a request is running, so fast double-clicks do not create duplicates.
- A "Saved Internships" section lists saved items with a Remove button (with a confirm dialog) and an empty state.

### Application system and tracker (Member 4, to add)

- Validated application form: name, email, resume link (valid URL) and a message of at least 20 characters, with inline errors.
- Applications are submitted with POST, and a second application to the same job is blocked.
- The tracker lists all applications with colored status badges: Submitted, Under Review, Accepted and Rejected.
- Update the status, message or resume link (PUT) and withdraw an application with a confirm step (DELETE).
- The page updates without a reload, and data persists after a refresh.
- `internships.html` already has an empty `#tracker-section` for this feature.

### Companies

Companies are built from the live listing data instead of static content. Each company card shows its logo, name and number of open roles, and opens a modal listing its open internships.

### Contact form validation

Required fields, email format and Cambodian phone format (`+855...` or `0xx...`), with real-time inline error messages, a success message and a form reset.

### Home page

Hero section, statistics, a scrolling logo slider, a "Latest Internships" section with live listings and a "View all" link, and a responsive burger menu on mobile.

### Code quality

ES6 throughout (`const`/`let`, arrow functions, template literals, `.map()`, `.filter()`, `.reduce()`), `try/catch` on every request, loading indicators and friendly error messages, and no API URLs outside `config.js`.

## Data sources and APIs

The Internships, Companies and Home pages read through one function, `getInternshipFeed()` in `js/api-client.js`. It has two sources, and they are never mixed:

| Source | Used when | Where the data comes from |
|---|---|---|
| **Cambodia** (default) | `CONFIG.DEFAULT_SOURCE = 'cambodia'` | `data/internships.json`, a hand-checked list. Every entry links to its original posting, and entries past their deadline are hidden automatically. |
| **International Remote** | "Source" dropdown on `internships.html` | The Remotive API. The answer is cached in `localStorage` for 6 hours, because Remotive allows only a few requests per day. |

### Services used

| Service | Method | Endpoint | Used for |
|---|---|---|---|
| Remotive | GET | `https://remotive.com/api/remote-jobs` | Optional International Remote feed |
| Nominatim (OpenStreetMap) | GET | `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1` | Convert a job location into map coordinates |
| restful-api.dev | GET, POST, PUT, DELETE | `https://api.restful-api.dev/objects` and `/objects/{id}` | Saved internships and applications |

Leaflet 1.9.4 with OpenStreetMap tiles (loaded from unpkg) draws the map. It is a library, not one of the three APIs.

### Shared data shape

Both sources are normalized to the same shape, so every feature works with either one:

```js
{ id, title, company, location, category, jobType, logo, url, description, date,
  // Cambodia list only:
  deadline, salary, verifiedOn, source, origin, applyLabel }
```

### How the data flows

1. **Page load:** `getInternshipFeed()` loads the selected source, then cards are rendered.
2. **Save click:** POST to restful-api.dev, then update the button and the Saved list.
3. **Apply form:** validate, POST, then the tracker updates.
4. **Status change or withdraw:** PUT or DELETE, then the tracker updates.

### Using restful-api.dev

restful-api.dev is a shared public service, so every record is tagged with the team prefix `KIS-` and is filtered by that prefix when listing. All calls go through `js/api-client.js`:

```js
const saved = await apiGet('saved');                  // list our records
const rec   = await apiPost('saved', { jobId, title });  // create
await apiPut(rec.id, 'application', { status: 'Under Review' }); // update
await apiDelete(rec.id);                              // delete
```

`type` is a short word such as `saved` or `application`, and the prefix is added automatically. Records look like `{ id, name, data }`.

## Project structure

```
KhmerInternsphere_WebII_Final_Project/
├── index.html           Same content as home.html
├── home.html            Home: hero, stats, logo slider, Latest Internships
├── internships.html     Listings: search, filters, Source switch, #saved-section, #tracker-section
├── companies.html       Company cards built from the feed, company modal
├── about.html           Team and project info
├── contact.html         Contact form (validated by contact.js)
├── README.md
├── .gitignore
├── assets/
│   ├── favicon.ico      Browser tab icon
│   ├── homepage.jpg     Home page image
│   └── fonts/           Campton (.otf) and Kantumruy Pro (.ttf) font files
├── img/
│   └── logo.png         Site logo and fallback company logo
├── data/
│   └── internships.json Curated Cambodian internships (primary feed)
├── css/
│   ├── style.css        Global tokens, base, hero, stats, buttons, footer
│   ├── nav.css          Header, navigation, burger menu, plus the shared
│   │                    override layers (features, theme, listing-fix,
│   │                    ui-fixes). Always loads last.
│   ├── home.css         Home page only
│   ├── latest.css       "Latest Internships" section
│   ├── saved.css        Save buttons and Saved Internships list
│   ├── internship.css   Internships page layout
│   ├── company.css      Companies page
│   ├── about.css        About page
│   ├── contact.css      Contact page layout
│   ├── modal_new.css    Internship modal styles
│   ├── features.css     Standalone copy of the features layer
│   │                    (listing states, modals, form errors)
│   ├── listing-fix.css  Standalone copy of the listing filter layout fix
│   ├── ui-fixes.css     Standalone copy of card bullets, icon buttons and
│   │                    the remove-confirmation dialog styles
│   └── tracker.css      (to add) application form and tracker
└── js/
    ├── config.js        All API URLs, team prefix `KIS-`, fallback logo (loads first)
    ├── api-client.js    apiGet / apiPost / apiPut / apiDelete + getInternshipFeed()
    ├── card.js          Shared card markup and SVG icons (window.KISCard)
    ├── main.js          Logo slider, scroll reveal, burger nav, active link
    ├── internships.js   Listings, search (300 ms debounce), filters, Retry, deep links
    ├── companies.js     Groups jobs by company, company modal
    ├── detail-map.js    Detail modal, Nominatim geocoding queue, Leaflet map
    ├── contact.js       Contact form validation
    ├── saved.js         Bookmarks: save, unsave, Saved list
    ├── latest.js        Latest Internships on the home page
    ├── applications.js  (to add) application form
    └── tracker.js       (to add) application tracker
```

Items marked **(to add)** belong to Member 4 and are not in the project folder yet.

**Note on the standalone CSS files:** `features.css`, `listing-fix.css` and `ui-fixes.css` are not linked by any page. The pages only load the stylesheets listed in the table below, and the shared layers are delivered through `nav.css`. Keep the standalone files in sync with `nav.css` if you edit them, or delete them once they are no longer needed.

### Script and style order

Scripts go at the end of `<body>`. `config.js` always loads first, and `card.js` loads before anything that renders cards.

| Page | Scripts, in order |
|---|---|
| `internships.html` | `config.js`, `api-client.js`, `card.js`, Leaflet, `internships.js`, `detail-map.js`, `saved.js`, `main.js` |
| `home.html` | `config.js`, `api-client.js`, `card.js`, Leaflet, `detail-map.js`, `saved.js`, `main.js`, `latest.js` |
| `companies.html` | `config.js`, `api-client.js`, `companies.js`, `main.js` |
| `contact.html` | `config.js`, `api-client.js`, `contact.js`, `main.js` |
| `about.html` | `config.js`, `api-client.js`, `main.js` |

| Page | Styles, in order |
|---|---|
| `home.html` | `style.css`, `home.css`, `latest.css`, `saved.css`, Leaflet, `nav.css` |
| `internships.html` | `style.css`, `internship.css`, `modal_new.css`, Leaflet, `saved.css`, `nav.css` |
| `companies.html` | `style.css`, `company.css`, `nav.css` |
| `contact.html` | `style.css`, `contact.css`, `nav.css` |
| `about.html` | `style.css`, `about.css`, `nav.css` |

`nav.css` must always be the last stylesheet. It holds the theme and fix layers that override earlier rules.

### Detail modal hooks (for Members 3 and 4)

`js/detail-map.js` builds the modal and exposes:

- `openDetailModal(job)` and `closeDetailModal()`
- a `modal:open` event on `document`, with `detail: { job }`
- `#modal-save-slot`: Member 3 mounts the Save button here
- `#modal-apply-slot`: holds the Apply link; the in-app application button can replace it

## How to run

No build step or API key is needed. The project is plain HTML, CSS and JavaScript.

1. Clone the repository:

   ```bash
   git clone https://github.com/Mengchou-hello/KhmerInternsphere_WebII_Final_Project.git
   cd KhmerInternsphere_WebII_Final_Project
   ```

2. Serve the folder with a local web server. Do **not** open the HTML files directly with `file://`, because `data/internships.json` and the Nominatim map requests need a normal web page origin.
   - **VS Code:** install the Live Server extension, then right-click `home.html` and choose "Open with Live Server" (usually http://127.0.0.1:5500).
   - **Python:**

     ```bash
     python3 -m http.server 5500
     ```

     then open http://localhost:5500/home.html.

3. An internet connection is required for maps, bookmarks and the International Remote source.

## Updating the Cambodian list

Add or edit entries in `data/internships.json` by hand. Each entry should link to its original posting. Entries past their deadline disappear automatically.

## Team workflow

- Each member edits only their own files, and asks the owner for changes elsewhere.
- Every pull request is reviewed by a teammate: members 1 and 2 review each other, and members 3 and 4 review each other.
- Each member presents their own feature.

## Known limitations

- The default list is a hand-checked file, not a live API, so it must be updated by hand.
- Remotive lists remote jobs worldwide, so those internships are not in Cambodia. Remotive also limits how often it can be called, so answers are cached for 6 hours.
- restful-api.dev is a free shared service (about 50 requests a day), so bookmarks can fail with a "request limit" message. Records are tagged with `KIS-` to keep them separate from other students' data.
- Nominatim allows 1 request per second, so maps for new locations can take a moment to load. Repeated locations are served from the cache.
- Bookmarks and applications are stored for the whole team's `KIS-` prefix, not for individual user accounts, because the app has no login.
- The contact form is validated in the browser only. No email is sent.
- The application form and tracker (`applications.js`, `tracker.js`, `tracker.css`) are not implemented yet.

## References

Leaflet. (n.d.). *Leaflet: An open-source JavaScript library for interactive maps.* https://leafletjs.com/

MDN Web Docs. (2025, August 20). *Using the Fetch API.* Mozilla. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

OpenStreetMap Foundation. (n.d.). *Nominatim usage policy (aka geocoding policy).* https://operations.osmfoundation.org/policies/nominatim/

osm-search. (n.d.). *Nominatim: Open source search based on OpenStreetMap data.* GitHub. https://github.com/osm-search/Nominatim

Remotive. (n.d.). *Remote Jobs Public API.* GitHub. https://github.com/remotive-io/remote-jobs-api

RESTful API. (n.d.). *Free REST API - Full CRUD support (GET, POST, PUT, PATCH, DELETE) for testing & learning.* https://restful-api.dev/

---

© 2026 Khmer InternSphere, Group 7, INFO 251 Web Development II, AUPP.