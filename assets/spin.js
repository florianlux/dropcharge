(function () {
  'use strict';

  /* ── Prize segments (must match server PRIZES order) ────── */
  var SEGMENTS = [
    { label: '5%',     color: '#6d28d9' },
    { label: '10%',    color: '#7c3aed' },
    { label: '15%',    color: '#8b5cf6' },
    { label: 'Ship',   color: '#a78bfa' },
    { label: '20%',    color: '#c4b5fd' },
    { label: 'Bonus',  color: '#ddd6fe' },
  ];

  var canvas  = document.getElementById('spinCanvas');
  var ctx     = canvas.getContext('2d');
  var form    = document.getElementById('spinForm');
  var emailIn = document.getElementById('spinEmail');
  var consent = document.getElementById('spinConsent');
  var btn     = document.getElementById('spinBtn');
  var errEl   = document.getElementById('spinError');
  var resultEl = document.getElementById('spinResult');
  var prizeEl  = document.getElementById('prizeText');

  var spinning = false;
  var currentAngle = 0;

  /* ── Draw wheel ────────────────────────────────────── */
  function drawWheel(angle) {
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    var r  = cx - 4;
    var n  = SEGMENTS.length;
    var arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    for (var i = 0; i < n; i++) {
      var start = i * arc;
      var end   = start + arc;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = SEGMENTS[i].color;
      ctx.fill();

      /* label */
      ctx.save();
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0d0f17';
      ctx.font = 'bold 14px Space Grotesk, sans-serif';
      ctx.fillText(SEGMENTS[i].label, r - 16, 5);
      ctx.restore();
    }

    ctx.restore();

    /* outer ring */
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2d2f3a';
    ctx.stroke();
  }

  drawWheel(0);

  /* ── Animate ──────────────────────────────────────── */
  function animateSpin(prizeIndex, onDone) {
    var n = SEGMENTS.length;
    var arc = (2 * Math.PI) / n;
    /* Land in the middle of the winning segment at the top (pointer at 270°) */
    var segCenter = prizeIndex * arc + arc / 2;
    var target = (2 * Math.PI) * (4 + Math.random()) - segCenter + Math.PI * 1.5;

    var start = currentAngle;
    var distance = target - start;
    var duration = 3500;
    var t0 = null;

    function step(ts) {
      if (!t0) t0 = ts;
      var elapsed = ts - t0;
      var t = Math.min(elapsed / duration, 1);
      /* ease-out cubic */
      var ease = 1 - Math.pow(1 - t, 3);
      currentAngle = start + distance * ease;
      drawWheel(currentAngle);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        onDone();
      }
    }

    requestAnimationFrame(step);
  }

  /* ── Map server prizeLabel → segment index ────────── */
  var LABEL_MAP = {
    '5% Discount':  0,
    '10% Discount': 1,
    '15% Discount': 2,
    'Free Shipping': 3,
    '20% Discount': 4,
    'Mystery Bonus': 5,
  };

  /* ── Show / hide helpers ──────────────────────────── */
  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  }
  function hideError() {
    errEl.textContent = '';
    errEl.hidden = true;
  }

  /* ── Submit ───────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError();

    if (spinning) return;

    var email = emailIn.value.trim();
    if (!email) { showError('Please enter your email.'); return; }
    if (!consent.checked) { showError('Please agree to the terms.'); return; }

    spinning = true;
    btn.disabled = true;
    btn.textContent = 'Spinning…';

    fetch('/.netlify/functions/spin-enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, consent: true }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) {
          var msg = data.error === 'already_entered'
            ? 'You have already entered. Check your email!'
            : data.error === 'invalid_email'
            ? 'Please enter a valid email address.'
            : data.error === 'consent_required'
            ? 'Consent is required to participate.'
            : 'Something went wrong. Please try again.';
          showError(msg);
          spinning = false;
          btn.disabled = false;
          btn.textContent = 'Spin the Wheel';
          return;
        }

        var idx = LABEL_MAP[data.prizeLabel];
        if (idx === undefined) idx = 0;

        animateSpin(idx, function () {
          prizeEl.textContent = '🎉 You won: ' + data.prizeLabel;
          resultEl.hidden = false;
          form.style.display = 'none';
          spinning = false;
        });
      })
      .catch(function () {
        showError('Network error. Please try again.');
        spinning = false;
        btn.disabled = false;
        btn.textContent = 'Spin the Wheel';
      });
  });
})();
