# Khmer InternSphere

A web application that helps Cambodian students find, save and apply for internships in one place, instead of relying on social media, personal connections or university bulletin boards.

**Course:** INFO 251 001 - Web Development II
**University:** American University of Phnom Penh (AUPP)
**Instructor:** Ms. Monyrath Buntoun
**Repository:** https://github.com/Mengchou-hello/KhmerInternsphere_WebII_Final_Project

Khmer InternSphere started as a static site in INFO 250 (Web Development I). In this course we rebuilt it as a dynamic, JavaScript-driven web app that uses vanilla JavaScript (ES6) and three public APIs.

---

## Team (Group 7)

| Name |
|------|
| CHAMROUEN Sovanmealy |
| LY Mengchou |
| SOMANG Sochannimol |
| TAN Chanleaksmy |

### Responsibilities

| Member | Role | Main files |
|--------|------|------------|
| 1 | Listings, Companies, About | `internships.html`, `companies.html`, `about.html`, `js/internships.js`, `js/companies.js` |
| 2 | Detail view, map, contact form | `js/detail-map.js`, `js/contact.js`, `css/modal_new.css`, `css/contact.css` |
| 3 | API client, bookmarks, home page, site consistency | `js/config.js`, `js/api-client.js`, `js/main.js`, `js/saved.js`, `js/latest.js`, `css/style.css`, `css/nav.css`, `css/home.css` |
| 4 | Applications, tracker, final report | `js/applications.js`, `js/tracker.js`, `css/tracker.css`, `README.md` |

---

## Features

### Pages
Home, Internships, Companies, About and Contact. All pages share the same header, navigation, active-link state and footer.

### Dynamic internship listings
- Real internship listings are fetched from the Remotive API with `fetch()` and `async/await`.
- Cards show the company logo, title, company, location and category, and are rendered with template literals.
- Keyword search (with a 300 ms debounce), location filter and category filter combine without reloading the page.
- Loading spinner, friendly error message with a Retry button, and an empty-state message.

### Internship detail view with map
- Clicking a card opens a modal with the full description, company, location, category, date and an Apply link.
- A Leaflet map with an OpenStreetMap marker shows where the internship is based.
- Locations are converted to coordinates with Nominatim, cached by address and limited to 1 request per second.
- Locations that cannot be mapped (for example "Worldwide") show a fallback message instead of a map.

### Save / bookmark internships
- Save and unsave from the cards and from the detail modal (POST and DELETE).
- Saved items persist across page reloads (GET on page load).
- The button is disabled while a request is running, so fast double-clicks do not create duplicates.
- A "Saved Internships" section lists saved items with a Remove button and an empty state.

### Application system and tracker
- Validated application form: name, email, resume link (valid URL) and a message of at least 20 characters, with inline errors.
- Applications are submitted with POST, and a second application to the same job is blocked.
- The tracker lists all applications with colored status badges: Submitted, Under Review, Accepted and Rejected.
- Update the status, message or resume link (PUT) and withdraw an application with a confirm step (DELETE).
- The page updates without a reload, and data persists after a refresh.

### Companies
Companies are built from the live listing data instead of static content. Each company card shows its logo, name and number of open roles, and expands to list its open internships.

### Contact form validation
Required fields, email format and Cambodian phone format (`+855...` or `0xx...`), with real-time inline error messages, a success message and a form reset.

### Home page
Hero section, statistics, a scrolling logo slider, a "Latest Internships" section with live listings and a "View all" link, and a responsive burger menu on mobile.

### Code quality
ES6 throughout (`const`/`let`, arrow functions, template literals, `.map()`, `.filter()`, `.reduce()`), `try/catch` on every request, loading indicators and friendly error messages, and no API URLs outside `config.js`.

---

## APIs used

| API | Method | Endpoint | Used for |
|-----|--------|----------|----------|
| [Remotive](https://github.com/remotive-io/remote-jobs-api) | GET | `https://remotive.com/api/remote-jobs` | Internship feed, search, category filter, company grouping, home page |
| [Nominatim (OpenStreetMap)](https://operations.osmfoundation.org/policies/nominatim/) | GET | `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1` | Convert a job location into map coordinates |
| [restful-api.dev](https://restful-api.dev/) | GET, POST, PUT, DELETE | `https://api.restful-api.dev/objects` and `/objects/{id}` | Saved internships and applications |

Leaflet with OpenStreetMap tiles (loaded from cdnjs) draws the map. It is a library, not one of the three APIs.

### Shared data shape

Every listing is normalized to this shape, and all members use it:

```js
{ id, title, company, location, category, jobType, logo, url, description, date }
```

### How the data flows

- **Page load:** fetch listings, then render cards.
- **Save click:** POST to restful-api.dev, then update the button and the Saved list.
- **Apply form:** validate, POST, then the tracker updates.
- **Status change or withdraw:** PUT or DELETE, then the tracker updates.

### Using restful-api.dev

restful-api.dev is a shared public service, so every record is tagged with the team prefix `KIS-` and is filtered by that prefix when listing. All calls go through `js/api-client.js`:

```js
const saved = await apiGet('saved');                  // list our records
const rec   = await apiPost('saved', { jobId, title });  // create
await apiPut(rec.id, 'application', { status: 'Under Review' }); // update
await apiDelete(rec.id);                              // delete
```

`type` is a short word such as `saved` or `application`, and the prefix is added automatically. Records look like `{ id, name, data }`.

---

## Project structure

```
KhmerInternsphere_Project/
├── index.html           (same as home.html)
├── home.html
├── internships.html
├── companies.html
├── about.html
├── contact.html
├── README.md
├── assets/
│   └── favicon.ico
├── img/
│   └── logo.png
├── css/
│   ├── style.css        global tokens, base, hero, stats, buttons, footer
│   ├── nav.css          header, navigation, burger menu
│   ├── home.css         home page only
│   ├── latest.css       "Latest Internships" section
│   ├── saved.css        save buttons and Saved Internships list
│   ├── internship.css
│   ├── company.css
│   ├── about.css
│   ├── contact.css
│   ├── modal_new.css
│   └── tracker.css
└── js/
    ├── config.js        all API URLs and the team prefix
    ├── api-client.js    apiGet, apiPost, apiPut, apiDelete
    ├── main.js          logo slider, scroll reveal, burger nav, active link
    ├── internships.js   listings, search and filters
    ├── companies.js     company profiles
    ├── detail-map.js    detail modal, geocoding, Leaflet map
    ├── contact.js       contact form validation
    ├── saved.js         bookmarks
    ├── latest.js        latest internships on the home page
    ├── applications.js  application form
    └── tracker.js       application tracker
```

### Script and style order

Every page loads the CSS in this order, then its own page CSS:

```html
<link rel="stylesheet" href="./css/style.css" />
<link rel="stylesheet" href="./css/nav.css" />
```

Scripts go at the end of `<body>`, and `config.js` must come first:

```html
<script src="js/config.js"></script>
<script src="js/api-client.js"></script>
<script src="js/main.js"></script>
<!-- then the page's own scripts -->
```

---

## How to run

No build step or API key is needed. The project is plain HTML, CSS and JavaScript.

1. Clone the repository:
   ```bash
   git clone https://github.com/Mengchou-hello/KhmerInternsphere_WebII_Final_Project.git
   cd KhmerInternsphere_WebII_Final_Project
   ```
2. Serve the folder with a local web server. Do not open the HTML files directly with `file://`, because the Nominatim map requests need a normal web page origin.
   - **VS Code:** install the Live Server extension, then right-click `home.html` and choose "Open with Live Server" (usually http://127.0.0.1:5500).
   - **Python:**
     ```bash
     python3 -m http.server 5500
     ```
     then open http://localhost:5500/home.html.
3. An internet connection is required, because the app calls live APIs.

---

## Team workflow

- Each member edits only their own files, and asks the owner for changes elsewhere.
- Every pull request is reviewed by a teammate: members 1 and 2 review each other, and members 3 and 4 review each other.
- Each member presents their own feature.

---

## Known limitations

- Remotive lists remote jobs worldwide, so many internships are not located in Cambodia.
- restful-api.dev is a free shared service for learning, so data can be slow, limited or removed by the provider. Our records are tagged with `KIS-` to keep them separate from other students' data.
- Nominatim allows 1 request per second, so maps for new locations can take a moment to load. Repeated locations are served from the cache.
- Bookmarks and applications are stored for the whole team's prefix, not for individual user accounts, because the app has no login.

---

## References

- Leaflet. (n.d.). *Leaflet: An open-source JavaScript library for interactive maps*. https://leafletjs.com/
- MDN Web Docs. (2025, August 20). *Using the Fetch API*. Mozilla. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
- OpenStreetMap Foundation. (n.d.). *Nominatim usage policy (aka geocoding policy)*. https://operations.osmfoundation.org/policies/nominatim/
- osm-search. (n.d.). *Nominatim: Open source search based on OpenStreetMap data*. GitHub. https://github.com/osm-search/Nominatim
- Remotive. (n.d.). *Remote Jobs Public API*. GitHub. https://github.com/remotive-io/remote-jobs-api
- RESTful API. (n.d.). *Free REST API - Full CRUD support (GET, POST, PUT, PATCH, DELETE) for testing & learning*. https://restful-api.dev/

---

&copy; 2026 Khmer InternSphere, Group 7, INFO 251 Web Development II, AUPP.
