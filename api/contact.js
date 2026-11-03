// Vercel serverless functie: ontvangt alle formulieren van salarazimi.nl.
// 1) Elke aanvraag wordt gelogd (Vercel → Project → Logs, zoek op "AANVRAAG"), dus er gaat nooit iets verloren.
// 2) Daarna wordt hij gemaild via Resend (resend.com).
// Instellen in Vercel → Project → Settings → Environment Variables:
//   RESEND_API_KEY = re_...                      (verplicht om te mailen)
//   MAIL_FROM      = Website <website@salarazimi.nl>  (domein moet in Resend geverifieerd zijn)
//   MAIL_TO        = alexander@salarazimi.nl     (optioneel, dit is de standaard)
//   MAIL_CC        = marketing@salarazimi.nl     (optioneel, dit is de standaard)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
  d = d || {};
  if (d._honey) { res.status(200).json({ ok: true }); return; } // spam
  const subject = String(d._subject || 'Aanvraag via de website').slice(0, 200);
  const fields = Object.keys(d).filter(k => k[0] !== '_').map(k => [k, String(d[k]).slice(0, 4000)]);
  console.log('AANVRAAG', JSON.stringify({ tijd: new Date().toISOString(), onderwerp: subject, velden: Object.fromEntries(fields) }));
  const key = process.env.RESEND_API_KEY;
  if (!key) { res.status(200).json({ ok: true, mailed: false }); return; }
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<h2 style="font-family:Arial">' + esc(subject) + '</h2><table style="font-family:Arial;font-size:14px;border-collapse:collapse">' +
    fields.map(([k, v]) => '<tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold;vertical-align:top">' + esc(k) + '</td><td style="padding:6px 12px;border:1px solid #ddd">' + esc(v).replace(/\n/g, '<br>') + '</td></tr>').join('') + '</table>';
  const email = (fields.find(([k]) => /mail/i.test(k)) || [])[1];
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Website <onboarding@resend.dev>',
        to: [process.env.MAIL_TO || 'alexander@salarazimi.nl'],
        cc: (process.env.MAIL_CC || 'marketing@salarazimi.nl').split(',').map(s => s.trim()).filter(Boolean),
        reply_to: email && /@/.test(email) ? email : undefined,
        subject, html
      })
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) { console.log('MAIL MISLUKT', r.status, JSON.stringify(out)); res.status(200).json({ ok: true, mailed: false }); return; }
    res.status(200).json({ ok: true, mailed: true });
  } catch (e) {
    console.log('MAIL FOUT', String(e)); res.status(200).json({ ok: true, mailed: false });
  }
};
