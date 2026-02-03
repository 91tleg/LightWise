LIGHTWISE — React Frontend (Dashboard)

1) What this project is
LightWise is a React dashboard UI for a smart streetlight system.
It includes:
- Login page (demo)
- Overview dashboard (KPIs, panels, selected pole card, map + legend)
- Map view (embedded Google Map)
- Admin page (system controls / configuration cards)

2) How to run the project
A) Install dependencies (first time only)
- Open a terminal in the project folder (where package.json is)
- Run:
  npm install

B) Start the app
- Run:
  npm start
- Open in browser:
  http://localhost:3000

3) Pages and routes
/           -> Login
/overview   -> Overview dashboard
/map        -> Map view
/admin      -> Admin page
(anything else redirects back to /)

4) Main files (quick map)
src/index.js
- Starts the React app, loads global CSS, enables routing (BrowserRouter)

src/App.js
- Defines the app routes (Login, Overview, Map, Admin)

src/components/Layout.js
- Wraps pages with Sidebar + TopBar and optional page header

src/components/Sidebar.js
- Left navigation rail + slide-out menu (opens on hover)

src/components/TopBar.js
- Top bar with LightWise logo/motto and action buttons

src/components/StatCard.js
- Small KPI card used on the Overview page

src/components/MapEmbed.js
- Reusable Google Map embed iframe

src/components/Legend.js
- Color legend used on the Overview page

src/pages/Login.js
- Demo login screen (navigates to /overview)

src/pages/Overview.js
- Dashboard page
- Calls getTelemetry() to load data (or uses mock data)
- Shows KPIs, panels, selected pole info, map, legend

src/pages/Map_View.js
- Map page (reuses Layout + MapEmbed)

src/pages/Admin.js
- Admin page (cards for Rules Engine, Access, Maintenance)

src/services/api.js
- getTelemetry() function
- Uses mock data by default unless environment variables are set

5) API / Mock mode
By default, the app uses mock data.

Environment variables (optional):
REACT_APP_USE_MOCK=true   -> use mock (default)
REACT_APP_USE_MOCK=false  -> use real API
REACT_APP_API_BASE=...    -> base URL of backend API
REACT_APP_API_KEY=...     -> API key (sent as X-API-Key header)

The telemetry endpoint expected:
GET {API_BASE}/telemetry

6) Styling
src/App.css
- Global base styles (height, font, box-sizing)

src/styles/lightwise.css
- Main UI styling (sidebar, topbar, dashboard grids, cards, login page, etc.)

7) Notes
- This frontend is currently in demo mode (placeholders like N/A).
- Map pins and real telemetry values can be added once backend is connected.
