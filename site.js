document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.nav-toggle');
const navigation = document.querySelector('.site-nav');
const menuLabel = menuButton?.querySelector('.sr-only');

const tubesHost = document.querySelector('.hero, .home-hero, .automation-hero');

function mountGalatineTubes() {
    if (!tubesHost) return;

    // Keep the branded atmosphere static. Runtime drawing is intentionally
    // disabled after device-specific stability issues with animated canvases.
    tubesHost.classList.add('tubes-host', 'tubes-static');
    return;

    tubesHost.classList.add('tubes-host');

    const canvas = document.createElement('canvas');
    canvas.className = 'galatine-tubes';
    canvas.setAttribute('aria-hidden', 'true');
    tubesHost.prepend(canvas);

    const keepStatic = reducedMotion
        || window.matchMedia('(max-width: 820px)').matches
        || navigator.connection?.saveData;

    if (keepStatic) {
        tubesHost.classList.add('tubes-static');
        return;
    }

    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) {
        tubesHost.classList.add('tubes-static');
        return;
    }

    const strands = [
        { phase: 0, speed: .92, amplitude: .105, width: 6, color: '199,163,79', alpha: .56 },
        { phase: 1.3, speed: .72, amplitude: .078, width: 3, color: '227,197,111', alpha: .42 },
        { phase: 2.7, speed: 1.08, amplitude: .12, width: 2, color: '143,110,39', alpha: .46 },
        { phase: 4.1, speed: .81, amplitude: .062, width: 1.5, color: '241,242,233', alpha: .26 }
    ];
    let width = 0;
    let height = 0;
    let pointerX = .76;
    let pointerY = .5;
    let targetX = pointerX;
    let targetY = pointerY;
    let lastFrame = 0;
    let frameId;
    let inView = true;

    function resizeCanvas() {
        width = Math.max(1, Math.round(tubesHost.clientWidth));
        height = Math.max(1, Math.round(tubesHost.clientHeight));
        canvas.width = width;
        canvas.height = height;
    }

    function drawFrame(timestamp) {
        frameId = undefined;
        if (document.hidden || !inView) return;

        if (timestamp - lastFrame >= 33) {
            lastFrame = timestamp;
            pointerX += (targetX - pointerX) * .045;
            pointerY += (targetY - pointerY) * .045;
            context.clearRect(0, 0, width, height);
            context.save();
            context.globalCompositeOperation = 'screen';

            const time = timestamp * .00035;
            const startX = width * .36;
            const travel = width - startX + 80;

            strands.forEach((strand, strandIndex) => {
                const gradient = context.createLinearGradient(startX, 0, width, 0);
                gradient.addColorStop(0, `rgba(${strand.color},0)`);
                gradient.addColorStop(.28, `rgba(${strand.color},${strand.alpha * .55})`);
                gradient.addColorStop(.72, `rgba(${strand.color},${strand.alpha})`);
                gradient.addColorStop(1, `rgba(${strand.color},0)`);

                context.beginPath();
                for (let step = 0; step <= 64; step += 1) {
                    const progress = step / 64;
                    const envelope = Math.sin(Math.PI * progress);
                    const x = startX + travel * progress;
                    const wave = Math.sin(progress * 6.4 + time * strand.speed + strand.phase);
                    const cursorBend = (pointerY - .5) * height * .3 * progress;
                    const horizontalPull = (pointerX - .5) * height * .08 * (progress - .35);
                    const y = height * (.5 + (strandIndex - 1.5) * .025)
                        + wave * height * strand.amplitude * envelope
                        + cursorBend
                        + horizontalPull;
                    if (step === 0) context.moveTo(x, y);
                    else context.lineTo(x, y);
                }
                context.strokeStyle = gradient;
                context.lineWidth = strand.width;
                context.lineCap = 'round';
                context.shadowColor = `rgba(${strand.color},${strand.alpha})`;
                context.shadowBlur = strand.width * 2.4;
                context.stroke();
            });

            context.restore();
        }

        frameId = window.requestAnimationFrame(drawFrame);
    }

    function startDrawing() {
        if (!frameId && !document.hidden && inView) frameId = window.requestAnimationFrame(drawFrame);
    }

    tubesHost.addEventListener('pointermove', (event) => {
        const bounds = tubesHost.getBoundingClientRect();
        targetX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        targetY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    }, { passive: true });

    document.addEventListener('visibilitychange', startDrawing);
    new ResizeObserver(resizeCanvas).observe(tubesHost);
    new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) startDrawing();
        else if (frameId) {
            window.cancelAnimationFrame(frameId);
            frameId = undefined;
        }
    }, { threshold: .01 }).observe(tubesHost);

    resizeCanvas();
    tubesHost.classList.add('tubes-ready');
    startDrawing();
}

mountGalatineTubes();

function closeMenu() {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (menuLabel) menuLabel.textContent = 'Open navigation';
}

menuButton?.addEventListener('click', () => {
    const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(willOpen));
    navigation?.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
    if (menuLabel) menuLabel.textContent = willOpen ? 'Close navigation' : 'Open navigation';
});

navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
});

function updateHeader() {
    header?.classList.toggle('scrolled', window.scrollY > 24);
}
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const reveals = document.querySelectorAll('.reveal');
if (!('IntersectionObserver' in window) || reducedMotion) {
    reveals.forEach((element) => element.classList.add('is-visible'));
} else {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
    reveals.forEach((element) => observer.observe(element));
}

const events = [
    { source: 'OT / MODBUS', command: 'Read temperature register 40021', verdict: 'allow' },
    { source: 'OT / MODBUS', command: 'Write dosing setpoint → 9,500% safe range', verdict: 'deny' },
    { source: 'AI AGENT / CRM', command: 'send_email() / PII present in payload', verdict: 'approval' },
    { source: 'OT / MODBUS', command: 'Firmware push outside maintenance window', verdict: 'approval' },
    { source: 'AI AGENT / FILES', command: 'write_file() / production environment', verdict: 'deny' },
    { source: 'OT / MODBUS', command: 'Read valve V-114 position', verdict: 'allow' }
];
const feed = document.getElementById('hero-feed');
const eventCount = document.getElementById('decision-count');
let eventIndex = 0;

function createEvent(event) {
    const row = document.createElement('div');
    row.className = 'feed-event';

    const copy = document.createElement('div');
    const source = document.createElement('div');
    source.className = 'feed-source';
    source.textContent = event.source;
    const command = document.createElement('div');
    command.className = 'feed-command';
    command.textContent = event.command;
    copy.append(source, command);

    const verdict = document.createElement('span');
    verdict.className = `feed-verdict ${event.verdict}`;
    verdict.textContent = event.verdict;
    row.append(copy, verdict);
    return row;
}

function pushEvent() {
    if (!feed) return;
    feed.appendChild(createEvent(events[eventIndex % events.length]));
    eventIndex += 1;
    while (feed.children.length > 3) feed.firstElementChild?.remove();
    if (eventCount) eventCount.textContent = `${String(Math.min(eventIndex, 999)).padStart(3, '0')} events`;
}

for (let i = 0; i < 3; i += 1) pushEvent();

let feedTimer;
function startFeed() {
    if (!feed || reducedMotion || feedTimer || document.hidden) return;
    feedTimer = window.setInterval(pushEvent, 3200);
}
function stopFeed() {
    if (!feedTimer) return;
    window.clearInterval(feedTimer);
    feedTimer = undefined;
}
document.addEventListener('visibilitychange', () => document.hidden ? stopFeed() : startFeed());
startFeed();
