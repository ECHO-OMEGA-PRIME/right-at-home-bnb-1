/**
 * Right at Home BnB — Property Info Questionnaire
 * Cloudflare Worker that serves a beautiful form for Steven to fill out
 * property details (WiFi, parking, house rules, check-in/out instructions).
 * Submissions go directly to the RAH database.
 */

const PROPERTIES = [
  // === ACTIVE (18) ===
  { id: "castleford-5005", name: "Oasis with Pool & Billiards", address: "5005 Castleford Rd", vrboId: "2636389" },
  { id: "golf-course-2309", name: "Adobe Compound with Pool and Fire Pits and Billiards", address: "2309 W Golf Course Rd", vrboId: "3005111" },
  { id: "garfield-2702", name: "Patio Home with Hot Tub", address: "2702 N Garfield St", vrboId: "2634718" },
  { id: "douglas-2000", name: "Old Midland Living", address: "2000 Douglas Ave", vrboId: "3355618" },
  { id: "dentcrest-4707", name: "Hot Tub Delight", address: "4707 Dentcrest Dr", vrboId: "2638481" },
  { id: "chelsea-3210", name: "Retreat with Covered Patio", address: "3210 Chelsea Pl", vrboId: "2643784" },
  { id: "storey-4801", name: "Destination Getaway", address: "4801 Storey Ave", vrboId: "2643822" },
  { id: "daventry-1309", name: "Saddle Club", address: "1309 Daventry Pl", vrboId: "4750070" },
  { id: "daventry-1311", name: "Santiago Dreams", address: "1311 Daventry Pl", vrboId: "4179271" },
  { id: "lincoln-green-5800", name: "Sprawling Ranch House with Pool Cabana", address: "5800 Lincoln Green Ct", vrboId: "4581977" },
  { id: "shandon-3528", name: "Groovy Times with Pool", address: "3528 W Shandon Ave", vrboId: "4894280" },
  { id: "monterrey-1605", name: "Monterrey House", address: "1605 Monterrey Dr", vrboId: "3477668" },
  { id: "gleneagles-4535", name: "Northtown Place", address: "4535 Gleneagles Dr", vrboId: "2643808" },
  { id: "humble-3104", name: "Outdoor Dream", address: "3104 Humble Ave", vrboId: "4700881" },
  { id: "lanham-1426", name: "Posh & Private with Billiards", address: "1426 Lanham St", vrboId: "4437486" },
  { id: "siesta-4217", name: "Cowboy Siesta Corner Lot", address: "4217 Siesta Ln", vrboId: "4135262" },
  { id: "mogford-1408", name: "Clermont House with Pool & Billiards", address: "1408 Mogford St", vrboId: "3724481" },
  { id: "mockingbird-ridge-2501", name: "Mockingbird Ridge", address: "2501 Blazing Saddle Blvd", vrboId: "5103283" },
  // === INACTIVE (previously rented — Steven may still need to provide info) ===
  { id: "haynes-2802", name: "Safari Gameroom", address: "2802 Haynes Dr", vrboId: "2638524", inactive: true },
  { id: "vanguard-6613", name: "Vanguard Velvet Lounge", address: "6613 Vanguard Rd", vrboId: "3559249", inactive: true },
  { id: "oriole-6100", name: "Most Marvelous with Pool", address: "6100 Oriole Dr", vrboId: "4471713", inactive: true },
  { id: "gleneagles-4533", name: "Uptown Place", address: "4533 Gleneagles Dr", vrboId: "4056016", inactive: true },
  { id: "haynes-2314", name: "Grand Encore", address: "2314 Haynes Dr", vrboId: "4162037", inactive: true },
  { id: "haynes-2312", name: "Grand Lodging", address: "2312 Haynes Ave", vrboId: "2641181", inactive: true },
  { id: "cuthbert-1702", name: "Sprawling Ranch (Cuthbert)", address: "1702 W Cuthbert Ave", vrboId: "4255338", inactive: true },
  { id: "spring-meadow-4823", name: "Meadowpark", address: "4823 Spring Meadow Ln", vrboId: "2685503", inactive: true },
  { id: "douglas-2800", name: "Park View", address: "2800 Douglas Dr", vrboId: "2635356", inactive: true },
  { id: "medina-6002", name: "Los Patios", address: "6002 Medina Dr", vrboId: "2636694", inactive: true },
  { id: "boulder-4700", name: "Bungalow on Boulder", address: "4700 Boulder Dr", vrboId: "2983233", inactive: true },
  { id: "fenway-5705", name: "Chateau with Sequestered Loft", address: "5705 Fenway Dr", vrboId: "3764453", inactive: true },
];

const API_BASE = "https://rah-midland.com";
const API_SECRET = "rah-vrbo-sync-2026";

function renderForm() {
  const propertyCards = PROPERTIES.map((p, i) => `
    <div class="property-card" id="card-${i}">
      <div class="card-header" onclick="toggleCard(${i})">
        <div class="card-number">${i + 1}</div>
        <div class="card-title">
          <h3>${p.name}</h3>
          <span class="card-address">${p.address}, Midland TX</span>
        </div>
        <div class="card-status" id="status-${i}">
          <span class="status-dot pending"></span>
          <span class="status-text">Pending</span>
        </div>
        <div class="card-chevron" id="chevron-${i}">&#9660;</div>
      </div>
      <div class="card-body" id="body-${i}" style="display:none">
        <input type="hidden" name="properties[${i}][id]" value="${p.id}">
        <input type="hidden" name="properties[${i}][name]" value="${p.name}">

        <div class="field-group">
          <div class="field-icon">📶</div>
          <div class="field-content">
            <label>WiFi Network Name</label>
            <input type="text" name="properties[${i}][wifiNetwork]" placeholder="e.g. CastlefordGuest" class="field-input">
          </div>
        </div>

        <div class="field-group">
          <div class="field-icon">🔑</div>
          <div class="field-content">
            <label>WiFi Password</label>
            <input type="text" name="properties[${i}][wifiPassword]" placeholder="e.g. Welcome2Midland!" class="field-input">
          </div>
        </div>

        <div class="field-group">
          <div class="field-icon">🅿️</div>
          <div class="field-content">
            <label>Parking Instructions</label>
            <textarea name="properties[${i}][parkingInfo]" placeholder="e.g. Park in the driveway. Fits 2 cars. Street parking also available." class="field-input" rows="2"></textarea>
          </div>
        </div>

        <div class="field-group">
          <div class="field-icon">🏠</div>
          <div class="field-content">
            <label>Check-In Instructions</label>
            <textarea name="properties[${i}][checkInInstr]" placeholder="e.g. Use the keypad on the front door. Code will be sent day-of. Lockbox with backup key is on the side gate (code: 1234)." class="field-input" rows="3"></textarea>
          </div>
        </div>

        <div class="field-group">
          <div class="field-icon">👋</div>
          <div class="field-content">
            <label>Check-Out Instructions</label>
            <textarea name="properties[${i}][checkOutInstr]" placeholder="e.g. Set thermostat to 78°F, take out trash, start dishwasher, lock all doors. Leave remotes on coffee table." class="field-input" rows="3"></textarea>
          </div>
        </div>

        <div class="field-group">
          <div class="field-icon">📋</div>
          <div class="field-content">
            <label>House Rules</label>
            <textarea name="properties[${i}][houseRules]" placeholder="e.g. No smoking inside. No parties. Quiet hours 10PM-8AM. Max occupancy 8 guests. No pets unless pre-approved. Pool hours 8AM-10PM." class="field-input" rows="3"></textarea>
          </div>
        </div>

        <div class="field-group">
          <div class="field-icon">ℹ️</div>
          <div class="field-content">
            <label>Anything Else Guests Should Know</label>
            <textarea name="properties[${i}][extraNotes]" placeholder="e.g. Hot tub chemicals are in the garage cabinet. BBQ propane is next to the grill. Pool heater switch is in the breaker box." class="field-input" rows="2"></textarea>
          </div>
        </div>

        <button type="button" class="save-btn" onclick="saveProperty(${i})">
          <span class="save-icon">💾</span> Save This Property
        </button>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Right at Home BnB — Property Info</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .hero {
      text-align: center;
      padding: 40px 20px;
      margin-bottom: 30px;
    }

    .hero-logo {
      font-size: 48px;
      margin-bottom: 10px;
    }

    .hero h1 {
      font-size: 28px;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }

    .hero p {
      color: #94a3b8;
      font-size: 16px;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto;
    }

    .hero .subtitle {
      color: #f59e0b;
      font-weight: 600;
      margin-top: 15px;
      font-size: 14px;
    }

    .progress-bar {
      background: #1e293b;
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 24px;
      border: 1px solid #334155;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .progress-track {
      flex: 1;
      height: 8px;
      background: #334155;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f59e0b, #22c55e);
      border-radius: 4px;
      transition: width 0.5s ease;
      width: 0%;
    }

    .progress-text {
      font-size: 14px;
      color: #94a3b8;
      white-space: nowrap;
    }

    .property-card {
      background: #1e293b;
      border-radius: 12px;
      margin-bottom: 12px;
      border: 1px solid #334155;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .property-card.completed {
      border-color: #22c55e;
    }

    .property-card.active {
      border-color: #f59e0b;
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.1);
    }

    .card-header {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .card-header:hover {
      background: #243047;
    }

    .card-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #334155;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .completed .card-number {
      background: #22c55e;
      color: #0f172a;
    }

    .card-title { flex: 1; }
    .card-title h3 { font-size: 16px; color: #f1f5f9; }
    .card-address { font-size: 13px; color: #64748b; }

    .card-status { display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.pending { background: #64748b; }
    .status-dot.saved { background: #22c55e; }
    .status-text { font-size: 12px; color: #64748b; }

    .card-chevron {
      font-size: 12px;
      color: #64748b;
      transition: transform 0.3s;
    }

    .card-chevron.open { transform: rotate(180deg); }

    .card-body {
      padding: 0 20px 20px;
      border-top: 1px solid #334155;
    }

    .field-group {
      display: flex;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid #1a2332;
    }

    .field-group:last-of-type { border-bottom: none; }

    .field-icon {
      font-size: 20px;
      width: 32px;
      text-align: center;
      padding-top: 4px;
      flex-shrink: 0;
    }

    .field-content { flex: 1; }
    .field-content label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .field-input {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 10px 14px;
      color: #e2e8f0;
      font-size: 15px;
      font-family: inherit;
      transition: border-color 0.2s;
      resize: vertical;
    }

    .field-input:focus {
      outline: none;
      border-color: #f59e0b;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }

    .field-input::placeholder { color: #475569; }

    .save-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #0f172a;
      font-size: 16px;
      font-weight: 700;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      margin-top: 16px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
    .save-btn:active { transform: translateY(0); }
    .save-btn.saving { background: #64748b; cursor: wait; }
    .save-btn.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }

    .submit-all {
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      font-size: 18px;
      font-weight: 700;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      margin-top: 24px;
      transition: all 0.2s;
      letter-spacing: 0.5px;
    }

    .submit-all:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(34, 197, 94, 0.3); }

    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #22c55e;
      color: white;
      padding: 14px 24px;
      border-radius: 10px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transform: translateY(100px);
      transition: transform 0.3s ease;
      z-index: 100;
    }

    .toast.show { transform: translateY(0); }

    .footer {
      text-align: center;
      padding: 30px;
      color: #475569;
      font-size: 13px;
    }

    @media (max-width: 640px) {
      body { padding: 10px; }
      .hero h1 { font-size: 22px; }
      .card-header { padding: 12px 14px; }
      .field-group { flex-direction: column; gap: 6px; }
      .field-icon { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <div class="hero-logo">🏡</div>
      <h1>Right at Home Property Info</h1>
      <p>Hey Steven! We've automated the entire guest messaging system — welcome messages, door codes, WiFi info, check-out reminders, and review requests all go out automatically now.</p>
      <p>We just need the details below for each property so guests get the right info. Fill out what you can — you can always come back and update later!</p>
      <div class="subtitle">⚡ Each property saves independently — no need to do them all at once</div>
    </div>

    <div class="progress-bar">
      <span class="progress-text" id="progress-label">0 / ${PROPERTIES.length} complete</span>
      <div class="progress-track">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
    </div>

    <form id="questionnaire">
      ${propertyCards}
    </form>

    <button class="submit-all" onclick="submitAll()">
      🚀 Save All Properties
    </button>

    <div class="footer">
      Right at Home BnB — Midland, TX<br>
      Automated Guest Experience System v1.0
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const saved = {};
    let completedCount = 0;

    function toggleCard(i) {
      const body = document.getElementById('body-' + i);
      const chevron = document.getElementById('chevron-' + i);
      const card = document.getElementById('card-' + i);
      const isOpen = body.style.display !== 'none';

      // Close all others
      document.querySelectorAll('.card-body').forEach((b, idx) => {
        b.style.display = 'none';
        document.getElementById('chevron-' + idx)?.classList.remove('open');
        document.getElementById('card-' + idx)?.classList.remove('active');
      });

      if (!isOpen) {
        body.style.display = 'block';
        chevron.classList.add('open');
        card.classList.add('active');
        // Scroll into view
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }

    function showToast(msg, duration = 3000) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), duration);
    }

    function updateProgress() {
      completedCount = Object.keys(saved).length;
      const pct = (completedCount / ${PROPERTIES.length}) * 100;
      document.getElementById('progress-fill').style.width = pct + '%';
      document.getElementById('progress-label').textContent = completedCount + ' / ${PROPERTIES.length} complete';
    }

    async function saveProperty(i) {
      const btn = document.querySelector('#card-' + i + ' .save-btn');
      btn.classList.add('saving');
      btn.innerHTML = '<span class="save-icon">⏳</span> Saving...';

      const form = document.getElementById('questionnaire');
      const data = {
        id: form.querySelector('[name="properties[' + i + '][id]"]').value,
        name: form.querySelector('[name="properties[' + i + '][name]"]').value,
        wifiNetwork: form.querySelector('[name="properties[' + i + '][wifiNetwork]"]').value,
        wifiPassword: form.querySelector('[name="properties[' + i + '][wifiPassword]"]').value,
        parkingInfo: form.querySelector('[name="properties[' + i + '][parkingInfo]"]').value,
        checkInInstr: form.querySelector('[name="properties[' + i + '][checkInInstr]"]').value,
        checkOutInstr: form.querySelector('[name="properties[' + i + '][checkOutInstr]"]').value,
        houseRules: form.querySelector('[name="properties[' + i + '][houseRules]"]').value,
        extraNotes: form.querySelector('[name="properties[' + i + '][extraNotes]"]').value,
      };

      // Check if at least WiFi is filled
      const hasContent = data.wifiNetwork || data.wifiPassword || data.parkingInfo ||
                         data.checkInInstr || data.checkOutInstr || data.houseRules;

      try {
        const resp = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await resp.json();

        if (result.ok) {
          btn.classList.remove('saving');
          btn.classList.add('saved');
          btn.innerHTML = '<span class="save-icon">✅</span> Saved!';

          const card = document.getElementById('card-' + i);
          card.classList.add('completed');

          const status = document.getElementById('status-' + i);
          status.innerHTML = '<span class="status-dot saved"></span><span class="status-text">Saved</span>';

          saved[i] = true;
          updateProgress();
          showToast('✅ ' + data.name + ' saved!');

          // Auto-open next card
          setTimeout(() => {
            if (i + 1 < ${PROPERTIES.length} && !saved[i + 1]) {
              toggleCard(i + 1);
            }
          }, 500);
        } else {
          throw new Error(result.error || 'Save failed');
        }
      } catch (err) {
        btn.classList.remove('saving');
        btn.innerHTML = '<span class="save-icon">❌</span> Error — Try Again';
        showToast('❌ Error: ' + err.message);
        setTimeout(() => {
          btn.innerHTML = '<span class="save-icon">💾</span> Save This Property';
        }, 3000);
      }
    }

    async function submitAll() {
      for (let i = 0; i < ${PROPERTIES.length}; i++) {
        if (!saved[i]) {
          const form = document.getElementById('questionnaire');
          const wifi = form.querySelector('[name="properties[' + i + '][wifiNetwork]"]').value;
          if (wifi) { // Only save if something was filled in
            await saveProperty(i);
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }
      showToast('🎉 All properties saved! Thank you Steven!', 5000);
    }

    // Auto-open first card
    toggleCard(0);
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the form
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(renderForm(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // Handle form submissions
    if (url.pathname === '/api/save' && request.method === 'POST') {
      try {
        const data = await request.json();

        // Push to RAH database
        const resp = await fetch(`${API_BASE}/api/admin/property-info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': API_SECRET,
          },
          body: JSON.stringify(data),
        });

        if (!resp.ok) {
          const text = await resp.text();
          return Response.json({ ok: false, error: `API error: ${resp.status} ${text}` });
        }

        const result = await resp.json();
        return Response.json({ ok: true, ...result });
      } catch (err) {
        return Response.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
